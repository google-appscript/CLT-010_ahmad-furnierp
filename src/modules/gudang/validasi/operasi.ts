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
] as const

const LABEL_TIPE: Record<string, string> = {
  penerimaan: 'Penerimaan Barang',
  pengiriman: 'Pengiriman',
  transfer: 'Transfer Internal',
  barang_rusak: 'Barang Rusak',
  opname: 'Stock Opname',
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
