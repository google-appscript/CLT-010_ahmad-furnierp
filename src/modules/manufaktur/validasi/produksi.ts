import { z } from 'zod'

const kuantitasPositif = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,6})?$/.test(v), {
    message: 'Kuantitas harus berupa angka dengan maksimal enam desimal',
  })
  .refine((v) => Number(v) > 0, { message: 'Kuantitas harus lebih besar dari nol' })

const rupiahTidakNegatif = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), { message: 'Biaya harus berupa angka rupiah' })

const tanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')

export const skemaBarisBom = z.object({
  produkId: z.uuid('Bahan wajib dipilih'),
  kuantitas: kuantitasPositif,
  uomId: z.uuid('Satuan wajib dipilih'),
  catatan: z.string().trim().max(200).nullable().default(null),
})

export const skemaBom = z.object({
  kode: z.string().trim().min(1, 'Kode resep wajib diisi').max(30),
  nama: z.string().trim().min(1, 'Nama resep wajib diisi').max(150),
  produkId: z.uuid('Produk hasil wajib dipilih'),
  kuantitas: kuantitasPositif,
  uomId: z.uuid('Satuan wajib dipilih'),
  catatan: z.string().trim().max(500).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  baris: z.array(skemaBarisBom).min(1, 'Resep memerlukan minimal satu bahan'),
})

export const skemaBarisPerintahProduksi = z.object({
  produkId: z.uuid('Bahan wajib dipilih'),
  kuantitas: kuantitasPositif,
  uomId: z.uuid('Satuan wajib dipilih'),
  catatan: z.string().trim().max(200).nullable().default(null),
})

export const skemaPerintahProduksi = z.object({
  produkId: z.uuid('Produk yang diproduksi wajib dipilih'),
  bomId: z.uuid().nullable().default(null),
  kuantitas: kuantitasPositif,
  uomId: z.uuid('Satuan wajib dipilih'),
  tanggal: tanggalIso,
  tanggalTarget: tanggalIso.nullable().default(null),
  lokasiSumberId: z.uuid('Gudang bahan wajib dipilih'),
  lokasiTujuanId: z.uuid('Gudang barang jadi wajib dipilih'),
  biayaTenagaKerja: rupiahTidakNegatif.default('0'),
  biayaOverhead: rupiahTidakNegatif.default('0'),
  referensi: z.string().trim().max(100).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  catatan: z.string().trim().max(500).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  baris: z.array(skemaBarisPerintahProduksi).min(1, 'Perintah produksi memerlukan minimal satu bahan'),
}).refine((d) => d.lokasiSumberId !== d.lokasiTujuanId, {
  message: 'Gudang bahan dan gudang barang jadi tidak boleh sama',
  path: ['lokasiTujuanId'],
})

export type MasukanBarisBom = z.input<typeof skemaBarisBom>
export type MasukanBom = z.input<typeof skemaBom>
export type MasukanBarisPerintahProduksi = z.input<typeof skemaBarisPerintahProduksi>
export type MasukanPerintahProduksi = z.input<typeof skemaPerintahProduksi>

export const LABEL_STATUS_PERINTAH_PRODUKSI: Record<string, string> = {
  draft: 'Draft',
  dikonfirmasi: 'Dikonfirmasi',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}
