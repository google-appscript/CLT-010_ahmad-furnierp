import { z } from 'zod'
import { DAFTAR_METODE } from './aset'

export const skemaKategoriAset = z.object({
  kode: z.string().trim().min(1, 'Kode kategori wajib diisi').max(30),
  nama: z.string().trim().min(1, 'Nama kategori wajib diisi').max(100),
  akunAsetId: z.uuid('Akun aset wajib dipilih'),
  akunAkumulasiId: z.uuid().nullable().default(null),
  akunBebanId: z.uuid().nullable().default(null),
  dapatDidepresiasi: z.boolean().default(true),
  metodeBawaan: z.enum(DAFTAR_METODE, { message: 'Metode depresiasi tidak dikenali' }),
  masaManfaatBulanBawaan: z.coerce.number().int()
    .min(1, 'Masa manfaat minimal satu bulan')
    .max(1200, 'Masa manfaat maksimal seribu dua ratus bulan'),
}).refine(
  (d) => !d.dapatDidepresiasi || (d.akunAkumulasiId !== null && d.akunBebanId !== null),
  {
    message: 'Kategori yang disusutkan wajib punya akun akumulasi dan akun beban depresiasi',
    path: ['akunAkumulasiId'],
  },
)

export type MasukanKategoriAset = z.input<typeof skemaKategoriAset>
