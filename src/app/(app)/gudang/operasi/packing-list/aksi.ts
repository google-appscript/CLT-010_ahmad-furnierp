'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { buatPackingList, hapusPackingList } from '@/modules/gudang/layanan/packing-list'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanPackingList } from '@/modules/gudang/validasi/operasi'

const IZIN = 'gudang.packing.kelola'
const RUTE = '/gudang/operasi/packing-list'

export type HasilAksi = { berhasil: true; id?: string } | { berhasil: false; pesan: string }

export async function aksiBuatPackingList(masukan: MasukanPackingList): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    const pl = await buatPackingList(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'packing_lists', entitasId: pl.id,
      aksi: 'buat', dataBaru: { nomor: pl.nomor },
    })
    revalidatePath(RUTE)
    return { berhasil: true, id: pl.id }
  } catch (galat) {
    return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
  }
}

export async function aksiHapusPackingList(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    await hapusPackingList(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'packing_lists', entitasId: id, aksi: 'hapus',
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
  }
}
