import { z } from 'zod'

export const skemaWarehouse = z.object({
  kode: z.string().trim().min(1, 'Kode gudang wajib diisi').max(30),
  nama: z.string().trim().min(1, 'Nama gudang wajib diisi').max(100),
  alamat: z.string().trim().max(300).nullable().default(null),
})

export type MasukanWarehouse = z.input<typeof skemaWarehouse>

/**
 * Lokasi virtual (Pemasok, Pelanggan, Penyesuaian, Barang Rusak, Produksi)
 * adalah penampung tunggal per tipe yang dibaca modul lain lewat tipenya —
 * hanya seed yang boleh membuatnya. Menu ini hanya boleh membuat lokasi
 * internal dan transit, yang boleh berjumlah banyak.
 */
export const TIPE_LOKASI_DAPAT_DIBUAT = ['internal', 'transit'] as const

const skemaLokasiDasar = z.object({
  kode: z.string().trim().min(1, 'Kode lokasi wajib diisi').max(30),
  nama: z.string().trim().min(1, 'Nama lokasi wajib diisi').max(100),
  warehouseId: z.uuid().nullable().default(null),
  parentId: z.uuid().nullable().default(null),
})

/** Dipakai hanya saat membuat lokasi baru — tipe tidak lagi bisa diubah sesudahnya. */
export const skemaLokasiBaru = skemaLokasiDasar.extend({
  tipe: z.enum(TIPE_LOKASI_DAPAT_DIBUAT),
}).refine(
  (d) => d.tipe !== 'internal' || d.warehouseId !== null,
  { message: 'Lokasi internal wajib memilih gudang', path: ['warehouseId'] },
)

/** Dipakai saat mengubah lokasi yang sudah ada; tipe lama tetap dipertahankan. */
export const skemaLokasiUbah = skemaLokasiDasar

export type MasukanLokasiBaru = z.input<typeof skemaLokasiBaru>
export type MasukanLokasiUbah = z.input<typeof skemaLokasiUbah>

export const LABEL_TIPE_LOKASI: Record<string, string> = {
  internal: 'Internal',
  transit: 'Transit',
  pemasok: 'Pemasok (virtual)',
  pelanggan: 'Pelanggan (virtual)',
  penyesuaian: 'Penyesuaian (virtual)',
  rusak: 'Barang Rusak (virtual)',
  produksi: 'Produksi (virtual)',
}
