import { z } from 'zod'

export const KELOMPOK_TIPE_AKUN = [
  {
    label: 'Aset',
    tipe: [
      'aset_kas', 'aset_bank', 'aset_piutang', 'aset_persediaan', 'aset_lancar_lain',
      'aset_tetap', 'aset_akumulasi_depresiasi', 'aset_tidak_lancar_lain',
    ],
  },
  {
    label: 'Liabilitas',
    tipe: [
      'liabilitas_utang_usaha', 'liabilitas_pajak',
      'liabilitas_jangka_pendek', 'liabilitas_jangka_panjang',
    ],
  },
  { label: 'Ekuitas', tipe: ['ekuitas', 'ekuitas_laba_ditahan', 'ekuitas_laba_berjalan'] },
  { label: 'Pendapatan', tipe: ['pendapatan', 'pendapatan_lain'] },
  {
    label: 'Beban',
    tipe: ['beban_hpp', 'beban_operasional', 'beban_depresiasi', 'beban_lain', 'beban_pajak'],
  },
] as const

const LABEL_TIPE: Record<string, string> = {
  aset_kas: 'Kas',
  aset_bank: 'Bank',
  aset_piutang: 'Piutang Usaha',
  aset_persediaan: 'Persediaan',
  aset_lancar_lain: 'Aset Lancar Lainnya',
  aset_tetap: 'Aset Tetap',
  aset_akumulasi_depresiasi: 'Akumulasi Depresiasi',
  aset_tidak_lancar_lain: 'Aset Tidak Lancar Lainnya',
  liabilitas_utang_usaha: 'Utang Usaha',
  liabilitas_pajak: 'Utang Pajak',
  liabilitas_jangka_pendek: 'Liabilitas Jangka Pendek',
  liabilitas_jangka_panjang: 'Liabilitas Jangka Panjang',
  ekuitas: 'Modal',
  ekuitas_laba_ditahan: 'Laba Ditahan',
  ekuitas_laba_berjalan: 'Laba Tahun Berjalan',
  pendapatan: 'Pendapatan',
  pendapatan_lain: 'Pendapatan Lain-lain',
  beban_hpp: 'Harga Pokok Penjualan',
  beban_operasional: 'Beban Operasional',
  beban_depresiasi: 'Beban Depresiasi',
  beban_lain: 'Beban Lain-lain',
  beban_pajak: 'Beban Pajak Penghasilan',
}

export const SEMUA_TIPE_AKUN = KELOMPOK_TIPE_AKUN.flatMap((k) => k.tipe)

export function labelTipeAkun(tipe: string): string {
  return LABEL_TIPE[tipe] ?? tipe
}

export const skemaAkun = z.object({
  kode: z.string().trim()
    .min(1, 'Kode akun wajib diisi')
    .max(20, 'Kode akun maksimal 20 karakter')
    .regex(/^\S+$/, 'Kode akun tidak boleh memuat spasi'),
  nama: z.string().trim()
    .min(1, 'Nama akun wajib diisi')
    .max(120, 'Nama akun maksimal 120 karakter'),
  tipeAkun: z.enum(SEMUA_TIPE_AKUN as unknown as [string, ...string[]], {
    message: 'Tipe akun tidak dikenali',
  }),
  mataUangId: z.string().trim().length(3).nullable().default(null),
  dapatDirekonsiliasi: z.boolean().default(false),
  catatan: z.string().trim().max(500).nullable().default(null),
})

export type MasukanAkun = z.input<typeof skemaAkun>
