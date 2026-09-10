import { asc, eq } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import { journalMappings, journals, accounts, companySettings } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'

/**
 * Kode pemetaan jurnal. Setiap jenis posting otomatis punya satu kode, dan
 * kode inilah yang dipakai modul — bukan kode jurnalnya langsung — sehingga
 * memindahkan sebuah jenis posting ke jurnal lain cukup mengubah data.
 */
export const PEMETAAN_JURNAL = {
  STOK: 'gudang:stok',
  TAGIHAN_PEMBELIAN: 'pembelian:tagihan',
  PEMBAYARAN_KAS: 'pembayaran:kas',
  PEMBAYARAN_BANK: 'pembayaran:bank',
  FAKTUR_PENJUALAN: 'penjualan:faktur',
  BIAYA_PRODUKSI: 'manufaktur:biaya',
  DEPRESIASI: 'aset:depresiasi',
  PELEPASAN_ASET: 'aset:pelepasan',
  BAGI_HASIL: 'bagi-hasil:distribusi',
} as const

export type KodePemetaan = (typeof PEMETAAN_JURNAL)[keyof typeof PEMETAAN_JURNAL]

/**
 * Jurnal tujuan sebuah jenis posting. Dipanggil di dalam transaksi yang sama
 * dengan postingnya agar perubahan pemetaan tidak pernah terbaca separuh.
 */
export async function jurnalUntukDalamTx(
  tx: Transaksi, kode: KodePemetaan,
): Promise<string> {
  const [pemetaan] = await tx.select().from(journalMappings)
    .where(eq(journalMappings.kode, kode)).limit(1)
  if (!pemetaan) {
    throw new ValidasiError(
      `Pemetaan jurnal "${kode}" belum diatur. Lengkapi di Konfigurasi → Pemetaan Jurnal.`,
    )
  }

  const [jurnal] = await tx.select().from(journals)
    .where(eq(journals.id, pemetaan.journalId)).limit(1)
  if (!jurnal) throw new ValidasiError(`Jurnal untuk "${pemetaan.nama}" tidak ditemukan`)
  if (!jurnal.isActive) {
    throw new ValidasiError(
      `Jurnal ${jurnal.nama} sudah nonaktif, padahal masih dipakai untuk ${pemetaan.nama}.`,
    )
  }

  return jurnal.id
}

/** Jurnal kas atau bank, mengikuti tipe akun yang dipakai membayar. */
export async function jurnalPembayaranDalamTx(
  tx: Transaksi, akunKasId: string,
): Promise<string> {
  const [akun] = await tx.select().from(accounts)
    .where(eq(accounts.id, akunKasId)).limit(1)
  return jurnalUntukDalamTx(
    tx,
    akun?.tipeAkun === 'aset_bank'
      ? PEMETAAN_JURNAL.PEMBAYARAN_BANK
      : PEMETAAN_JURNAL.PEMBAYARAN_KAS,
  )
}

/**
 * Akun otomatis pada profil perusahaan — akun yang dipakai posting tertentu
 * tetapi tidak melekat pada kategori produk maupun kategori aset.
 */
export const AKUN_OTOMATIS = {
  akunPenerimaanBelumDitagihId: 'Penerimaan Barang Belum Ditagih',
  akunBarangDalamProsesId: 'Barang Dalam Proses',
  akunTenagaKerjaLangsungId: 'Tenaga Kerja Langsung',
  akunOverheadPabrikId: 'Overhead Pabrik',
  akunLabaPelepasanAsetId: 'Laba Pelepasan Aset',
  akunRugiPelepasanAsetId: 'Rugi Pelepasan Aset',
  akunPembulatanId: 'Selisih Pembulatan',
  akunLabaDitahanId: 'Laba Ditahan',
  akunLabaBerjalanId: 'Laba Tahun Berjalan',
} as const

export type BidangAkunOtomatis = keyof typeof AKUN_OTOMATIS

/**
 * Akun otomatis yang wajib ada untuk posting tertentu. Pesan galatnya
 * menyebut nama yang dikenal pengguna, bukan nama kolom.
 */
export async function akunOtomatisDalamTx(
  tx: Transaksi, bidang: BidangAkunOtomatis,
): Promise<string> {
  const [pengaturan] = await tx.select().from(companySettings).limit(1)
  const nilai = pengaturan?.[bidang]
  if (!nilai) {
    throw new ValidasiError(
      `Akun ${AKUN_OTOMATIS[bidang]} belum diatur. Lengkapi di Konfigurasi → Pemetaan Jurnal.`,
    )
  }
  return nilai
}

// ── Pembacaan untuk halaman konfigurasi ──────────────────────────────────────

export type BarisPemetaan = {
  id: string
  kode: string
  nama: string
  deskripsi: string | null
  journalId: string
  kodeJurnal: string
  namaJurnal: string
  jurnalAktif: boolean
}

export async function daftarPemetaanJurnal(): Promise<BarisPemetaan[]> {
  const baris = await db
    .select({
      id: journalMappings.id,
      kode: journalMappings.kode,
      nama: journalMappings.nama,
      deskripsi: journalMappings.deskripsi,
      journalId: journalMappings.journalId,
      kodeJurnal: journals.kode,
      namaJurnal: journals.nama,
      jurnalAktif: journals.isActive,
    })
    .from(journalMappings)
    .innerJoin(journals, eq(journals.id, journalMappings.journalId))
    .orderBy(asc(journalMappings.kode))
  return baris
}

export async function ubahPemetaanJurnal(id: string, journalId: string): Promise<void> {
  const [jurnal] = await db.select().from(journals)
    .where(eq(journals.id, journalId)).limit(1)
  if (!jurnal) throw new ValidasiError('Jurnal tidak ditemukan')
  if (!jurnal.isActive) {
    throw new ValidasiError(`Jurnal ${jurnal.nama} sudah nonaktif dan tidak dapat dipilih`)
  }

  await db.update(journalMappings)
    .set({ journalId, diubahPada: new Date() })
    .where(eq(journalMappings.id, id))
}

/** Menyimpan akun otomatis sekaligus; nilai kosong berarti dikosongkan. */
export async function simpanAkunOtomatis(
  nilai: Partial<Record<BidangAkunOtomatis, string | null>>,
): Promise<void> {
  const [pengaturan] = await db.select().from(companySettings).limit(1)
  if (!pengaturan) throw new ValidasiError('Pengaturan perusahaan belum dibuat')

  const idAkun = new Set(
    (await db.select({ id: accounts.id }).from(accounts)).map((a) => a.id),
  )
  for (const [bidang, id] of Object.entries(nilai)) {
    if (id && !idAkun.has(id)) {
      throw new ValidasiError(
        `Akun untuk ${AKUN_OTOMATIS[bidang as BidangAkunOtomatis]} tidak ditemukan`,
      )
    }
  }

  await db.update(companySettings)
    .set({ ...nilai, diubahPada: new Date() })
    .where(eq(companySettings.id, pengaturan.id))
}
