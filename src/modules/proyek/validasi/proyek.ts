import { z } from 'zod'

const tanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')

const rupiahTidakNegatif = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), { message: 'Nilai harus berupa angka rupiah' })

const jamPositif = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), { message: 'Jam harus berupa angka' })
  .refine((v) => Number(v) > 0, { message: 'Jam harus lebih besar dari nol' })
  .refine((v) => Number(v) <= 24, { message: 'Jam dalam satu hari tidak boleh lebih dari 24' })

export const skemaProyek = z.object({
  kode: z.string().trim().min(1, 'Kode proyek wajib diisi').max(30),
  nama: z.string().trim().min(1, 'Nama proyek wajib diisi').max(150),
  soId: z.uuid('Pesanan penjualan wajib dipilih'),
  tanggalMulai: tanggalIso,
  tanggalTarget: tanggalIso.nullable().default(null),
  manajerId: z.uuid().nullable().default(null),
  tarifPerJam: rupiahTidakNegatif.default('0'),
  catatan: z.string().trim().max(500).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
}).refine(
  (d) => d.tanggalTarget === null || d.tanggalTarget >= d.tanggalMulai,
  { message: 'Target selesai tidak boleh mendahului tanggal mulai', path: ['tanggalTarget'] },
)

export const skemaTugas = z.object({
  proyekId: z.uuid('Proyek wajib dipilih'),
  nama: z.string().trim().min(1, 'Nama tugas wajib diisi').max(150),
  deskripsi: z.string().trim().max(1000).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  penanggungJawabId: z.uuid().nullable().default(null),
  tanggalMulai: tanggalIso.nullable().default(null),
  tenggat: tanggalIso.nullable().default(null),
  estimasiJam: rupiahTidakNegatif.default('0'),
}).refine(
  (d) => d.tenggat === null || d.tanggalMulai === null || d.tenggat >= d.tanggalMulai,
  { message: 'Tenggat tidak boleh mendahului tanggal mulai', path: ['tenggat'] },
)

export const skemaTimesheet = z.object({
  proyekId: z.uuid('Proyek wajib dipilih'),
  tugasId: z.uuid().nullable().default(null),
  penggunaId: z.uuid('Pelaksana wajib dipilih'),
  tanggal: tanggalIso,
  jam: jamPositif,
  deskripsi: z.string().trim().min(1, 'Uraian pekerjaan wajib diisi').max(300),
})

export type MasukanProyek = z.input<typeof skemaProyek>
export type MasukanTugas = z.input<typeof skemaTugas>
export type MasukanTimesheet = z.input<typeof skemaTimesheet>

export const LABEL_STATUS_PROYEK: Record<string, string> = {
  draft: 'Draft',
  berjalan: 'Berjalan',
  selesai: 'Selesai',
  terkunci: 'Terkunci',
  dibatalkan: 'Dibatalkan',
}

export const LABEL_STATUS_TUGAS: Record<string, string> = {
  belum_mulai: 'Belum Mulai',
  berjalan: 'Berjalan',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}
