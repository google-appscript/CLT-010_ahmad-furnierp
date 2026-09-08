'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { catatKurs } from '@/modules/akuntansi/layanan/konfigurasi'
import type { MasukanKurs } from '@/modules/akuntansi/validasi/konfigurasi'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

export async function aksiCatatKurs(masukan: MasukanKurs): Promise<HasilAksi> {
  await wajibIzin('akuntansi.mata-uang.kelola')
  try {
    await catatKurs(masukan)
    revalidatePath('/akuntansi/konfigurasi/mata-uang')
    return { berhasil: true }
  } catch (galat) {
    return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
  }
}
