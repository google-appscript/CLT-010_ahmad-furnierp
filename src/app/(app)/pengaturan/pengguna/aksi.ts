'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  buatPengguna, ubahPengguna, aturKataSandi, ubahStatusPengguna,
} from '@/modules/identitas/layanan/pengguna'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanPengguna, MasukanPenggunaBaru } from '@/modules/identitas/validasi/pengguna'

const IZIN = 'pengaturan.pengguna.kelola'
const RUTE = '/pengaturan/pengguna'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
}

export async function aksiSimpanPengguna(
  id: string | null,
  masukan: MasukanPengguna & { kataSandi?: string },
): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    if (id) {
      await ubahPengguna(id, masukan)
      if (masukan.kataSandi) await aturKataSandi(id, masukan.kataSandi)
    } else {
      await buatPengguna(masukan as MasukanPenggunaBaru)
    }
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'users', entitasId: id,
      aksi: id ? 'ubah' : 'buat',
      // Kata sandi tidak pernah masuk ke log aktivitas.
      dataBaru: { email: masukan.email, nama: masukan.nama, peranId: masukan.peranId },
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusPengguna(id: string, aktif: boolean): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    await ubahStatusPengguna(id, aktif)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'users', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive: aktif },
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
