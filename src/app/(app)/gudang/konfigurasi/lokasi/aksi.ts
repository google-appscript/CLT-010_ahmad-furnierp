'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  buatWarehouse, ubahWarehouse, ubahStatusWarehouse,
  buatLokasi, ubahLokasi, ubahStatusLokasi,
} from '@/modules/gudang/layanan/lokasi'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type {
  MasukanWarehouse, MasukanLokasiBaru, MasukanLokasiUbah,
} from '@/modules/gudang/validasi/lokasi'

const IZIN = 'gudang.lokasi.kelola'
const RUTE = '/gudang/konfigurasi/lokasi'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
}

export async function aksiSimpanWarehouse(
  id: string | null, masukan: MasukanWarehouse,
): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    const gudang = id ? await ubahWarehouse(id, masukan) : await buatWarehouse(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'warehouses', entitasId: gudang.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: masukan,
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusWarehouse(id: string, aktif: boolean): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    await ubahStatusWarehouse(id, aktif)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'warehouses', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive: aktif },
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiSimpanLokasi(
  id: string | null, masukan: MasukanLokasiBaru | MasukanLokasiUbah,
): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    const lokasi = id
      ? await ubahLokasi(id, masukan as MasukanLokasiUbah)
      : await buatLokasi(masukan as MasukanLokasiBaru)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'locations', entitasId: lokasi.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: masukan,
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusLokasi(id: string, aktif: boolean): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    await ubahStatusLokasi(id, aktif)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'locations', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive: aktif },
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
