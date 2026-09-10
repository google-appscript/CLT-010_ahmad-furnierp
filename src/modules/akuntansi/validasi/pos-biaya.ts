import { z } from 'zod'

const persentase = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,4})?$/.test(v), { message: 'Persentase harus berupa angka' })
  .refine((v) => Number(v) > 0, { message: 'Persentase harus lebih besar dari nol' })
  .refine((v) => Number(v) <= 100, { message: 'Persentase tidak boleh lebih dari 100' })

export const skemaPosBiaya = z.object({
  kode: z.string().trim().min(1, 'Kode pos biaya wajib diisi').max(30),
  nama: z.string().trim().min(1, 'Nama pos biaya wajib diisi').max(100),
  deskripsi: z.string().trim().max(300).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
})

export const skemaAlokasiBiaya = z.object({
  costCenterId: z.uuid('Pos biaya wajib dipilih'),
  persentase,
})

export type MasukanPosBiaya = z.input<typeof skemaPosBiaya>
export type MasukanAlokasiBiaya = z.input<typeof skemaAlokasiBiaya>
