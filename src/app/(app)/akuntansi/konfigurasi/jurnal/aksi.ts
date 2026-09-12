'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { buatJurnal, ubahJurnal, nonaktifkanJurnal, aktifkanJurnal } from '@/modules/akuntansi/layanan/jurnal'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanJurnal } from '@/modules/akuntansi/validasi/jurnal'

const IZIN = 'akuntansi.jurnal-master.kelola'
const RUTE = '/akuntansi/konfigurasi/jurnal'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
}

export async function aksiSimpanJurnal(
  id: string | null, masukan: MasukanJurnal,
): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    const jurnal = id ? await ubahJurnal(id, masukan) : await buatJurnal(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'journals', entitasId: jurnal.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: masukan,
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusJurnal(id: string, aktif: boolean): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    if (aktif) await aktifkanJurnal(id)
    else await nonaktifkanJurnal(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'journals', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive: aktif },
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
