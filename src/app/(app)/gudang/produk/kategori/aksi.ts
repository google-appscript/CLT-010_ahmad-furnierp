'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  buatKategoriProduk, ubahKategoriProduk, ubahStatusKategoriProduk,
} from '@/modules/gudang/layanan/kategori'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanKategoriProduk } from '@/modules/gudang/validasi/kategori'

export type HasilAksi = { berhasil: true; id?: string } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

export async function aksiSimpanKategoriProduk(
  id: string | null, masukan: MasukanKategoriProduk,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('gudang.kategori.kelola')
  try {
    const kategori = id
      ? await ubahKategoriProduk(id, masukan)
      : await buatKategoriProduk(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'product_categories', entitasId: kategori.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { kode: masukan.kode },
    })
    revalidatePath('/gudang/produk/kategori')
    return { berhasil: true, id: kategori.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusKategoriProduk(
  id: string, isActive: boolean,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('gudang.kategori.kelola')
  try {
    await ubahStatusKategoriProduk(id, isActive)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'product_categories', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive },
    })
    revalidatePath('/gudang/produk/kategori')
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
