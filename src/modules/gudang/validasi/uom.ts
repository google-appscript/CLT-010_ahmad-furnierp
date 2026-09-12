import { z } from 'zod'

export const DAFTAR_KATEGORI_UOM = [
  'satuan', 'berat', 'panjang', 'luas', 'volume', 'waktu',
] as const

export const skemaUom = z.object({
  kode: z.string().trim().min(1, 'Kode satuan wajib diisi').max(20),
  nama: z.string().trim().min(1, 'Nama satuan wajib diisi').max(50),
  kategori: z.enum(DAFTAR_KATEGORI_UOM),
  faktor: z.string().refine((v) => Number(v) > 0, 'Faktor harus lebih besar dari nol'),
})

export type MasukanUom = z.input<typeof skemaUom>

export const LABEL_KATEGORI_UOM: Record<string, string> = {
  satuan: 'Satuan', berat: 'Berat', panjang: 'Panjang',
  luas: 'Luas', volume: 'Volume', waktu: 'Waktu',
}
