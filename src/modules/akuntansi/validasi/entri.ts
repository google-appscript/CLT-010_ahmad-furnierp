import { z } from 'zod'

const uangPositif = z.string().trim()
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
    message: 'Nilai harus berupa angka dengan maksimal dua desimal',
  })

export const skemaItemEntri = z.object({
  accountId: z.uuid('Akun wajib dipilih'),
  partnerId: z.uuid().nullable().default(null),
  label: z.string().trim().min(1, 'Keterangan baris wajib diisi').max(200),
  debit: uangPositif.default('0'),
  kredit: uangPositif.default('0'),
  nilaiMataUang: z.string().trim().nullable().default(null),
  taxId: z.uuid().nullable().default(null),
  projectId: z.uuid().nullable().default(null),
}).refine((b) => !(Number(b.debit) > 0 && Number(b.kredit) > 0), {
  message: 'Satu baris tidak boleh memuat debit dan kredit sekaligus',
  path: ['debit'],
}).refine((b) => Number(b.debit) > 0 || Number(b.kredit) > 0, {
  message: 'Setiap baris harus memuat nilai debit atau kredit',
  path: ['debit'],
})

export const skemaEntri = z.object({
  journalId: z.uuid('Jurnal wajib dipilih'),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  referensi: z.string().trim().max(100).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  keterangan: z.string().trim().max(500).nullable().default(null)
    .transform((v) => (v === '' ? null : v)),
  mataUangId: z.string().trim().length(3).default('IDR'),
  partnerId: z.uuid().nullable().default(null),
  item: z.array(skemaItemEntri).min(2, 'Entri jurnal memerlukan minimal dua baris'),
})

export type MasukanItemEntri = z.input<typeof skemaItemEntri>
export type MasukanEntri = z.input<typeof skemaEntri>

export const LABEL_STATUS: Record<string, string> = {
  draft: 'Draft',
  diposting: 'Diposting',
  dibatalkan: 'Dibatalkan',
}
