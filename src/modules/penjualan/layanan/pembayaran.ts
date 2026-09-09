import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  customerPayments, customerPaymentAllocations, accounts, journals,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, kurang, tambah } from '@/lib/uang'
import { ambilNomorBerikut } from '@/modules/akuntansi/layanan/urutan'
import { postingJurnalDalamTx } from '@/modules/akuntansi/layanan/entri'
import { rekonsiliasiOtomatisDalamTx } from '@/modules/akuntansi/layanan/rekonsiliasi'
import { skemaPembayaran, type MasukanPembayaran } from '../validasi/pesanan'
import { ringkasanFaktur, akunPiutangUsaha } from './faktur'

export type Pembayaran = typeof customerPayments.$inferSelect
export type AlokasiPembayaran = typeof customerPaymentAllocations.$inferSelect
export type PembayaranLengkap = Pembayaran & { alokasi: AlokasiPembayaran[] }

const DESIMAL = 2
const KODE_URUTAN = 'penjualan:pembayaran'

function urai(masukan: MasukanPembayaran) {
  const hasil = skemaPembayaran.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

export async function daftarPembayaran(): Promise<Pembayaran[]> {
  return db.select().from(customerPayments)
    .orderBy(desc(customerPayments.tanggal), desc(customerPayments.dibuatPada))
}

export async function ambilPembayaran(id: string): Promise<PembayaranLengkap | null> {
  const [pembayaran] = await db.select().from(customerPayments)
    .where(eq(customerPayments.id, id)).limit(1)
  if (!pembayaran) return null
  const alokasi = await db.select().from(customerPaymentAllocations)
    .where(eq(customerPaymentAllocations.pembayaranId, id))
  return { ...pembayaran, alokasi }
}

async function wajibAlokasiSah(data: ReturnType<typeof urai>): Promise<void> {
  const totalAlokasi = data.alokasi.reduce((t, a) => t + Number(a.jumlah), 0)
  if (totalAlokasi > Number(data.jumlah) + 0.001) {
    throw new ValidasiError(
      `Total alokasi ${totalAlokasi.toFixed(2)} melebihi jumlah penerimaan ${Number(data.jumlah).toFixed(2)}.`,
    )
  }

  for (const a of data.alokasi) {
    const ringkasan = await ringkasanFaktur(a.invoiceId)
    if (!ringkasan) throw new ValidasiError('Faktur yang dialokasikan tidak ditemukan')
    if (ringkasan.status !== 'diposting') {
      throw new ValidasiError(
        `Faktur ${ringkasan.nomor ?? ''} belum diposting sehingga belum dapat dilunasi.`,
      )
    }
    if (Number(a.jumlah) > Number(ringkasan.sisa) + 0.001) {
      throw new ValidasiError(
        `Alokasi ${Number(a.jumlah).toFixed(2)} ke faktur ${ringkasan.nomor} ` +
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
    const [pembayaran] = await tx.insert(customerPayments).values({
      status: 'draft',
      partnerId: data.partnerId,
      tanggal: data.tanggal,
      akunKasId: data.akunKasId,
      jumlah: data.jumlah,
      referensi: data.referensi,
      catatan: data.catatan,
      dibuatOleh,
    }).returning({ id: customerPayments.id })

    if (data.alokasi.length > 0) {
      await tx.insert(customerPaymentAllocations).values(
        data.alokasi.map((a) => ({
          pembayaranId: pembayaran.id, invoiceId: a.invoiceId, jumlah: a.jumlah,
        })),
      )
    }

    return pembayaran.id
  })

  return (await ambilPembayaran(id))!
}

/**
 * Memposting penerimaan dari pelanggan: Dr kas atau bank sebesar seluruh
 * penerimaan, Cr Piutang Usaha sebesar yang dialokasikan ke faktur. Kelebihan
 * yang belum dialokasikan dicatat sebagai uang muka penjualan.
 *
 * Setelah posting, item piutang mitra ini direkonsiliasi otomatis bila
 * seluruhnya sudah saling menutup.
 */
export async function postingPembayaran(
  id: string, olehPengguna: string,
): Promise<PembayaranLengkap> {
  await db.transaction(async (tx) => {
    const [pembayaran] = await tx.select().from(customerPayments)
      .where(eq(customerPayments.id, id)).for('update').limit(1)

    if (!pembayaran) throw new ValidasiError('Penerimaan tidak ditemukan')
    if (pembayaran.status === 'diposting') {
      throw new ValidasiError('Penerimaan ini sudah diposting')
    }
    if (pembayaran.status === 'dibatalkan') {
      throw new ValidasiError('Penerimaan yang dibatalkan tidak dapat diposting')
    }

    const alokasi = await tx.select().from(customerPaymentAllocations)
      .where(eq(customerPaymentAllocations.pembayaranId, id))

    const totalAlokasi = bulatkan(tambah(...alokasi.map((a) => a.jumlah), '0'), DESIMAL)
    const belumDialokasi = bulatkan(kurang(pembayaran.jumlah, totalAlokasi), DESIMAL)

    const item: {
      accountId: string; partnerId: string | null; label: string
      debit: string; kredit: string
      nilaiMataUang: null; taxId: null; projectId: null
    }[] = [{
      accountId: pembayaran.akunKasId,
      partnerId: pembayaran.partnerId,
      label: 'Penerimaan dari pelanggan',
      debit: pembayaran.jumlah, kredit: '0',
      nilaiMataUang: null, taxId: null, projectId: null,
    }]

    const akunPiutang = await akunPiutangUsaha(tx, pembayaran.partnerId)

    if (Number(totalAlokasi) > 0) {
      item.push({
        accountId: akunPiutang,
        partnerId: pembayaran.partnerId,
        label: 'Pelunasan piutang pelanggan',
        debit: '0', kredit: totalAlokasi,
        nilaiMataUang: null, taxId: null, projectId: null,
      })
    }

    if (Number(belumDialokasi) > 0) {
      const [uangMuka] = await tx.select().from(accounts)
        .where(and(eq(accounts.kode, '2131'), eq(accounts.isActive, true))).limit(1)
      if (!uangMuka) {
        throw new ValidasiError(
          'Penerimaan melebihi alokasi ke faktur, tetapi akun Uang Muka Penjualan (2131) tidak ditemukan.',
        )
      }
      item.push({
        accountId: uangMuka.id,
        partnerId: pembayaran.partnerId,
        label: 'Uang muka penjualan',
        debit: '0', kredit: belumDialokasi,
        nilaiMataUang: null, taxId: null, projectId: null,
      })
    }

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
      keterangan: `Penerimaan pelanggan ${nomor}`,
      mataUangId: 'IDR',
      partnerId: pembayaran.partnerId,
      sumberTipe: 'penjualan:pembayaran',
      sumberId: id,
      item,
    }, olehPengguna)

    await tx.update(customerPayments).set({
      nomor,
      status: 'diposting',
      jurnalEntryId: hasil.id,
      dipostingPada: new Date(),
      dipostingOleh: olehPengguna,
    }).where(eq(customerPayments.id, id))

    await rekonsiliasiOtomatisDalamTx(
      tx, akunPiutang, pembayaran.partnerId, pembayaran.tanggal, olehPengguna,
    )
  })

  return (await ambilPembayaran(id))!
}

export async function hapusPembayaran(id: string): Promise<void> {
  const pembayaran = await ambilPembayaran(id)
  if (!pembayaran) throw new ValidasiError('Penerimaan tidak ditemukan')
  if (pembayaran.status === 'diposting') {
    throw new ValidasiError(
      'Penerimaan yang sudah diposting tidak dapat dihapus karena jurnalnya sudah tercatat.',
    )
  }
  await db.delete(customerPayments).where(eq(customerPayments.id, id))
}

export async function akunKasDanBank() {
  return db.select().from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(asc(accounts.kode))
    .then((r) => r.filter((a) => a.tipeAkun === 'aset_kas' || a.tipeAkun === 'aset_bank'))
}
