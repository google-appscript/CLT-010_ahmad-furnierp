'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  ubahPemetaanJurnal, simpanAkunOtomatis,
  type BidangAkunOtomatis,
} from '@/modules/akuntansi/layanan/pemetaan'
import { catatAudit } from '@/modules/identitas/layanan/audit'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

export async function aksiUbahPemetaan(id: string, journalId: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.pemetaan-jurnal.kelola')
  try {
    await ubahPemetaanJurnal(id, journalId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'journal_mappings', entitasId: id,
      aksi: 'ubah', dataBaru: { journalId },
    })
    revalidatePath('/akuntansi/konfigurasi/pemetaan-jurnal')
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiSimpanAkunOtomatis(
  nilai: Partial<Record<BidangAkunOtomatis, string | null>>,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.pemetaan-jurnal.kelola')
  try {
    await simpanAkunOtomatis(nilai)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'company_settings', entitasId: null,
      aksi: 'ubah', dataBaru: nilai,
    })
    revalidatePath('/akuntansi/konfigurasi/pemetaan-jurnal')
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
