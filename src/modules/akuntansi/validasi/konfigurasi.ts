import { z } from 'zod'
import { normalkanNpwp } from './partner'

const tanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')

const teksOpsional = z.string().trim().max(200).nullable().default(null)
  .transform((v) => (v === '' ? null : v))

export const skemaKurs = z.object({
  kodeMataUang: z.string().trim().length(3, 'Kode mata uang harus 3 huruf'),
  tanggal: tanggalIso,
  kurs: z.string().trim()
    .refine((v) => /^\d+(\.\d+)?$/.test(v), { message: 'Kurs harus berupa angka' })
    .refine((v) => Number(v) > 0, { message: 'Kurs harus lebih besar dari nol' }),
})

export const skemaTahunBuku = z.object({
  nama: z.string().trim().min(1, 'Nama tahun buku wajib diisi').max(60),
  tanggalMulai: tanggalIso,
  tanggalSelesai: tanggalIso,
}).refine((d) => d.tanggalSelesai > d.tanggalMulai, {
  message: 'Tanggal selesai harus setelah tanggal mulai',
  path: ['tanggalSelesai'],
})

export const skemaPerusahaan = z.object({
  nama: z.string().trim().min(1, 'Nama perusahaan wajib diisi').max(150),
  npwp: z.string().nullable().default(null)
    .transform((v) => (v ? normalkanNpwp(v) : null))
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || v.length === 15 || v.length === 16, {
      message: 'NPWP harus 15 atau 16 digit',
    }),
  alamat: teksOpsional,
  kota: teksOpsional,
  provinsi: teksOpsional,
  kodePos: teksOpsional,
  telepon: teksOpsional,
  email: z.string().trim().nullable().default(null)
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || z.email().safeParse(v).success, {
      message: 'Format email tidak sah',
    }),
})

export type MasukanKurs = z.input<typeof skemaKurs>
export type MasukanTahunBuku = z.input<typeof skemaTahunBuku>
export type MasukanPerusahaan = z.input<typeof skemaPerusahaan>
