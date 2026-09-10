'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  buatKategoriAset, ubahKategoriAset, ubahStatusKategoriAset,
} from '@/modules/aset/layanan/kategori'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanKategoriAset } from '@/modules/aset/validasi/kategori'

export type HasilAksi = { berhasil: true; id?: string } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

export async function aksiSimpanKategoriAset(
  id: string | null, masukan: MasukanKategoriAset,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.kategori-aset.kelola')
  try {
    const kategori = id
      ? await ubahKategoriAset(id, masukan)
      : await buatKategoriAset(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'asset_categories', entitasId: kategori.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { kode: masukan.kode },
    })
    revalidatePath('/akuntansi/konfigurasi/kategori-aset')
    return { berhasil: true, id: kategori.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusKategoriAset(
  id: string, isActive: boolean,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.kategori-aset.kelola')
  try {
    await ubahStatusKategoriAset(id, isActive)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'asset_categories', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive },
    })
    revalidatePath('/akuntansi/konfigurasi/kategori-aset')
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
