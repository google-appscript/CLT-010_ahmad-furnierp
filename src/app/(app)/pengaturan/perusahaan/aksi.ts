'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { simpanProfilPerusahaan } from '@/modules/akuntansi/layanan/konfigurasi'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanPerusahaan } from '@/modules/akuntansi/validasi/konfigurasi'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

export async function aksiSimpanPerusahaan(masukan: MasukanPerusahaan): Promise<HasilAksi> {
  const sesi = await wajibIzin('pengaturan.perusahaan.kelola')
  try {
    await simpanProfilPerusahaan(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'company_settings', entitasId: null,
      aksi: 'ubah', dataBaru: masukan,
    })
    revalidatePath('/pengaturan/perusahaan')
    return { berhasil: true }
  } catch (galat) {
    return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
  }
}
