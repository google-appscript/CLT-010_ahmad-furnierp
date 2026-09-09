'use server'

import { ambilSesi } from '@/lib/sesi'
import { simpanFilter, hapusFilter } from '@/modules/preferensi/layanan/filter-tersimpan'

export async function simpanFilterFavoritAction(
  kunciDaftar: string,
  nama: string,
  kriteria: unknown,
): Promise<{ berhasil: boolean; pesan?: string }> {
  const sesi = await ambilSesi()
  try {
    await simpanFilter({ penggunaId: sesi.penggunaId, kunciDaftar, nama, kriteria })
    return { berhasil: true }
  } catch (galat) {
    return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
  }
}

export async function hapusFilterFavoritAction(
  id: string,
): Promise<{ berhasil: boolean; pesan?: string }> {
  const sesi = await ambilSesi()
  try {
    await hapusFilter(id, sesi.penggunaId)
    return { berhasil: true }
  } catch (galat) {
    return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
  }
}
