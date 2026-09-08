import { z } from 'zod'

export const PANJANG_MINIMAL_SANDI = 8

export const skemaPengguna = z.object({
  email: z.string().trim().toLowerCase()
    .min(1, 'Email wajib diisi')
    .refine((v) => z.email().safeParse(v).success, { message: 'Format email tidak sah' }),
  nama: z.string().trim().min(1, 'Nama wajib diisi').max(120),
  peranId: z.uuid('Peran wajib dipilih'),
})

export const skemaPenggunaBaru = skemaPengguna.extend({
  kataSandi: z.string()
    .min(PANJANG_MINIMAL_SANDI, `Kata sandi minimal ${PANJANG_MINIMAL_SANDI} karakter`),
})

export type MasukanPengguna = z.input<typeof skemaPengguna>
export type MasukanPenggunaBaru = z.input<typeof skemaPenggunaBaru>
