'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { buatAkun, ubahAkun, nonaktifkanAkun, aktifkanAkun } from '@/modules/akuntansi/layanan/akun'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanAkun } from '@/modules/akuntansi/validasi/akun'

const IZIN = 'akuntansi.coa.kelola'
const RUTE = '/akuntansi/konfigurasi/bagan-akun'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

export async function aksiSimpanAkun(id: string | null, masukan: MasukanAkun): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    const akun = id ? await ubahAkun(id, masukan) : await buatAkun(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'accounts', entitasId: akun.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: masukan,
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusAkun(id: string, aktif: boolean): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    if (aktif) await aktifkanAkun(id)
    else await nonaktifkanAkun(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'accounts', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive: aktif },
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
