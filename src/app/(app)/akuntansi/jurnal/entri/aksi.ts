'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { wajibIzin } from '@/lib/sesi'
import {
  buatEntri, ubahEntri, postingEntri, batalkanDraft, hapusDraft, balikEntri,
} from '@/modules/akuntansi/layanan/entri'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanEntri } from '@/modules/akuntansi/validasi/entri'

const LIHAT = 'akuntansi.jurnal.lihat'
const POSTING = 'akuntansi.jurnal.posting'
const RUTE = '/akuntansi/jurnal/entri'

export type HasilAksi =
  | { berhasil: true; id?: string }
  | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

function segarkan() {
  revalidatePath(RUTE)
  revalidatePath('/akuntansi/jurnal/item')
  revalidatePath('/akuntansi')
}

export async function aksiSimpanEntri(
  id: string | null, masukan: MasukanEntri,
): Promise<HasilAksi> {
  const sesi = await wajibIzin(LIHAT)
  try {
    const entri = id
      ? await ubahEntri(id, masukan)
      : await buatEntri(masukan, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'journal_entries', entitasId: entri.id,
      aksi: id ? 'ubah' : 'buat',
      dataBaru: { tanggal: masukan.tanggal, keterangan: masukan.keterangan },
    })
    segarkan()
    return { berhasil: true, id: entri.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiPostingEntri(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(POSTING)
  try {
    const entri = await postingEntri(id, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'journal_entries', entitasId: id,
      aksi: 'posting', dataBaru: { nomor: entri.nomor },
    })
    segarkan()
    return { berhasil: true, id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiBalikEntri(id: string, tanggal: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(POSTING)
  try {
    const balik = await balikEntri(id, tanggal, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'journal_entries', entitasId: id,
      aksi: 'balik', dataBaru: { nomorPembalik: balik.nomor, tanggal },
    })
    segarkan()
    return { berhasil: true, id: balik.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiBatalkanDraft(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(LIHAT)
  try {
    await batalkanDraft(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'journal_entries', entitasId: id,
      aksi: 'ubah', dataBaru: { status: 'dibatalkan' },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusDraft(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(LIHAT)
  try {
    await hapusDraft(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'journal_entries', entitasId: id, aksi: 'hapus',
    })
    segarkan()
  } catch (galat) {
    return keHasil(galat)
  }
  redirect(RUTE)
}
