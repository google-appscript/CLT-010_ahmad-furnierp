'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { buatUom, ubahUom, ubahStatusUom } from '@/modules/gudang/layanan/uom'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanUom } from '@/modules/gudang/validasi/uom'

const IZIN = 'gudang.satuan.kelola'
const RUTE = '/gudang/produk/satuan'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
}

export async function aksiSimpanUom(id: string | null, masukan: MasukanUom): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    const uom = id ? await ubahUom(id, masukan) : await buatUom(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'uoms', entitasId: uom.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: masukan,
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusUom(id: string, aktif: boolean): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    await ubahStatusUom(id, aktif)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'uoms', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive: aktif },
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
