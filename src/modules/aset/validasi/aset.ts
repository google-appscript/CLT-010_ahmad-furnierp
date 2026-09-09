import { z } from 'zod'

const tanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')

const rupiahPositif = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), { message: 'Nilai harus berupa angka rupiah' })
  .refine((v) => Number(v) > 0, { message: 'Nilai harus lebih besar dari nol' })

const rupiahTidakNegatif = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), { message: 'Nilai harus berupa angka rupiah' })

export const DAFTAR_METODE = ['garis_lurus', 'saldo_menurun_ganda'] as const

export const skemaAset = z.object({
  kode: z.string().trim().min(1, 'Kode aset wajib diisi').max(30),
  nama: z.string().trim().min(1, 'Nama aset wajib diisi').max(150),
  kategoriId: z.uuid('Kategori aset wajib dipilih'),
  tanggalPerolehan: tanggalIso,
  tanggalMulaiDepresiasi: tanggalIso,
  nilaiPerolehan: rupiahPositif,
  nilaiResidu: rupiahTidakNegatif.default('0'),
  masaManfaatBulan: z.coerce.number().int()
    .min(1, 'Masa manfaat minimal satu bulan')
    .max(1200, 'Masa manfaat maksimal seribu dua ratus bulan'),
  metode: z.enum(DAFTAR_METODE, { message: 'Metode depresiasi tidak dikenali' }),
  partnerId: z.uuid().nullable().default(null),
  referensi: z.string().trim().max(100).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  catatan: z.string().trim().max(500).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
}).refine((d) => Number(d.nilaiResidu) < Number(d.nilaiPerolehan), {
  message: 'Nilai residu harus lebih kecil dari nilai perolehan',
  path: ['nilaiResidu'],
}).refine((d) => d.tanggalMulaiDepresiasi >= d.tanggalPerolehan, {
  message: 'Depresiasi tidak dapat dimulai sebelum aset diperoleh',
  path: ['tanggalMulaiDepresiasi'],
})

export const skemaPelepasan = z.object({
  tanggal: tanggalIso,
  nilaiPelepasan: rupiahTidakNegatif.default('0'),
  /** Wajib bila ada uang yang diterima; boleh kosong untuk pelepasan tanpa hasil. */
  akunPenerimaanId: z.uuid().nullable().default(null),
  catatan: z.string().trim().max(500).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
}).refine((d) => Number(d.nilaiPelepasan) === 0 || d.akunPenerimaanId !== null, {
  message: 'Akun penerimaan wajib dipilih bila pelepasan menghasilkan uang',
  path: ['akunPenerimaanId'],
})

export type MasukanAset = z.input<typeof skemaAset>
export type MasukanPelepasan = z.input<typeof skemaPelepasan>

export const LABEL_STATUS_ASET: Record<string, string> = {
  draft: 'Draft',
  berjalan: 'Berjalan',
  selesai: 'Selesai Disusutkan',
  dilepas: 'Dilepas',
}

export const LABEL_METODE: Record<string, string> = {
  garis_lurus: 'Garis Lurus',
  saldo_menurun_ganda: 'Saldo Menurun Ganda',
}
