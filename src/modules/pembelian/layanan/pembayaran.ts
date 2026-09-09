import { and, asc, desc, eq } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import {
  vendorPayments, vendorPaymentAllocations, vendorBills,
  accounts, partners, journals,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, kurang, tambah } from '@/lib/uang'
import { ambilNomorBerikut } from '@/modules/akuntansi/layanan/urutan'
import { postingJurnalDalamTx } from '@/modules/akuntansi/layanan/entri'
import { skemaPembayaran, type MasukanPembayaran } from '../validasi/pesanan'
import { ringkasanTagihan } from './tagihan'

export type Pembayaran = typeof vendorPayments.$inferSelect
export type AlokasiPembayaran = typeof vendorPaymentAllocations.$inferSelect
export type PembayaranLengkap = Pembayaran & { alokasi: AlokasiPembayaran[] }

const DESIMAL = 2
const KODE_URUTAN = 'pembelian:pembayaran'

function urai(masukan: MasukanPembayaran) {
  const hasil = skemaPembayaran.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

export async function daftarPembayaran(): Promise<Pembayaran[]> {
  return db.select().from(vendorPayments)
    .orderBy(desc(vendorPayments.tanggal), desc(vendorPayments.dibuatPada))
}

export async function ambilPembayaran(id: string): Promise<PembayaranLengkap | null> {
  const [pembayaran] = await db.select().from(vendorPayments)
    .where(eq(vendorPayments.id, id)).limit(1)
  if (!pembayaran) return null
  const alokasi = await db.select().from(vendorPaymentAllocations)
    .where(eq(vendorPaymentAllocations.pembayaranId, id))
  return { ...pembayaran, alokasi }
}

async function akunUtangUsaha(tx: Transaksi, partnerId: string): Promise<string> {
  const [mitra] = await tx.select().from(partners).where(eq(partners.id, partnerId)).limit(1)
  if (mitra?.akunUtangId) return mitra.akunUtangId

  const [akun] = await tx.select().from(accounts)
    .where(and(eq(accounts.tipeAkun, 'liabilitas_utang_usaha'), eq(accounts.isActive, true)))
    .orderBy(asc(accounts.kode)).limit(1)
  if (!akun) throw new ValidasiError('Tidak ada akun bertipe Utang Usaha di bagan akun')
  return akun.id
}

/**
 * Alokasi tidak boleh melebihi jumlah pembayaran maupun sisa tagihan.
 * Tanpa pemeriksaan ini, utang usaha bisa terdebit lebih besar daripada kas
 * yang benar-benar keluar.
 */
async function wajibAlokasiSah(
  data: ReturnType<typeof urai>,
): Promise<void> {
  const totalAlokasi = data.alokasi.reduce((t, a) => t + Number(a.jumlah), 0)
  if (totalAlokasi > Number(data.jumlah) + 0.001) {
    throw new ValidasiError(
      `Total alokasi ${totalAlokasi.toFixed(2)} melebihi jumlah pembayaran ${Number(data.jumlah).toFixed(2)}.`,
    )
  }

  for (const a of data.alokasi) {
    const ringkasan = await ringkasanTagihan(a.billId)
    if (!ringkasan) throw new ValidasiError('Tagihan yang dialokasikan tidak ditemukan')
    if (ringkasan.status !== 'diposting') {
      throw new ValidasiError(
        `Tagihan ${ringkasan.nomor ?? ''} belum diposting sehingga belum dapat dibayar.`,
      )
    }
    if (Number(a.jumlah) > Number(ringkasan.sisa) + 0.001) {
      throw new ValidasiError(
        `Alokasi ${Number(a.jumlah).toFixed(2)} ke tagihan ${ringkasan.nomor} ` +
        `melebihi sisanya ${Number(ringkasan.sisa).toFixed(2)}.`,
      )
    }
  }
}

export async function buatPembayaran(
  masukan: MasukanPembayaran, dibuatOleh: string,
): Promise<PembayaranLengkap> {
  const data = urai(masukan)
  await wajibAlokasiSah(data)

  const id = await db.transaction(async (tx) => {
    const [pembayaran] = await tx.insert(vendorPayments).values({
      status: 'draft',
      partnerId: data.partnerId,
      tanggal: data.tanggal,
      akunKasId: data.akunKasId,
      jumlah: data.jumlah,
      referensi: data.referensi,
      catatan: data.catatan,
      dibuatOleh,
    }).returning({ id: vendorPayments.id })

    if (data.alokasi.length > 0) {
      await tx.insert(vendorPaymentAllocations).values(
        data.alokasi.map((a) => ({
          pembayaranId: pembayaran.id, billId: a.billId, jumlah: a.jumlah,
        })),
      )
    }

    return pembayaran.id
  })

  return (await ambilPembayaran(id))!
}

/**
 * Memposting pembayaran: Dr Utang Usaha sebesar yang dialokasikan ke tagihan,
 * Cr kas atau bank sebesar seluruh jumlah pembayaran. Selisih antara keduanya
 * — pembayaran yang belum dialokasikan — dicatat sebagai uang muka pembelian.
 */
export async function postingPembayaran(
  id: string, olehPengguna: string,
): Promise<PembayaranLengkap> {
  await db.transaction(async (tx) => {
    const [pembayaran] = await tx.select().from(vendorPayments)
      .where(eq(vendorPayments.id, id)).for('update').limit(1)

    if (!pembayaran) throw new ValidasiError('Pembayaran tidak ditemukan')
    if (pembayaran.status === 'diposting') {
      throw new ValidasiError('Pembayaran ini sudah diposting')
    }
    if (pembayaran.status === 'dibatalkan') {
      throw new ValidasiError('Pembayaran yang dibatalkan tidak dapat diposting')
    }

    const alokasi = await tx.select().from(vendorPaymentAllocations)
      .where(eq(vendorPaymentAllocations.pembayaranId, id))

    const totalAlokasi = bulatkan(
      tambah(...alokasi.map((a) => a.jumlah), '0'), DESIMAL,
    )
    const belumDialokasi = bulatkan(kurang(pembayaran.jumlah, totalAlokasi), DESIMAL)

    const item: {
      accountId: string; partnerId: string | null; label: string
      debit: string; kredit: string
      nilaiMataUang: null; taxId: null; projectId: null
    }[] = []

    if (Number(totalAlokasi) > 0) {
      item.push({
        accountId: await akunUtangUsaha(tx, pembayaran.partnerId),
        partnerId: pembayaran.partnerId,
        label: 'Pelunasan utang kepada pemasok',
        debit: totalAlokasi, kredit: '0',
        nilaiMataUang: null, taxId: null, projectId: null,
      })
    }

    if (Number(belumDialokasi) > 0) {
      const [uangMuka] = await tx.select().from(accounts)
        .where(and(eq(accounts.kode, '1151'), eq(accounts.isActive, true))).limit(1)
      if (!uangMuka) {
        throw new ValidasiError(
          'Pembayaran melebihi alokasi ke tagihan, tetapi akun Uang Muka Pembelian (1151) tidak ditemukan.',
        )
      }
      item.push({
        accountId: uangMuka.id,
        partnerId: pembayaran.partnerId,
        label: 'Uang muka pembelian',
        debit: belumDialokasi, kredit: '0',
        nilaiMataUang: null, taxId: null, projectId: null,
      })
    }

    item.push({
      accountId: pembayaran.akunKasId,
      partnerId: pembayaran.partnerId,
      label: 'Pembayaran kepada pemasok',
      debit: '0', kredit: pembayaran.jumlah,
      nilaiMataUang: null, taxId: null, projectId: null,
    })

    // Jurnal kas atau bank dipilih mengikuti tipe akun yang dikredit.
    const [akunKas] = await tx.select().from(accounts)
      .where(eq(accounts.id, pembayaran.akunKasId)).limit(1)
    const kodeJurnal = akunKas?.tipeAkun === 'aset_bank' ? 'BNK' : 'KAS'

    const [jurnal] = await tx.select().from(journals)
      .where(eq(journals.kode, kodeJurnal)).limit(1)
    if (!jurnal) {
      throw new ValidasiError(
        `Jurnal ${kodeJurnal} tidak ditemukan. Jalankan seed data awal terlebih dahulu.`,
      )
    }

    const nomor = await ambilNomorBerikut(
      tx, KODE_URUTAN, new Date(`${pembayaran.tanggal}T00:00:00Z`),
    )

    const hasil = await postingJurnalDalamTx(tx, {
      journalId: jurnal.id,
      tanggal: pembayaran.tanggal,
      referensi: pembayaran.referensi ?? nomor,
      keterangan: `Pembayaran pemasok ${nomor}`,
      mataUangId: 'IDR',
      partnerId: pembayaran.partnerId,
      sumberTipe: 'pembelian:pembayaran',
      sumberId: id,
      item,
    }, olehPengguna)

    await tx.update(vendorPayments).set({
      nomor,
      status: 'diposting',
      jurnalEntryId: hasil.id,
      dipostingPada: new Date(),
      dipostingOleh: olehPengguna,
    }).where(eq(vendorPayments.id, id))
  })

  return (await ambilPembayaran(id))!
}

export async function hapusPembayaran(id: string): Promise<void> {
  const pembayaran = await ambilPembayaran(id)
  if (!pembayaran) throw new ValidasiError('Pembayaran tidak ditemukan')
  if (pembayaran.status === 'diposting') {
    throw new ValidasiError(
      'Pembayaran yang sudah diposting tidak dapat dihapus karena jurnalnya sudah tercatat.',
    )
  }
  await db.delete(vendorPayments).where(eq(vendorPayments.id, id))
}

/** Akun kas dan bank yang dapat dipakai membayar. */
export async function akunKasDanBank() {
  return db.select().from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(asc(accounts.kode))
    .then((r) => r.filter((a) => a.tipeAkun === 'aset_kas' || a.tipeAkun === 'aset_bank'))
}

export { vendorBills }
