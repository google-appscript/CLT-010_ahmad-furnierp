import { z } from 'zod'
import { ValidasiError } from '@/lib/galat'
import * as repositori from '../repositori/filter-tersimpan'

const skemaFilter = z.object({
  penggunaId: z.uuid('Pengguna wajib diisi'),
  kunciDaftar: z.string().trim().min(1, 'Kunci daftar wajib diisi').max(100),
  nama: z.string().trim().min(1, 'Nama favorit wajib diisi').max(100),
  kriteria: z.unknown(),
})

export async function simpanFilter(data: {
  penggunaId: string
  kunciDaftar: string
  nama: string
  kriteria: unknown
}): Promise<{ id: string }> {
  const hasil = skemaFilter.safeParse(data)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return repositori.simpanFilter(hasil.data)
}

export async function daftarFilter(
  penggunaId: string,
  kunciDaftar: string,
): Promise<{ id: string; nama: string; kriteria: unknown }[]> {
  return repositori.daftarFilter(penggunaId, kunciDaftar)
}

export async function hapusFilter(id: string, penggunaId: string): Promise<void> {
  await repositori.hapusFilter(id, penggunaId)
}
