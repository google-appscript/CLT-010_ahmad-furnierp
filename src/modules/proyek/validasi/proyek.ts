import { z } from 'zod'

const tanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')

const rupiahTidakNegatif = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), { message: 'Nilai harus berupa angka rupiah' })

/**
 * Batas atasnya longgar di sini — berapa maksimum satu baris bergantung pada
 * satuan tarif pegawainya (satu hari, atau dua puluh empat jam), dan satuan
 * itu baru diketahui layanan setelah pegawainya dibaca.
 */
const kuantitasPositif = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), { message: 'Jumlah pekerjaan harus berupa angka' })
  .refine((v) => Number(v) > 0, { message: 'Jumlah pekerjaan harus lebih besar dari nol' })
  .refine((v) => Number(v) <= 24, {
    message: 'Jumlah pekerjaan satu baris tidak boleh lebih dari 24',
  })

export const skemaProyek = z.object({
  nama: z.string().trim().min(1, 'Nama proyek wajib diisi').max(150),
  soId: z.uuid('Pesanan penjualan wajib dipilih'),
  tanggalMulai: tanggalIso,
  tanggalTarget: tanggalIso.nullable().default(null),
  manajerId: z.uuid().nullable().default(null),
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
  pegawaiId: z.uuid('Pegawai wajib dipilih'),
  /**
   * Perintah produksi yang menyerap upah baris ini. Diisi bila pekerjaannya
   * memang bagian dari produksi di bengkel; dikosongkan untuk pekerjaan yang
   * tidak melewati perintah produksi seperti pemasangan di lokasi pelanggan.
   */
  woId: z.uuid().nullable().default(null),
  tanggal: tanggalIso,
  kuantitas: kuantitasPositif,
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

export const LABEL_SATUAN_TARIF: Record<string, string> = {
  harian: 'Hari',
  jam: 'Jam',
}
