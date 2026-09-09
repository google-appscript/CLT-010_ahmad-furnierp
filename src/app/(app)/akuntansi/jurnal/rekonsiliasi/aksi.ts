'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { rekonsiliasi, batalkanRekonsiliasi } from '@/modules/akuntansi/layanan/rekonsiliasi'
import { catatAudit } from '@/modules/identitas/layanan/audit'

export type HasilAksi = { berhasil: true; id?: string } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

export async function aksiRekonsiliasi(
  itemIds: string[], tanggal: string,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.rekonsiliasi.kelola')
  try {
    const id = await rekonsiliasi(itemIds, tanggal, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, aksi: 'buat', entitas: 'reconciliations', entitasId: id,
    })
    revalidatePath('/akuntansi/jurnal/rekonsiliasi')
    return { berhasil: true, id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiBatalkanRekonsiliasi(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.rekonsiliasi.kelola')
  try {
    await batalkanRekonsiliasi(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, aksi: 'hapus',
      entitas: 'reconciliations', entitasId: id,
    })
    revalidatePath('/akuntansi/jurnal/rekonsiliasi')
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
