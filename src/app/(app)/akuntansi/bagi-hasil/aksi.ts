'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { companySettings } from '@/db/schema'
import { wajibIzin } from '@/lib/sesi'
import { ValidasiError } from '@/lib/galat'
import {
  buatPemilik, ubahPemilik, ubahStatusPemilik,
  buatSusunan, ubahSusunan, hapusSusunan,
} from '@/modules/kepemilikan/layanan/pemilik'
import { kunciBagiHasil, bukaKunciBagiHasil } from '@/modules/kepemilikan/layanan/bagi-hasil'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type {
  MasukanPemilik, MasukanSusunanKepemilikan,
} from '@/modules/kepemilikan/validasi/kepemilikan'

export type HasilAksi = { berhasil: true; id?: string } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

function segarkan() {
  revalidatePath('/akuntansi/bagi-hasil/pemilik')
  revalidatePath('/akuntansi/bagi-hasil/distribusi')
  revalidatePath('/akuntansi/bagi-hasil/laporan')
  revalidatePath('/akuntansi/jurnal/entri')
}

// ── Pemilik ──────────────────────────────────────────────────────────────────

export async function aksiSimpanPemilik(
  id: string | null, masukan: MasukanPemilik,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.bagi-hasil.kelola')
  try {
    const pemilik = id ? await ubahPemilik(id, masukan) : await buatPemilik(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'owners', entitasId: pemilik.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { kode: masukan.kode },
    })
    segarkan()
    return { berhasil: true, id: pemilik.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusPemilik(
  id: string, isActive: boolean,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.bagi-hasil.kelola')
  try {
    await ubahStatusPemilik(id, isActive)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'owners', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

// ── Susunan kepemilikan ─────────────────────────────────────────────────────

export async function aksiSimpanSusunan(
  id: string | null, masukan: MasukanSusunanKepemilikan,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.bagi-hasil.kelola')
  try {
    const susunan = id ? await ubahSusunan(id, masukan) : await buatSusunan(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'ownership_periods', entitasId: susunan.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { nama: masukan.nama },
    })
    segarkan()
    return { berhasil: true, id: susunan.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusSusunan(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.bagi-hasil.kelola')
  try {
    await hapusSusunan(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'ownership_periods', entitasId: id, aksi: 'hapus',
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

// ── Distribusi ──────────────────────────────────────────────────────────────

export async function aksiKunciBagiHasil(kodePeriode: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.bagi-hasil.kelola')
  try {
    const hasil = await kunciBagiHasil(kodePeriode, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'profit_periods',
      entitasId: hasil.profitPeriodId, aksi: 'posting',
      dataBaru: { kode: kodePeriode, labaBersih: hasil.labaBersih },
    })
    segarkan()
    return { berhasil: true, id: hasil.profitPeriodId }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiBukaKunciBagiHasil(profitPeriodId: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.bagi-hasil.kelola')
  try {
    await bukaKunciBagiHasil(profitPeriodId, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'profit_periods',
      entitasId: profitPeriodId, aksi: 'balik',
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

/**
 * Panjang periode bagi hasil adalah pengaturan global. Mengubahnya hanya
 * berlaku untuk periode yang belum dikunci; yang sudah terkunci menyimpan
 * tipenya sendiri dan tidak ikut berubah.
 */
export async function aksiAturPeriodeBagiHasil(
  periode: 'bulanan' | 'kuartalan' | 'tahunan',
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.bagi-hasil.kelola')
  try {
    const [pengaturan] = await db.select().from(companySettings).limit(1)
    if (!pengaturan) throw new ValidasiError('Pengaturan perusahaan belum dibuat')

    await db.update(companySettings)
      .set({ periodeBagiHasil: periode, diubahPada: new Date() })
      .where(eq(companySettings.id, pengaturan.id))

    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'company_settings', entitasId: pengaturan.id,
      aksi: 'ubah', dataBaru: { periodeBagiHasil: periode },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
