import { z } from 'zod'

const tanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')

const persentase = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,4})?$/.test(v), { message: 'Persentase harus berupa angka' })
  .refine((v) => Number(v) > 0, { message: 'Persentase harus lebih besar dari nol' })
  .refine((v) => Number(v) <= 100, { message: 'Persentase tidak boleh lebih dari 100' })

export const skemaPemilik = z.object({
  kode: z.string().trim().min(1, 'Kode pemilik wajib diisi').max(30),
  nama: z.string().trim().min(1, 'Nama pemilik wajib diisi').max(150),
  akunModalId: z.uuid('Akun modal wajib dipilih'),
  akunPriveId: z.uuid().nullable().default(null),
  catatan: z.string().trim().max(300).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
})

export const skemaSusunanKepemilikan = z.object({
  nama: z.string().trim().min(1, 'Nama susunan wajib diisi').max(100),
  tanggalMulai: tanggalIso,
  tanggalSelesai: tanggalIso.nullable().default(null),
  catatan: z.string().trim().max(300).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  porsi: z.array(z.object({
    ownerId: z.uuid('Pemilik wajib dipilih'),
    persentase,
  })).min(1, 'Susunan kepemilikan memerlukan minimal satu pemilik'),
}).refine(
  (d) => d.tanggalSelesai === null || d.tanggalSelesai >= d.tanggalMulai,
  { message: 'Tanggal selesai tidak boleh mendahului tanggal mulai', path: ['tanggalSelesai'] },
)

export type MasukanPemilik = z.input<typeof skemaPemilik>
export type MasukanSusunanKepemilikan = z.input<typeof skemaSusunanKepemilikan>

export const LABEL_PERIODE_BAGI_HASIL: Record<string, string> = {
  bulanan: 'Bulanan',
  kuartalan: 'Kuartalan',
  tahunan: 'Tahunan',
}
