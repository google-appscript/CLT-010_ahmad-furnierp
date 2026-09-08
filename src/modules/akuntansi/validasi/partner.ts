import { z } from 'zod'

/** Membuang titik, strip, dan spasi dari NPWP agar tersimpan sebagai angka saja. */
export function normalkanNpwp(teks: string): string {
  return teks.replace(/[^0-9]/g, '')
}

const teksOpsional = z.string().trim().max(200).nullable().default(null)
  .transform((v) => (v === '' ? null : v))

export const skemaPartner = z.object({
  kode: z.string().trim().min(1, 'Kode mitra wajib diisi').max(20, 'Kode mitra maksimal 20 karakter'),
  nama: z.string().trim().min(1, 'Nama mitra wajib diisi').max(150, 'Nama mitra maksimal 150 karakter'),
  tipe: z.enum(['perorangan', 'badan'], { message: 'Tipe mitra tidak dikenali' }),
  isPelanggan: z.boolean().default(false),
  isPemasok: z.boolean().default(false),
  npwp: z.string().nullable().default(null)
    .transform((v) => (v ? normalkanNpwp(v) : null))
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || v.length === 15 || v.length === 16, {
      message: 'NPWP harus 15 atau 16 digit',
    }),
  nik: z.string().nullable().default(null)
    .transform((v) => (v ? v.replace(/[^0-9]/g, '') : null))
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || v.length === 16, { message: 'NIK harus 16 digit' }),
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
  kontakPerson: teksOpsional,
  syaratPembayaranId: z.uuid().nullable().default(null),
  akunPiutangId: z.uuid().nullable().default(null),
  akunUtangId: z.uuid().nullable().default(null),
}).refine((d) => d.isPelanggan || d.isPemasok, {
  message: 'Mitra harus ditandai sebagai pelanggan, pemasok, atau keduanya',
  path: ['isPelanggan'],
})

export type MasukanPartner = z.input<typeof skemaPartner>
