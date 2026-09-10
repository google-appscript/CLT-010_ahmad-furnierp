import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import {
  vendorBills, vendorBillLines,
  purchaseOrderLines, taxes, accounts, partners,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import type { ParameterDaftar, HasilDaftar } from '@/lib/daftar'
import { bulatkan, kurang, tambah, type Uang } from '@/lib/uang'
import { ambilNomorBerikut } from '@/modules/akuntansi/layanan/urutan'
import { postingJurnalDalamTx } from '@/modules/akuntansi/layanan/entri'
import {
  jurnalUntukDalamTx, PEMETAAN_JURNAL,
} from '@/modules/akuntansi/layanan/pemetaan'
import { hitungJatuhTempo } from '@/modules/akuntansi/layanan/syarat-pembayaran'
import { skemaTagihan, type MasukanTagihan } from '../validasi/pesanan'
import { hitungTotal, type BarisHitung, type HasilTotal } from '@/modules/akuntansi/layanan/hitung-dokumen'
import { perbaruiStatusPenyelesaian } from './pesanan'

export type Tagihan = typeof vendorBills.$inferSelect
export type BarisTagihan = typeof vendorBillLines.$inferSelect
export type TagihanLengkap = Tagihan & { baris: BarisTagihan[] }

const DESIMAL = 2
const KODE_URUTAN: Record<Tagihan['tipe'], string> = {
  tagihan: 'pembelian:tagihan',
  nota_debit: 'pembelian:nota-debit',
}

function urai(masukan: MasukanTagihan) {
  const hasil = skemaTagihan.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

// ── Pembacaan ────────────────────────────────────────────────────────────────

function kolomUrutTagihan(kolom?: string) {
  switch (kolom) {
    case 'nomor': return vendorBills.nomor
    case 'status': return vendorBills.status
    case 'dibuatPada': return vendorBills.dibuatPada
    case 'tanggal':
    default:
      return vendorBills.tanggal
  }
}

export async function daftarTagihan(
  param: ParameterDaftar & { tipe?: Tagihan['tipe']; status?: Tagihan['status'] } = { halaman: 1, ukuranHalaman: 20 },
): Promise<HasilDaftar<Tagihan>> {
  const halaman = param.halaman || 1
  const ukuranHalaman = param.ukuranHalaman || 20

  const kondisi = []
  if (param.tipe) kondisi.push(eq(vendorBills.tipe, param.tipe))
  if (param.cari) {
    kondisi.push(or(
      ilike(vendorBills.nomor, `%${param.cari}%`),
      ilike(partners.nama, `%${param.cari}%`),
      ilike(vendorBills.referensiPemasok, `%${param.cari}%`),
    ))
  }

  const statusDisaring = [
    ...(param.status ? [param.status] : []),
    ...(param.filter?.status ?? []),
  ] as Tagihan['status'][]
  if (statusDisaring.length > 0) {
    kondisi.push(inArray(vendorBills.status, statusDisaring))
  }

  const where = kondisi.length > 0 ? and(...kondisi) : undefined
  const kolomUrut = kolomUrutTagihan(param.urutkan?.kolom)
  const arahUrut = param.urutkan?.arah === 'asc' ? asc : desc

  const [baris, [{ jumlah }]] = await Promise.all([
    db.select({ tagihan: vendorBills }).from(vendorBills)
      .innerJoin(partners, eq(partners.id, vendorBills.partnerId))
      .where(where)
      .orderBy(arahUrut(kolomUrut), desc(vendorBills.dibuatPada))
      .limit(ukuranHalaman)
      .offset((halaman - 1) * ukuranHalaman),
    db.select({ jumlah: sql<number>`count(*)::int` }).from(vendorBills)
      .innerJoin(partners, eq(partners.id, vendorBills.partnerId))
      .where(where),
  ])

  return { data: baris.map((b) => b.tagihan), totalBaris: jumlah }
}

export async function ambilTagihan(id: string): Promise<TagihanLengkap | null> {
  const [tagihan] = await db.select().from(vendorBills).where(eq(vendorBills.id, id)).limit(1)
  if (!tagihan) return null
  const baris = await db.select().from(vendorBillLines)
    .where(eq(vendorBillLines.billId, id))
    .orderBy(asc(vendorBillLines.urutan))
  return { ...tagihan, baris }
}

async function totalDariBaris(
  baris: { kuantitas: string; hargaSatuan: string; taxId: string | null }[],
): Promise<HasilTotal> {
  const daftarPajak = await db.select().from(taxes)
  const pajakLewatId = new Map(daftarPajak.map((p) => [p.id, p]))

  const masukan: BarisHitung[] = baris.map((b) => {
    const p = b.taxId ? pajakLewatId.get(b.taxId) : undefined
    return {
      kuantitas: b.kuantitas,
      hargaSatuan: b.hargaSatuan,
      pajak: p
        ? { tarif: p.tarif, hargaTermasukPajak: p.hargaTermasukPajak, isPemotongan: p.isPemotongan }
        : null,
    }
  })
  return hitungTotal(masukan)
}

export async function totalTagihan(id: string): Promise<HasilTotal> {
  const tagihan = await ambilTagihan(id)
  if (!tagihan) throw new ValidasiError('Tagihan tidak ditemukan')
  return totalDariBaris(tagihan.baris)
}

/** Jumlah yang sudah dialokasikan dari pembayaran terposting ke tagihan ini. */
export async function jumlahTerbayar(billId: string): Promise<Uang> {
  const hasil = await db.execute<{ jumlah: string }>(sql`
    SELECT COALESCE(SUM(a.jumlah), 0)::text AS jumlah
    FROM vendor_payment_allocations a
    JOIN vendor_payments p ON p.id = a.pembayaran_id
    WHERE a.bill_id = ${billId} AND p.status = 'diposting'
  `)
  const baris = (hasil as unknown as { jumlah: string }[])[0]
  return Number(baris?.jumlah ?? 0).toFixed(2)
}

export type RingkasanTagihan = Tagihan & {
  totalTagihan: Uang
  totalDibayar: Uang
  terbayar: Uang
  sisa: Uang
}

export async function ringkasanTagihan(id: string): Promise<RingkasanTagihan | null> {
  const tagihan = await ambilTagihan(id)
  if (!tagihan) return null
  const total = await totalDariBaris(tagihan.baris)
  const terbayar = await jumlahTerbayar(id)
  return {
    ...tagihan,
    totalTagihan: total.totalTagihan,
    totalDibayar: total.totalDibayar,
    terbayar,
    sisa: bulatkan(kurang(total.totalDibayar, terbayar), DESIMAL),
  }
}

// ── Penulisan ────────────────────────────────────────────────────────────────

export async function buatTagihan(
  masukan: MasukanTagihan, dibuatOleh: string,
): Promise<TagihanLengkap> {
  const data = urai(masukan)

  const id = await db.transaction(async (tx) => {
    const [tagihan] = await tx.insert(vendorBills).values({
      tipe: data.tipe,
      status: 'draft',
      partnerId: data.partnerId,
      poId: data.poId,
      tanggal: data.tanggal,
      tanggalJatuhTempo: data.tanggalJatuhTempo,
      referensiPemasok: data.referensiPemasok,
      mataUangId: data.mataUangId,
      catatan: data.catatan,
      dibuatOleh,
    }).returning({ id: vendorBills.id })

    await tx.insert(vendorBillLines).values(
      data.baris.map((b, i) => ({
        billId: tagihan.id,
        urutan: i + 1,
        produkId: b.produkId,
        poLineId: b.poLineId,
        deskripsi: b.deskripsi,
        kuantitas: b.kuantitas,
        uomId: b.uomId,
        hargaSatuan: b.hargaSatuan,
        taxId: b.taxId,
        akunId: b.akunId,
      })),
    )

    return tagihan.id
  })

  return (await ambilTagihan(id))!
}

export async function ubahTagihan(
  id: string, masukan: MasukanTagihan,
): Promise<TagihanLengkap> {
  const data = urai(masukan)
  const lama = await ambilTagihan(id)
  if (!lama) throw new ValidasiError('Tagihan tidak ditemukan')
  if (lama.status !== 'draft') {
    throw new ValidasiError(
      'Tagihan yang sudah diposting tidak dapat diubah. Buat nota debit untuk mengoreksinya.',
    )
  }

  await db.transaction(async (tx) => {
    await tx.update(vendorBills).set({
      tipe: data.tipe,
      partnerId: data.partnerId,
      poId: data.poId,
      tanggal: data.tanggal,
      tanggalJatuhTempo: data.tanggalJatuhTempo,
      referensiPemasok: data.referensiPemasok,
      mataUangId: data.mataUangId,
      catatan: data.catatan,
      diubahPada: new Date(),
    }).where(eq(vendorBills.id, id))

    await tx.delete(vendorBillLines).where(eq(vendorBillLines.billId, id))
    await tx.insert(vendorBillLines).values(
      data.baris.map((b, i) => ({
        billId: id,
        urutan: i + 1,
        produkId: b.produkId,
        poLineId: b.poLineId,
        deskripsi: b.deskripsi,
        kuantitas: b.kuantitas,
        uomId: b.uomId,
        hargaSatuan: b.hargaSatuan,
        taxId: b.taxId,
        akunId: b.akunId,
      })),
    )
  })

  return (await ambilTagihan(id))!
}

/** Akun utang usaha: milik mitra bila diatur, jika tidak akun bertipe utang usaha. */
async function akunUtangUsaha(tx: Transaksi, partnerId: string): Promise<string> {
  const [mitra] = await tx.select().from(partners).where(eq(partners.id, partnerId)).limit(1)
  if (mitra?.akunUtangId) return mitra.akunUtangId

  const [akun] = await tx.select().from(accounts)
    .where(and(eq(accounts.tipeAkun, 'liabilitas_utang_usaha'), eq(accounts.isActive, true)))
    .orderBy(asc(accounts.kode)).limit(1)
  if (!akun) {
    throw new ValidasiError(
      'Tidak ada akun bertipe Utang Usaha di bagan akun. Tambahkan terlebih dahulu.',
    )
  }
  return akun.id
}

/**
 * Memposting tagihan pemasok.
 *
 * Baris yang berasal dari penerimaan barang mendebit akun Penerimaan Barang
 * Belum Ditagih, sehingga penampung yang dikredit saat barang diterima kini
 * tertutup. PPN Masukan didebit tersendiri karena dapat dikreditkan,
 * sedangkan PPh dikredit ke utang pajak karena mengurangi kas yang dibayar
 * tanpa mengurangi nilai tagihan pemasok.
 */
export async function postingTagihan(
  id: string, olehPengguna: string,
): Promise<TagihanLengkap> {
  await db.transaction(async (tx) => {
    const [tagihan] = await tx.select().from(vendorBills)
      .where(eq(vendorBills.id, id)).for('update').limit(1)

    if (!tagihan) throw new ValidasiError('Tagihan tidak ditemukan')
    if (tagihan.status === 'diposting') throw new ValidasiError('Tagihan ini sudah diposting')
    if (tagihan.status === 'dibatalkan') {
      throw new ValidasiError('Tagihan yang dibatalkan tidak dapat diposting')
    }

    const baris = await tx.select().from(vendorBillLines)
      .where(eq(vendorBillLines.billId, id))
      .orderBy(asc(vendorBillLines.urutan))
    if (baris.length === 0) throw new ValidasiError('Tagihan memerlukan minimal satu baris')

    const daftarPajak = await tx.select().from(taxes)
    const pajakLewatId = new Map(daftarPajak.map((p) => [p.id, p]))

    const total = hitungTotal(baris.map((b) => {
      const p = b.taxId ? pajakLewatId.get(b.taxId) : undefined
      return {
        kuantitas: b.kuantitas,
        hargaSatuan: b.hargaSatuan,
        pajak: p
          ? { tarif: p.tarif, hargaTermasukPajak: p.hargaTermasukPajak, isPemotongan: p.isPemotongan }
          : null,
      }
    }))

    // Nota debit membalik seluruh arah: yang tadinya didebit menjadi dikredit.
    const dibalik = tagihan.tipe === 'nota_debit'
    const sisiBiaya = (nilai: Uang) => (dibalik ? { debit: '0', kredit: nilai } : { debit: nilai, kredit: '0' })
    const sisiUtang = (nilai: Uang) => (dibalik ? { debit: nilai, kredit: '0' } : { debit: '0', kredit: nilai })

    const item: {
      accountId: string; partnerId: string | null; label: string
      debit: string; kredit: string
      nilaiMataUang: null; taxId: string | null; projectId: null
    }[] = []

    baris.forEach((b, i) => {
      const dpp = total.baris[i].dpp
      if (Number(dpp) === 0) return
      item.push({
        accountId: b.akunId,
        partnerId: tagihan.partnerId,
        label: b.deskripsi,
        ...sisiBiaya(dpp),
        nilaiMataUang: null, taxId: b.taxId, projectId: null,
      })
    })

    // PPN Masukan dikelompokkan per akun pajaknya.
    const ppnPerAkun = new Map<string, { nilai: number; taxId: string }>()
    const pemotonganPerAkun = new Map<string, { nilai: number; taxId: string }>()

    baris.forEach((b, i) => {
      if (!b.taxId) return
      const p = pajakLewatId.get(b.taxId)
      if (!p) return
      const peta = p.isPemotongan ? pemotonganPerAkun : ppnPerAkun
      const nilai = Number(p.isPemotongan ? total.baris[i].pemotongan : total.baris[i].ppn)
      if (nilai === 0) return
      const sudahAda = peta.get(p.akunPajakId) ?? { nilai: 0, taxId: b.taxId }
      peta.set(p.akunPajakId, { nilai: sudahAda.nilai + nilai, taxId: b.taxId })
    })

    for (const [akunId, { nilai, taxId }] of ppnPerAkun) {
      item.push({
        accountId: akunId,
        partnerId: tagihan.partnerId,
        label: 'PPN Masukan',
        ...sisiBiaya(nilai.toFixed(DESIMAL)),
        nilaiMataUang: null, taxId, projectId: null,
      })
    }

    // PPh mengurangi kas yang dibayar, jadi berada di sisi yang sama dengan utang.
    for (const [akunId, { nilai, taxId }] of pemotonganPerAkun) {
      item.push({
        accountId: akunId,
        partnerId: tagihan.partnerId,
        label: 'Pajak dipotong dari pembayaran',
        ...sisiUtang(nilai.toFixed(DESIMAL)),
        nilaiMataUang: null, taxId, projectId: null,
      })
    }

    const utangBersih = bulatkan(
      kurang(total.totalTagihan, total.totalPemotongan), DESIMAL,
    )
    if (Number(utangBersih) !== 0) {
      item.push({
        accountId: await akunUtangUsaha(tx, tagihan.partnerId),
        partnerId: tagihan.partnerId,
        label: dibalik ? 'Nota debit kepada pemasok' : 'Utang kepada pemasok',
        ...sisiUtang(utangBersih),
        nilaiMataUang: null, taxId: null, projectId: null,
      })
    }

    const journalId = await jurnalUntukDalamTx(tx, PEMETAAN_JURNAL.TAGIHAN_PEMBELIAN)

    const nomor = await ambilNomorBerikut(
      tx, KODE_URUTAN[tagihan.tipe], new Date(`${tagihan.tanggal}T00:00:00Z`),
    )

    const hasil = await postingJurnalDalamTx(tx, {
      journalId,
      tanggal: tagihan.tanggal,
      referensi: tagihan.referensiPemasok ?? nomor,
      keterangan: `${dibalik ? 'Nota debit' : 'Tagihan pembelian'} ${nomor}`,
      mataUangId: tagihan.mataUangId,
      partnerId: tagihan.partnerId,
      sumberTipe: `pembelian:${tagihan.tipe}`,
      sumberId: id,
      item,
    }, olehPengguna)

    // Kuantitas ditagih diperbarui agar sisa yang belum ditagih pada pesanan
    // tetap akurat saat tagihan berikutnya dibuat.
    for (const b of baris) {
      if (!b.poLineId) continue
      const tanda = dibalik ? -1 : 1
      await tx.update(purchaseOrderLines)
        .set({
          kuantitasDitagih: sql`GREATEST(${purchaseOrderLines.kuantitasDitagih} + ${String(tanda * Number(b.kuantitas))}, 0)`,
        })
        .where(eq(purchaseOrderLines.id, b.poLineId))
    }

    await tx.update(vendorBills).set({
      nomor,
      status: 'diposting',
      jurnalEntryId: hasil.id,
      dipostingPada: new Date(),
      dipostingOleh: olehPengguna,
      diubahPada: new Date(),
    }).where(eq(vendorBills.id, id))
  })

  const tagihan = (await ambilTagihan(id))!
  if (tagihan.poId) await perbaruiStatusPenyelesaian(tagihan.poId)
  return tagihan
}

export async function batalkanTagihan(id: string): Promise<void> {
  const tagihan = await ambilTagihan(id)
  if (!tagihan) throw new ValidasiError('Tagihan tidak ditemukan')
  if (tagihan.status !== 'draft') {
    throw new ValidasiError('Hanya tagihan berstatus draft yang dapat dibatalkan')
  }
  await db.update(vendorBills)
    .set({ status: 'dibatalkan', diubahPada: new Date() })
    .where(eq(vendorBills.id, id))
}

export async function hapusTagihan(id: string): Promise<void> {
  const tagihan = await ambilTagihan(id)
  if (!tagihan) throw new ValidasiError('Tagihan tidak ditemukan')
  if (tagihan.status === 'diposting') {
    throw new ValidasiError(
      'Tagihan yang sudah diposting tidak dapat dihapus karena jurnalnya sudah tercatat.',
    )
  }
  await db.delete(vendorBills).where(eq(vendorBills.id, id))
}

/** Tagihan terposting yang masih menyisakan kewajiban pembayaran. */
export async function tagihanBelumLunas(partnerId?: string): Promise<RingkasanTagihan[]> {
  const syarat = [eq(vendorBills.status, 'diposting')]
  if (partnerId) syarat.push(eq(vendorBills.partnerId, partnerId))

  const daftar = await db.select().from(vendorBills).where(and(...syarat))
    .orderBy(asc(vendorBills.tanggal))

  const hasil: RingkasanTagihan[] = []
  for (const t of daftar) {
    const ringkasan = await ringkasanTagihan(t.id)
    if (ringkasan && Number(ringkasan.sisa) > 0) hasil.push(ringkasan)
  }
  return hasil
}

export { hitungJatuhTempo, tambah }
