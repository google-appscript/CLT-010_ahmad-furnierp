'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  buatPosBiaya, ubahPosBiaya, ubahStatusPosBiaya, aturPosBawaanLokasi,
} from '@/modules/akuntansi/layanan/pos-biaya'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanPosBiaya } from '@/modules/akuntansi/validasi/pos-biaya'

export type HasilAksi = { berhasil: true; id?: string } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

function segarkan() {
  revalidatePath('/akuntansi/konfigurasi/pos-biaya')
  revalidatePath('/akuntansi/laporan/pos-biaya')
}

export async function aksiSimpanPosBiaya(
  id: string | null, masukan: MasukanPosBiaya,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.pos-biaya.kelola')
  try {
    const pos = id ? await ubahPosBiaya(id, masukan) : await buatPosBiaya(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'cost_centers', entitasId: pos.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { kode: masukan.kode },
    })
    segarkan()
    return { berhasil: true, id: pos.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusPosBiaya(
  id: string, isActive: boolean,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.pos-biaya.kelola')
  try {
    await ubahStatusPosBiaya(id, isActive)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'cost_centers', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiAturPosBawaanLokasi(
  lokasiId: string, costCenterId: string | null,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.pos-biaya.kelola')
  try {
    await aturPosBawaanLokasi(lokasiId, costCenterId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'location_cost_centers', entitasId: lokasiId,
      aksi: 'ubah', dataBaru: { costCenterId },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
