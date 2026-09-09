import { z } from 'zod'

const kuantitasPositif = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,6})?$/.test(v), {
    message: 'Kuantitas harus berupa angka dengan maksimal enam desimal',
  })
  .refine((v) => Number(v) > 0, { message: 'Kuantitas harus lebih besar dari nol' })

const hargaTidakNegatif = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,6})?$/.test(v), { message: 'Harga harus berupa angka' })

export const skemaBarisOperasi = z.object({
  produkId: z.uuid('Produk wajib dipilih'),
  kuantitas: kuantitasPositif,
  uomId: z.uuid('Satuan wajib dipilih'),
  hargaSatuan: hargaTidakNegatif.nullable().default(null),
  catatan: z.string().trim().max(200).nullable().default(null),
})

export const DAFTAR_TIPE_OPERASI = [
  'penerimaan', 'pengiriman', 'transfer', 'barang_rusak', 'opname',
  'konsumsi_produksi', 'hasil_produksi',
] as const

/**
 * Tipe yang boleh dibuat langsung dari menu gudang. Konsumsi dan hasil
 * produksi sengaja tidak ada di sini: keduanya selalu lahir berpasangan dari
 * sebuah perintah produksi, dan membuat salah satunya sendiri akan meninggalkan
 * saldo Barang Dalam Proses yang tidak pernah tertutup.
 */
export const TIPE_OPERASI_MANUAL = [
  'penerimaan', 'pengiriman', 'transfer', 'barang_rusak', 'opname',
] as const

export function dapatDibuatManual(tipe: string): boolean {
  return (TIPE_OPERASI_MANUAL as readonly string[]).includes(tipe)
}

const LABEL_TIPE: Record<string, string> = {
  penerimaan: 'Penerimaan Barang',
  pengiriman: 'Pengiriman',
  transfer: 'Transfer Internal',
  barang_rusak: 'Barang Rusak',
  opname: 'Stock Opname',
  konsumsi_produksi: 'Konsumsi Produksi',
  hasil_produksi: 'Hasil Produksi',
}

export function labelTipeOperasi(tipe: string): string {
  return LABEL_TIPE[tipe] ?? tipe
}

export const LABEL_STATUS_OPERASI: Record<string, string> = {
  draft: 'Draft',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

export const skemaOperasi = z.object({
  tipe: z.enum(DAFTAR_TIPE_OPERASI, { message: 'Tipe operasi tidak dikenali' }),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  lokasiAsalId: z.uuid('Lokasi asal wajib dipilih'),
  lokasiTujuanId: z.uuid('Lokasi tujuan wajib dipilih'),
  partnerId: z.uuid().nullable().default(null),
  referensi: z.string().trim().max(100).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  catatan: z.string().trim().max(500).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  baris: z.array(skemaBarisOperasi).min(1, 'Operasi memerlukan minimal satu baris produk'),
}).refine((d) => d.lokasiAsalId !== d.lokasiTujuanId, {
  message: 'Lokasi asal dan lokasi tujuan tidak boleh sama',
  path: ['lokasiTujuanId'],
})

export type MasukanBarisOperasi = z.input<typeof skemaBarisOperasi>
export type MasukanOperasi = z.input<typeof skemaOperasi>

export const skemaPackingList = z.object({
  operasiId: z.uuid('Pengiriman wajib dipilih'),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  catatan: z.string().trim().max(500).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  item: z.array(z.object({
    nomorKoli: z.string().trim().min(1, 'Nomor koli wajib diisi').max(30),
    produkId: z.uuid('Produk wajib dipilih'),
    kuantitas: kuantitasPositif,
    beratKg: z.string().trim().nullable().default(null)
      .transform((v) => (v === '' ? null : v)),
    catatan: z.string().trim().max(200).nullable().default(null),
  })).min(1, 'Packing list memerlukan minimal satu koli'),
})

export type MasukanPackingList = z.input<typeof skemaPackingList>

/**
 * Peta antara segmen URL dan nilai enum. Rute memakai tanda hubung agar enak
 * dibaca, sementara basis data memakai garis bawah.
 */
export const SLUG_KE_TIPE: Record<string, (typeof DAFTAR_TIPE_OPERASI)[number]> = {
  'penerimaan': 'penerimaan',
  'pengiriman': 'pengiriman',
  'transfer': 'transfer',
  'barang-rusak': 'barang_rusak',
  'opname': 'opname',
  'konsumsi-produksi': 'konsumsi_produksi',
  'hasil-produksi': 'hasil_produksi',
}

export const TIPE_KE_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_KE_TIPE).map(([slug, tipe]) => [tipe, slug]),
)

/** Lokasi asal dan tujuan bawaan untuk setiap tipe operasi. */
export const ARAH_BAWAAN: Record<string, { asal: string; tujuan: string }> = {
  penerimaan: { asal: 'pemasok', tujuan: 'internal' },
  pengiriman: { asal: 'internal', tujuan: 'pelanggan' },
  transfer: { asal: 'internal', tujuan: 'internal' },
  barang_rusak: { asal: 'internal', tujuan: 'rusak' },
  opname: { asal: 'penyesuaian', tujuan: 'internal' },
  konsumsi_produksi: { asal: 'internal', tujuan: 'produksi' },
  hasil_produksi: { asal: 'produksi', tujuan: 'internal' },
}

export const DESKRIPSI_TIPE: Record<string, string> = {
  penerimaan: 'Barang masuk dari pemasok ke gudang. Harga satuan yang dimasukkan memperbarui harga pokok rata-rata.',
  pengiriman: 'Barang keluar dari gudang ke pelanggan, dibebankan pada harga pokok rata-rata yang berlaku.',
  transfer: 'Perpindahan antar lokasi internal. Stok perusahaan tidak berubah sehingga tidak menghasilkan jurnal.',
  barang_rusak: 'Barang dikeluarkan dari gudang dan dibebankan sebagai kerugian barang rusak.',
  opname: 'Masukkan hasil hitung fisik. Sistem membukukan selisihnya terhadap stok tercatat.',
  konsumsi_produksi: 'Bahan keluar dari gudang menuju lokasi virtual Produksi dan menambah saldo Barang Dalam Proses. Dokumen ini dibuat oleh perintah produksi.',
  hasil_produksi: 'Barang jadi masuk dari lokasi virtual Produksi ke gudang dan mengosongkan saldo Barang Dalam Proses perintah produksinya.',
}
