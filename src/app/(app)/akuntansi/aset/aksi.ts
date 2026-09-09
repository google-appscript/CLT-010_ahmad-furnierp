'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  buatAset, ubahAset, jalankanAset, hapusAset, lepaskanAset,
} from '@/modules/aset/layanan/aset'
import { postingBaris, postingDepresiasiSampai } from '@/modules/aset/layanan/depresiasi'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanAset, MasukanPelepasan } from '@/modules/aset/validasi/aset'

export type HasilAksi = { berhasil: true; id?: string } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

function segarkan() {
  revalidatePath('/akuntansi/aset')
  revalidatePath('/akuntansi/aset/depresiasi')
  revalidatePath('/akuntansi/aset/laporan')
  revalidatePath('/akuntansi/jurnal/entri')
}

export async function aksiSimpanAset(
  id: string | null, masukan: MasukanAset,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.aset.lihat')
  try {
    const aset = id ? await ubahAset(id, masukan) : await buatAset(masukan, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'fixed_assets', entitasId: aset.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { kode: masukan.kode },
    })
    segarkan()
    return { berhasil: true, id: aset.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiJalankanAset(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.aset.lihat')
  try {
    const aset = await jalankanAset(id, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'fixed_assets', entitasId: id,
      aksi: 'posting', dataBaru: { jumlahBaris: aset.baris.length },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusAset(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.aset.lihat')
  try {
    await hapusAset(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'fixed_assets', entitasId: id, aksi: 'hapus',
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiLepaskanAset(
  id: string, masukan: MasukanPelepasan,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.aset.lihat')
  try {
    await lepaskanAset(id, masukan, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'fixed_assets', entitasId: id,
      aksi: 'posting', dataBaru: { pelepasan: masukan.tanggal },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiPostingBaris(barisId: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.depresiasi.lihat')
  try {
    await postingBaris(barisId, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'depreciation_lines', entitasId: barisId,
      aksi: 'posting',
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiPostingBerkala(sampaiTanggal: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.depresiasi.lihat')
  try {
    const hasil = await postingDepresiasiSampai(sampaiTanggal, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'depreciation_lines', entitasId: null,
      aksi: 'posting', dataBaru: hasil,
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
