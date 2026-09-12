import { z } from 'zod'

export const DAFTAR_TIPE_PRODUK = ['disimpan', 'jasa', 'konsumsi'] as const

export const skemaProduk = z.object({
  kode: z.string().trim().min(1, 'Kode produk wajib diisi').max(30),
  nama: z.string().trim().min(1, 'Nama produk wajib diisi').max(150),
  tipe: z.enum(DAFTAR_TIPE_PRODUK),
  kategoriId: z.uuid('Kategori produk wajib dipilih'),
  uomId: z.uuid('Satuan wajib dipilih'),
  barcode: z.string().trim().max(50).nullable().default(null),
  hargaJual: z.string().refine((v) => Number(v) >= 0, 'Harga jual tidak boleh negatif'),
  catatan: z.string().trim().max(500).nullable().default(null),
})

export type MasukanProduk = z.input<typeof skemaProduk>

export const LABEL_TIPE_PRODUK: Record<string, string> = {
  disimpan: 'Disimpan', jasa: 'Jasa', konsumsi: 'Konsumsi',
}
