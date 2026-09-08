'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { buatTahunBuku, aturTanggalKunciBuku } from '@/modules/akuntansi/layanan/konfigurasi'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanTahunBuku } from '@/modules/akuntansi/validasi/konfigurasi'

const IZIN = 'akuntansi.tahun-buku.kelola'
const RUTE = '/akuntansi/konfigurasi/tahun-buku'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
}

export async function aksiBuatTahunBuku(masukan: MasukanTahunBuku): Promise<HasilAksi> {
  await wajibIzin(IZIN)
  try {
    await buatTahunBuku(masukan)
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

/** Perubahan tanggal kunci selalu dicatat: ini tindakan paling berdampak di
 *  seluruh sistem akuntansi dan harus dapat ditelusuri. */
export async function aksiAturKunciBuku(tanggal: string | null): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    await aturTanggalKunciBuku(tanggal)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'company_settings', entitasId: null,
      aksi: 'ubah', dataBaru: { tanggalKunciBuku: tanggal },
    })
    revalidatePath(RUTE)
    revalidatePath('/akuntansi')
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
