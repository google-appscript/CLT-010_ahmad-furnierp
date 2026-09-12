'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { buatProduk, ubahProduk, ubahStatusProduk } from '@/modules/gudang/layanan/produk'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanProduk } from '@/modules/gudang/validasi/produk'

const IZIN = 'gudang.produk.kelola'
const RUTE = '/gudang/produk'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
}

export async function aksiSimpanProduk(id: string | null, masukan: MasukanProduk): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    const produk = id ? await ubahProduk(id, masukan) : await buatProduk(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'products', entitasId: produk.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: masukan,
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusProduk(id: string, aktif: boolean): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    await ubahStatusProduk(id, aktif)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'products', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive: aktif },
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
