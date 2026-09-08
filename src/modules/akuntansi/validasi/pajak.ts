import { z } from 'zod'

const tarifPersen = z.string().trim()
  .refine((v) => /^-?\d+(\.\d+)?$/.test(v), { message: 'Tarif harus berupa angka' })
  .refine((v) => Number(v) >= 0, { message: 'Tarif tidak boleh negatif' })
  .refine((v) => Number(v) <= 100, { message: 'Tarif maksimal 100 persen' })

export const skemaPajak = z.object({
  kode: z.string().trim().min(1, 'Kode pajak wajib diisi').max(20),
  nama: z.string().trim().min(1, 'Nama pajak wajib diisi').max(120),
  ruangLingkup: z.enum(['penjualan', 'pembelian'], { message: 'Ruang lingkup tidak dikenali' }),
  tarif: tarifPersen,
  hargaTermasukPajak: z.boolean().default(false),
  isPemotongan: z.boolean().default(false),
  akunPajakId: z.uuid('Akun pajak wajib dipilih'),
})

export const skemaSyaratPembayaran = z.object({
  nama: z.string().trim().min(1, 'Nama syarat pembayaran wajib diisi').max(60),
  jumlahHari: z.number().int('Jumlah hari harus bilangan bulat')
    .min(0, 'Jumlah hari tidak boleh negatif')
    .max(365, 'Jumlah hari maksimal 365'),
  catatan: z.string().trim().max(200).nullable().default(null),
})

export type MasukanPajak = z.input<typeof skemaPajak>
export type MasukanSyaratPembayaran = z.input<typeof skemaSyaratPembayaran>
