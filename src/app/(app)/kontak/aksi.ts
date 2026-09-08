'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  buatPartner, ubahPartner, nonaktifkanPartner, aktifkanPartner,
} from '@/modules/akuntansi/layanan/partner'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanPartner } from '@/modules/akuntansi/validasi/partner'

const IZIN = 'kontak.partner.lihat'
const RUTE = ['/kontak', '/kontak/pelanggan', '/kontak/pemasok']

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function segarkan() {
  for (const rute of RUTE) revalidatePath(rute)
}

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

export async function aksiSimpanPartner(
  id: string | null, masukan: MasukanPartner,
): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    const mitra = id ? await ubahPartner(id, masukan) : await buatPartner(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'partners', entitasId: mitra.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: masukan,
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusPartner(id: string, aktif: boolean): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    if (aktif) await aktifkanPartner(id)
    else await nonaktifkanPartner(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'partners', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive: aktif },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
