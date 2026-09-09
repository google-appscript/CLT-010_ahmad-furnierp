import { z } from 'zod'

const kuantitasPositif = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,6})?$/.test(v), { message: 'Kuantitas harus berupa angka' })
  .refine((v) => Number(v) > 0, { message: 'Kuantitas harus lebih besar dari nol' })

const hargaTidakNegatif = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,6})?$/.test(v), { message: 'Harga harus berupa angka' })

const tanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')

export const skemaBarisPesanan = z.object({
  produkId: z.uuid('Produk wajib dipilih'),
  deskripsi: z.string().trim().min(1, 'Deskripsi wajib diisi').max(200),
  kuantitas: kuantitasPositif,
  uomId: z.uuid('Satuan wajib dipilih'),
  hargaSatuan: hargaTidakNegatif,
  taxId: z.uuid().nullable().default(null),
})

export const skemaPesanan = z.object({
  partnerId: z.uuid('Pemasok wajib dipilih'),
  tanggal: tanggalIso,
  tanggalDiharapkan: tanggalIso.nullable().default(null),
  lokasiTujuanId: z.uuid('Lokasi tujuan wajib dipilih'),
  syaratPembayaranId: z.uuid().nullable().default(null),
  mataUangId: z.string().trim().length(3).default('IDR'),
  referensi: z.string().trim().max(100).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  catatan: z.string().trim().max(500).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  baris: z.array(skemaBarisPesanan).min(1, 'Pesanan memerlukan minimal satu baris produk'),
})

export const skemaBarisTagihan = z.object({
  produkId: z.uuid().nullable().default(null),
  poLineId: z.uuid().nullable().default(null),
  deskripsi: z.string().trim().min(1, 'Deskripsi wajib diisi').max(200),
  kuantitas: kuantitasPositif,
  uomId: z.uuid().nullable().default(null),
  hargaSatuan: hargaTidakNegatif,
  taxId: z.uuid().nullable().default(null),
  akunId: z.uuid('Akun wajib dipilih'),
})

export const skemaTagihan = z.object({
  tipe: z.enum(['tagihan', 'nota_debit'], { message: 'Tipe dokumen tidak dikenali' }).default('tagihan'),
  partnerId: z.uuid('Pemasok wajib dipilih'),
  poId: z.uuid().nullable().default(null),
  tanggal: tanggalIso,
  tanggalJatuhTempo: tanggalIso.nullable().default(null),
  referensiPemasok: z.string().trim().max(100).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  mataUangId: z.string().trim().length(3).default('IDR'),
  catatan: z.string().trim().max(500).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  baris: z.array(skemaBarisTagihan).min(1, 'Tagihan memerlukan minimal satu baris'),
})

export const skemaPembayaran = z.object({
  partnerId: z.uuid('Pemasok wajib dipilih'),
  tanggal: tanggalIso,
  akunKasId: z.uuid('Akun kas atau bank wajib dipilih'),
  jumlah: z.string().trim()
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), { message: 'Jumlah harus berupa angka' })
    .refine((v) => Number(v) > 0, { message: 'Jumlah pembayaran harus lebih besar dari nol' }),
  referensi: z.string().trim().max(100).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  catatan: z.string().trim().max(500).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  alokasi: z.array(z.object({
    billId: z.uuid(),
    jumlah: z.string().trim()
      .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), { message: 'Jumlah alokasi harus berupa angka' })
      .refine((v) => Number(v) > 0, { message: 'Jumlah alokasi harus lebih besar dari nol' }),
  })).default([]),
})

export type MasukanBarisPesanan = z.input<typeof skemaBarisPesanan>
export type MasukanPesanan = z.input<typeof skemaPesanan>
export type MasukanTagihan = z.input<typeof skemaTagihan>
export type MasukanPembayaran = z.input<typeof skemaPembayaran>

export const LABEL_STATUS_PEMBELIAN: Record<string, string> = {
  permintaan: 'Permintaan Penawaran',
  dikonfirmasi: 'Dikonfirmasi',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

export const LABEL_STATUS_TAGIHAN: Record<string, string> = {
  draft: 'Draft', diposting: 'Diposting', dibatalkan: 'Dibatalkan',
}

export const LABEL_TIPE_TAGIHAN: Record<string, string> = {
  tagihan: 'Tagihan Pembelian', nota_debit: 'Nota Debit',
}
