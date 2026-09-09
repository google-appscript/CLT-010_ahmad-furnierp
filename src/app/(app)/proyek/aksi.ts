'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  buatProyek, ubahProyek, mulaiProyek, selesaikanProyek,
  batalkanProyek, hapusProyek,
} from '@/modules/proyek/layanan/proyek'
import {
  buatTugas, ubahTugas, ubahStatusTugas, hapusTugas,
} from '@/modules/proyek/layanan/tugas'
import { catatTimesheet, hapusTimesheet } from '@/modules/proyek/layanan/timesheet'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type {
  MasukanProyek, MasukanTugas, MasukanTimesheet,
} from '@/modules/proyek/validasi/proyek'
import type { projectTasks } from '@/db/schema'

export type HasilAksi = { berhasil: true; id?: string } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

function segarkan() {
  revalidatePath('/proyek')
  revalidatePath('/proyek/tugas')
  revalidatePath('/proyek/timesheet')
  revalidatePath('/proyek/laporan/profitabilitas')
}

// ── Proyek ───────────────────────────────────────────────────────────────────

export async function aksiSimpanProyek(
  id: string | null, masukan: MasukanProyek,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('proyek.proyek.kelola')
  try {
    const proyek = id
      ? await ubahProyek(id, masukan)
      : await buatProyek(masukan, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'projects', entitasId: proyek.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { kode: masukan.kode },
    })
    segarkan()
    return { berhasil: true, id: proyek.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiMulaiProyek(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('proyek.proyek.kelola')
  try {
    await mulaiProyek(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'projects', entitasId: id, aksi: 'posting',
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiSelesaikanProyek(
  id: string, tanggalSelesai: string,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('proyek.proyek.kelola')
  try {
    await selesaikanProyek(id, tanggalSelesai)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'projects', entitasId: id,
      aksi: 'posting', dataBaru: { tanggalSelesai },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiBatalkanProyek(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('proyek.proyek.kelola')
  try {
    await batalkanProyek(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'projects', entitasId: id, aksi: 'ubah',
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusProyek(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('proyek.proyek.kelola')
  try {
    await hapusProyek(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'projects', entitasId: id, aksi: 'hapus',
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

// ── Tugas ────────────────────────────────────────────────────────────────────

export async function aksiSimpanTugas(
  id: string | null, masukan: MasukanTugas,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('proyek.tugas.kelola')
  try {
    const tugas = id ? await ubahTugas(id, masukan) : await buatTugas(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'project_tasks', entitasId: tugas.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { nama: masukan.nama },
    })
    segarkan()
    return { berhasil: true, id: tugas.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusTugas(
  id: string, status: (typeof projectTasks.$inferSelect)['status'],
): Promise<HasilAksi> {
  const sesi = await wajibIzin('proyek.tugas.kelola')
  try {
    await ubahStatusTugas(id, status)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'project_tasks', entitasId: id,
      aksi: 'ubah', dataBaru: { status },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusTugas(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('proyek.tugas.kelola')
  try {
    await hapusTugas(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'project_tasks', entitasId: id, aksi: 'hapus',
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

// ── Timesheet ────────────────────────────────────────────────────────────────

export async function aksiCatatTimesheet(masukan: MasukanTimesheet): Promise<HasilAksi> {
  const sesi = await wajibIzin('proyek.timesheet.kelola')
  try {
    const baris = await catatTimesheet(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'timesheets', entitasId: baris.id,
      aksi: 'buat', dataBaru: { jam: masukan.jam, tanggal: masukan.tanggal },
    })
    segarkan()
    return { berhasil: true, id: baris.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusTimesheet(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('proyek.timesheet.kelola')
  try {
    await hapusTimesheet(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'timesheets', entitasId: id, aksi: 'hapus',
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
