import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import {
  customerInvoices, customerInvoiceLines, salesOrderLines,
  taxes, accounts, partners,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, kurang, type Uang } from '@/lib/uang'
import { ambilNomorBerikut } from '@/modules/akuntansi/layanan/urutan'
import { postingJurnalDalamTx } from '@/modules/akuntansi/layanan/entri'
import {
  jurnalUntukDalamTx, PEMETAAN_JURNAL,
} from '@/modules/akuntansi/layanan/pemetaan'
import { hitungTotal } from '@/modules/akuntansi/layanan/hitung-dokumen'
import type { HasilTotal } from '@/modules/akuntansi/layanan/hitung-dokumen'
import { skemaFaktur, type MasukanFaktur } from '../validasi/pesanan'
import { hitungTotalDariBaris, perbaruiStatusPenyelesaian } from './pesanan'

export type Faktur = typeof customerInvoices.$inferSelect
export type BarisFaktur = typeof customerInvoiceLines.$inferSelect
export type FakturLengkap = Faktur & { baris: BarisFaktur[] }

const DESIMAL = 2
const KODE_URUTAN: Record<Faktur['tipe'], string> = {
  faktur: 'penjualan:faktur',
  nota_kredit: 'penjualan:nota-kredit',
}

function urai(masukan: MasukanFaktur) {
  const hasil = skemaFaktur.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

// ── Pembacaan ────────────────────────────────────────────────────────────────

export async function daftarFaktur(
  saring: { tipe?: Faktur['tipe']; status?: Faktur['status'] } = {},
): Promise<Faktur[]> {
  const syarat = [
    saring.tipe ? eq(customerInvoices.tipe, saring.tipe) : undefined,
    saring.status ? eq(customerInvoices.status, saring.status) : undefined,
  ].filter(Boolean)

  const kueri = db.select().from(customerInvoices)
    .orderBy(desc(customerInvoices.tanggal), desc(customerInvoices.dibuatPada))
  return syarat.length > 0 ? kueri.where(and(...syarat)) : kueri
}

export async function ambilFaktur(id: string): Promise<FakturLengkap | null> {
  const [faktur] = await db.select().from(customerInvoices)
    .where(eq(customerInvoices.id, id)).limit(1)
  if (!faktur) return null
  const baris = await db.select().from(customerInvoiceLines)
    .where(eq(customerInvoiceLines.invoiceId, id))
    .orderBy(asc(customerInvoiceLines.urutan))
  return { ...faktur, baris }
}

export async function totalFaktur(id: string): Promise<HasilTotal> {
  const faktur = await ambilFaktur(id)
  if (!faktur) throw new ValidasiError('Faktur tidak ditemukan')
  return hitungTotalDariBaris(faktur.baris)
}

export async function jumlahDiterima(invoiceId: string): Promise<Uang> {
  const hasil = await db.execute<{ jumlah: string }>(sql`
    SELECT COALESCE(SUM(a.jumlah), 0)::text AS jumlah
    FROM customer_payment_allocations a
    JOIN customer_payments p ON p.id = a.pembayaran_id
    WHERE a.invoice_id = ${invoiceId} AND p.status = 'diposting'
  `)
  const baris = (hasil as unknown as { jumlah: string }[])[0]
  return Number(baris?.jumlah ?? 0).toFixed(DESIMAL)
}

export type RingkasanFaktur = Faktur & {
  totalTagihan: Uang
  totalDiterima: Uang
  terbayar: Uang
  sisa: Uang
}

export async function ringkasanFaktur(id: string): Promise<RingkasanFaktur | null> {
  const faktur = await ambilFaktur(id)
  if (!faktur) return null
  const total = await hitungTotalDariBaris(faktur.baris)
  const terbayar = await jumlahDiterima(id)
  return {
    ...faktur,
    totalTagihan: total.totalTagihan,
    totalDiterima: total.totalDibayar,
    terbayar,
    sisa: bulatkan(kurang(total.totalDibayar, terbayar), DESIMAL),
  }
}

export async function fakturBelumLunas(partnerId?: string): Promise<RingkasanFaktur[]> {
  const syarat = [eq(customerInvoices.status, 'diposting')]
  if (partnerId) syarat.push(eq(customerInvoices.partnerId, partnerId))

  const daftar = await db.select().from(customerInvoices).where(and(...syarat))
    .orderBy(asc(customerInvoices.tanggal))

  const hasil: RingkasanFaktur[] = []
  for (const f of daftar) {
    const ringkasan = await ringkasanFaktur(f.id)
    if (ringkasan && Number(ringkasan.sisa) > 0) hasil.push(ringkasan)
  }
  return hasil
}

// ── Penulisan ────────────────────────────────────────────────────────────────

export async function buatFaktur(
  masukan: MasukanFaktur, dibuatOleh: string,
): Promise<FakturLengkap> {
  const data = urai(masukan)

  const id = await db.transaction(async (tx) => {
    const [faktur] = await tx.insert(customerInvoices).values({
      tipe: data.tipe,
      status: 'draft',
      partnerId: data.partnerId,
      soId: data.soId,
      tanggal: data.tanggal,
      tanggalJatuhTempo: data.tanggalJatuhTempo,
      referensi: data.referensi,
      mataUangId: data.mataUangId,
      catatan: data.catatan,
      dibuatOleh,
    }).returning({ id: customerInvoices.id })

    await tx.insert(customerInvoiceLines).values(
      data.baris.map((b, i) => ({
        invoiceId: faktur.id,
        urutan: i + 1,
        produkId: b.produkId,
        soLineId: b.soLineId,
        deskripsi: b.deskripsi,
        kuantitas: b.kuantitas,
        uomId: b.uomId,
        hargaSatuan: b.hargaSatuan,
        taxId: b.taxId,
        akunId: b.akunId,
      })),
    )

    return faktur.id
  })

  return (await ambilFaktur(id))!
}

export async function ubahFaktur(id: string, masukan: MasukanFaktur): Promise<FakturLengkap> {
  const data = urai(masukan)
  const lama = await ambilFaktur(id)
  if (!lama) throw new ValidasiError('Faktur tidak ditemukan')
  if (lama.status !== 'draft') {
    throw new ValidasiError(
      'Faktur yang sudah diposting tidak dapat diubah. Buat nota kredit untuk mengoreksinya.',
    )
  }

  await db.transaction(async (tx) => {
    await tx.update(customerInvoices).set({
      tipe: data.tipe,
      partnerId: data.partnerId,
      soId: data.soId,
      tanggal: data.tanggal,
      tanggalJatuhTempo: data.tanggalJatuhTempo,
      referensi: data.referensi,
      mataUangId: data.mataUangId,
      catatan: data.catatan,
      diubahPada: new Date(),
    }).where(eq(customerInvoices.id, id))

    await tx.delete(customerInvoiceLines).where(eq(customerInvoiceLines.invoiceId, id))
    await tx.insert(customerInvoiceLines).values(
      data.baris.map((b, i) => ({
        invoiceId: id,
        urutan: i + 1,
        produkId: b.produkId,
        soLineId: b.soLineId,
        deskripsi: b.deskripsi,
        kuantitas: b.kuantitas,
        uomId: b.uomId,
        hargaSatuan: b.hargaSatuan,
        taxId: b.taxId,
        akunId: b.akunId,
      })),
    )
  })

  return (await ambilFaktur(id))!
}

/** Akun piutang usaha: milik mitra bila diatur, jika tidak akun bertipe piutang. */
export async function akunPiutangUsaha(tx: Transaksi, partnerId: string): Promise<string> {
  const [mitra] = await tx.select().from(partners).where(eq(partners.id, partnerId)).limit(1)
  if (mitra?.akunPiutangId) return mitra.akunPiutangId

  const [akun] = await tx.select().from(accounts)
    .where(and(eq(accounts.tipeAkun, 'aset_piutang'), eq(accounts.isActive, true)))
    .orderBy(asc(accounts.kode)).limit(1)
  if (!akun) {
    throw new ValidasiError(
      'Tidak ada akun bertipe Piutang Usaha di bagan akun. Tambahkan terlebih dahulu.',
    )
  }
  return akun.id
}

/**
 * Memposting faktur penjualan.
 *
 * Pendapatan dikredit sebesar dasar pengenaan pajak dan PPN Keluaran dikredit
 * tersendiri sebagai utang pajak. Bila pelanggan memotong PPh, potongan itu
 * didebit ke akun pajak dibayar di muka dan piutang berkurang sebesarnya —
 * nilai fakturnya tidak berubah, yang berkurang adalah kas yang akan diterima.
 */
export async function postingFaktur(
  id: string, olehPengguna: string,
): Promise<FakturLengkap> {
  await db.transaction(async (tx) => {
    const [faktur] = await tx.select().from(customerInvoices)
      .where(eq(customerInvoices.id, id)).for('update').limit(1)

    if (!faktur) throw new ValidasiError('Faktur tidak ditemukan')
    if (faktur.status === 'diposting') throw new ValidasiError('Faktur ini sudah diposting')
    if (faktur.status === 'dibatalkan') {
      throw new ValidasiError('Faktur yang dibatalkan tidak dapat diposting')
    }

    const baris = await tx.select().from(customerInvoiceLines)
      .where(eq(customerInvoiceLines.invoiceId, id))
      .orderBy(asc(customerInvoiceLines.urutan))
    if (baris.length === 0) throw new ValidasiError('Faktur memerlukan minimal satu baris')

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

    // Nota kredit membalik seluruh arah faktur.
    const dibalik = faktur.tipe === 'nota_kredit'
    const sisiPendapatan = (n: Uang) => (dibalik ? { debit: n, kredit: '0' } : { debit: '0', kredit: n })
    const sisiPiutang = (n: Uang) => (dibalik ? { debit: '0', kredit: n } : { debit: n, kredit: '0' })

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
        partnerId: faktur.partnerId,
        label: b.deskripsi,
        ...sisiPendapatan(dpp),
        nilaiMataUang: null, taxId: b.taxId, projectId: null,
      })
    })

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

    // PPN Keluaran adalah utang pajak, jadi berada di sisi yang sama dengan pendapatan.
    for (const [akunId, { nilai, taxId }] of ppnPerAkun) {
      item.push({
        accountId: akunId,
        partnerId: faktur.partnerId,
        label: 'PPN Keluaran',
        ...sisiPendapatan(nilai.toFixed(DESIMAL)),
        nilaiMataUang: null, taxId, projectId: null,
      })
    }

    // PPh yang dipotong pelanggan mengurangi kas yang akan diterima, jadi
    // berada di sisi yang sama dengan piutang.
    for (const [akunId, { nilai, taxId }] of pemotonganPerAkun) {
      item.push({
        accountId: akunId,
        partnerId: faktur.partnerId,
        label: 'Pajak dipotong pelanggan',
        ...sisiPiutang(nilai.toFixed(DESIMAL)),
        nilaiMataUang: null, taxId, projectId: null,
      })
    }

    const piutangBersih = bulatkan(
      kurang(total.totalTagihan, total.totalPemotongan), DESIMAL,
    )
    if (Number(piutangBersih) !== 0) {
      item.push({
        accountId: await akunPiutangUsaha(tx, faktur.partnerId),
        partnerId: faktur.partnerId,
        label: dibalik ? 'Nota kredit kepada pelanggan' : 'Piutang kepada pelanggan',
        ...sisiPiutang(piutangBersih),
        nilaiMataUang: null, taxId: null, projectId: null,
      })
    }

    const journalId = await jurnalUntukDalamTx(tx, PEMETAAN_JURNAL.FAKTUR_PENJUALAN)

    const nomor = await ambilNomorBerikut(
      tx, KODE_URUTAN[faktur.tipe], new Date(`${faktur.tanggal}T00:00:00Z`),
    )

    const hasil = await postingJurnalDalamTx(tx, {
      journalId,
      tanggal: faktur.tanggal,
      referensi: faktur.referensi ?? nomor,
      keterangan: `${dibalik ? 'Nota kredit' : 'Faktur penjualan'} ${nomor}`,
      mataUangId: faktur.mataUangId,
      partnerId: faktur.partnerId,
      sumberTipe: `penjualan:${faktur.tipe}`,
      sumberId: id,
      item,
    }, olehPengguna)

    for (const b of baris) {
      if (!b.soLineId) continue
      const tanda = dibalik ? -1 : 1
      await tx.update(salesOrderLines)
        .set({
          kuantitasDifakturkan: sql`GREATEST(${salesOrderLines.kuantitasDifakturkan} + ${String(tanda * Number(b.kuantitas))}, 0)`,
        })
        .where(eq(salesOrderLines.id, b.soLineId))
    }

    await tx.update(customerInvoices).set({
      nomor,
      status: 'diposting',
      jurnalEntryId: hasil.id,
      dipostingPada: new Date(),
      dipostingOleh: olehPengguna,
      diubahPada: new Date(),
    }).where(eq(customerInvoices.id, id))
  })

  const faktur = (await ambilFaktur(id))!
  if (faktur.soId) await perbaruiStatusPenyelesaian(faktur.soId)
  return faktur
}

export async function batalkanFaktur(id: string): Promise<void> {
  const faktur = await ambilFaktur(id)
  if (!faktur) throw new ValidasiError('Faktur tidak ditemukan')
  if (faktur.status !== 'draft') {
    throw new ValidasiError('Hanya faktur berstatus draft yang dapat dibatalkan')
  }
  await db.update(customerInvoices)
    .set({ status: 'dibatalkan', diubahPada: new Date() })
    .where(eq(customerInvoices.id, id))
}

export async function hapusFaktur(id: string): Promise<void> {
  const faktur = await ambilFaktur(id)
  if (!faktur) throw new ValidasiError('Faktur tidak ditemukan')
  if (faktur.status === 'diposting') {
    throw new ValidasiError(
      'Faktur yang sudah diposting tidak dapat dihapus karena jurnalnya sudah tercatat.',
    )
  }
  await db.delete(customerInvoices).where(eq(customerInvoices.id, id))
}
