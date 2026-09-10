import { z } from 'zod'

export const skemaKategoriProduk = z.object({
  kode: z.string().trim().min(1, 'Kode kategori wajib diisi').max(30),
  nama: z.string().trim().min(1, 'Nama kategori wajib diisi').max(100),
  akunPersediaanId: z.uuid('Akun persediaan wajib dipilih'),
  akunHppId: z.uuid('Akun harga pokok wajib dipilih'),
  akunSelisihId: z.uuid('Akun selisih opname wajib dipilih'),
  akunBarangRusakId: z.uuid('Akun barang rusak wajib dipilih'),
})

export type MasukanKategoriProduk = z.input<typeof skemaKategoriProduk>
