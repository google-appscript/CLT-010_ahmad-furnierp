import { z } from 'zod'

export const DAFTAR_TIPE_JURNAL = ['penjualan', 'pembelian', 'kas', 'bank', 'umum'] as const

const LABEL_TIPE: Record<string, string> = {
  penjualan: 'Penjualan',
  pembelian: 'Pembelian',
  kas: 'Kas',
  bank: 'Bank',
  umum: 'Umum',
}

export function labelTipeJurnal(tipe: string): string {
  return LABEL_TIPE[tipe] ?? tipe
}

export const skemaJurnal = z.object({
  kode: z.string().trim()
    .min(1, 'Kode jurnal wajib diisi')
    .max(10, 'Kode jurnal maksimal 10 karakter')
    .regex(/^\S+$/, 'Kode jurnal tidak boleh memuat spasi'),
  nama: z.string().trim().min(1, 'Nama jurnal wajib diisi').max(120),
  tipe: z.enum(DAFTAR_TIPE_JURNAL, { message: 'Tipe jurnal tidak dikenali' }),
  prefixNomor: z.string().trim()
    .min(1, 'Prefiks penomoran wajib diisi')
    .max(10, 'Prefiks penomoran maksimal 10 karakter'),
  resetNomor: z.enum(['tidak_pernah', 'tahunan', 'bulanan'], {
    message: 'Aturan reset penomoran tidak dikenali',
  }),
  akunDefaultDebitId: z.uuid().nullable().default(null),
  akunDefaultKreditId: z.uuid().nullable().default(null),
  mataUangId: z.string().trim().length(3).nullable().default(null),
})

export type MasukanJurnal = z.input<typeof skemaJurnal>
