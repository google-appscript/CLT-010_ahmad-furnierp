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
  partnerId: z.uuid('Pelanggan wajib dipilih'),
  tanggal: tanggalIso,
  tanggalPengiriman: tanggalIso.nullable().default(null),
  lokasiAsalId: z.uuid('Gudang asal wajib dipilih'),
  syaratPembayaranId: z.uuid().nullable().default(null),
  mataUangId: z.string().trim().length(3).default('IDR'),
  referensi: z.string().trim().max(100).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  catatan: z.string().trim().max(500).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  baris: z.array(skemaBarisPesanan).min(1, 'Pesanan memerlukan minimal satu baris produk'),
})

export const skemaBarisFaktur = z.object({
  produkId: z.uuid().nullable().default(null),
  soLineId: z.uuid().nullable().default(null),
  deskripsi: z.string().trim().min(1, 'Deskripsi wajib diisi').max(200),
  kuantitas: kuantitasPositif,
  uomId: z.uuid().nullable().default(null),
  hargaSatuan: hargaTidakNegatif,
  taxId: z.uuid().nullable().default(null),
  akunId: z.uuid('Akun pendapatan wajib dipilih'),
})

export const skemaFaktur = z.object({
  tipe: z.enum(['faktur', 'nota_kredit'], { message: 'Tipe dokumen tidak dikenali' })
    .default('faktur'),
  partnerId: z.uuid('Pelanggan wajib dipilih'),
  soId: z.uuid().nullable().default(null),
  tanggal: tanggalIso,
  tanggalJatuhTempo: tanggalIso.nullable().default(null),
  referensi: z.string().trim().max(100).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  mataUangId: z.string().trim().length(3).default('IDR'),
  catatan: z.string().trim().max(500).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  baris: z.array(skemaBarisFaktur).min(1, 'Faktur memerlukan minimal satu baris'),
})

export const skemaPembayaran = z.object({
  partnerId: z.uuid('Pelanggan wajib dipilih'),
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
    invoiceId: z.uuid(),
    jumlah: z.string().trim()
      .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), { message: 'Jumlah alokasi harus berupa angka' })
      .refine((v) => Number(v) > 0, { message: 'Jumlah alokasi harus lebih besar dari nol' }),
  })).default([]),
})

export type MasukanBarisPesanan = z.input<typeof skemaBarisPesanan>
export type MasukanPesanan = z.input<typeof skemaPesanan>
export type MasukanFaktur = z.input<typeof skemaFaktur>
export type MasukanPembayaran = z.input<typeof skemaPembayaran>

export const LABEL_STATUS_PENJUALAN: Record<string, string> = {
  penawaran: 'Penawaran',
  dikonfirmasi: 'Dikonfirmasi',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

export const LABEL_STATUS_FAKTUR: Record<string, string> = {
  draft: 'Draft', diposting: 'Diposting', dibatalkan: 'Dibatalkan',
}

export const LABEL_TIPE_FAKTUR: Record<string, string> = {
  faktur: 'Faktur Penjualan', nota_kredit: 'Nota Kredit',
}
