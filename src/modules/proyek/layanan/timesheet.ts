import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/db/klien'
import { timesheets, projects, projectTasks, users } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, kali, tambah, type Uang } from '@/lib/uang'
import { skemaTimesheet, type MasukanTimesheet } from '../validasi/proyek'

export type Timesheet = typeof timesheets.$inferSelect

const DESIMAL_JAM = 2
const DESIMAL_NILAI = 2

function urai(masukan: MasukanTimesheet) {
  const hasil = skemaTimesheet.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

/**
 * Proyek yang sudah selesai, dibatalkan, atau terkunci tidak boleh menerima
 * baris timesheet baru maupun perubahan — job costing yang sudah dikunci
 * tidak boleh kedatangan biaya tenaga kerja baru secara diam-diam.
 */
function wajibProyekTerbuka(proyek: typeof projects.$inferSelect) {
  if (proyek.status === 'draft') {
    throw new ValidasiError(`Proyek ${proyek.kode} belum dimulai`)
  }
  if (proyek.status === 'selesai' || proyek.status === 'dibatalkan' || proyek.status === 'terkunci') {
    throw new ValidasiError(`Proyek ${proyek.kode} sudah ditutup`)
  }
}

export type TimesheetLengkap = Timesheet & {
  kodeProyek: string
  namaProyek: string
  namaTugas: string | null
  namaPengguna: string
  biaya: Uang
}

export async function daftarTimesheet(saring: {
  proyekId?: string
  penggunaId?: string
  dari?: string
  sampai?: string
} = {}): Promise<TimesheetLengkap[]> {
  const syarat = []
  if (saring.proyekId) syarat.push(eq(timesheets.proyekId, saring.proyekId))
  if (saring.penggunaId) syarat.push(eq(timesheets.penggunaId, saring.penggunaId))
  if (saring.dari) syarat.push(gte(timesheets.tanggal, saring.dari))
  if (saring.sampai) syarat.push(lte(timesheets.tanggal, saring.sampai))

  const baris = await db
    .select({
      timesheet: timesheets,
      kodeProyek: projects.kode,
      namaProyek: projects.nama,
      namaTugas: projectTasks.nama,
      namaPengguna: users.nama,
    })
    .from(timesheets)
    .innerJoin(projects, eq(projects.id, timesheets.proyekId))
    .innerJoin(users, eq(users.id, timesheets.penggunaId))
    .leftJoin(projectTasks, eq(projectTasks.id, timesheets.tugasId))
    .where(syarat.length > 0 ? and(...syarat) : undefined)
    .orderBy(desc(timesheets.tanggal), asc(projects.kode))

  return baris.map((b) => ({
    ...b.timesheet,
    kodeProyek: b.kodeProyek,
    namaProyek: b.namaProyek,
    namaTugas: b.namaTugas,
    namaPengguna: b.namaPengguna,
    biaya: bulatkan(kali(b.timesheet.jam, b.timesheet.tarifPerJam), DESIMAL_NILAI),
  }))
}

/**
 * Mencatat jam kerja. Tarif disalin dari proyek saat baris ini dibuat, bukan
 * dibaca ulang saat laporan disusun — menaikkan tarif tidak boleh mengubah
 * biaya pekerjaan yang sudah lewat.
 */
export async function catatTimesheet(masukan: MasukanTimesheet): Promise<Timesheet> {
  const data = urai(masukan)

  const [proyek] = await db.select().from(projects)
    .where(eq(projects.id, data.proyekId)).limit(1)
  if (!proyek) throw new ValidasiError('Proyek tidak ditemukan')
  wajibProyekTerbuka(proyek)
  if (data.tanggal < proyek.tanggalMulai) {
    throw new ValidasiError('Tanggal timesheet tidak boleh mendahului tanggal mulai proyek')
  }

  if (data.tugasId) {
    const [tugas] = await db.select().from(projectTasks)
      .where(eq(projectTasks.id, data.tugasId)).limit(1)
    if (!tugas) throw new ValidasiError('Tugas tidak ditemukan')
    if (tugas.proyekId !== data.proyekId) {
      throw new ValidasiError('Tugas yang dipilih bukan milik proyek ini')
    }
  }

  const [baris] = await db.insert(timesheets).values({
    proyekId: data.proyekId,
    tugasId: data.tugasId,
    penggunaId: data.penggunaId,
    tanggal: data.tanggal,
    jam: data.jam,
    tarifPerJam: proyek.tarifPerJam,
    deskripsi: data.deskripsi,
  }).returning()

  return baris
}

/**
 * Mengubah sebuah baris timesheet yang sudah dicatat. Proyeknya sendiri tidak
 * dapat dipindahkan lewat pengubahan ini, dan tarif yang sudah dibekukan saat
 * baris dibuat tidak pernah dihitung ulang di sini — hanya rincian pekerjaan
 * (tugas, pelaksana, tanggal, jam, uraian) yang boleh berubah.
 */
export async function ubahTimesheet(id: string, masukan: MasukanTimesheet): Promise<Timesheet> {
  const data = urai(masukan)

  const [baris] = await db.select().from(timesheets).where(eq(timesheets.id, id)).limit(1)
  if (!baris) throw new ValidasiError('Baris timesheet tidak ditemukan')
  if (data.proyekId !== baris.proyekId) {
    throw new ValidasiError('Proyek pada baris timesheet tidak dapat diubah')
  }

  const [proyek] = await db.select().from(projects)
    .where(eq(projects.id, baris.proyekId)).limit(1)
  if (!proyek) throw new ValidasiError('Proyek tidak ditemukan')
  wajibProyekTerbuka(proyek)
  if (data.tanggal < proyek.tanggalMulai) {
    throw new ValidasiError('Tanggal timesheet tidak boleh mendahului tanggal mulai proyek')
  }

  if (data.tugasId) {
    const [tugas] = await db.select().from(projectTasks)
      .where(eq(projectTasks.id, data.tugasId)).limit(1)
    if (!tugas) throw new ValidasiError('Tugas tidak ditemukan')
    if (tugas.proyekId !== data.proyekId) {
      throw new ValidasiError('Tugas yang dipilih bukan milik proyek ini')
    }
  }

  const [diperbarui] = await db.update(timesheets).set({
    tugasId: data.tugasId,
    penggunaId: data.penggunaId,
    tanggal: data.tanggal,
    jam: data.jam,
    deskripsi: data.deskripsi,
  }).where(eq(timesheets.id, id)).returning()

  return diperbarui
}

export async function hapusTimesheet(id: string): Promise<void> {
  const [baris] = await db.select().from(timesheets).where(eq(timesheets.id, id)).limit(1)
  if (!baris) throw new ValidasiError('Baris timesheet tidak ditemukan')

  const [proyek] = await db.select().from(projects)
    .where(eq(projects.id, baris.proyekId)).limit(1)
  if (proyek) wajibProyekTerbuka(proyek)

  await db.delete(timesheets).where(eq(timesheets.id, id))
}

export type RekapTimesheet = {
  totalJam: Uang
  totalBiaya: Uang
}

export async function rekapTimesheetProyek(proyekId: string): Promise<RekapTimesheet> {
  const baris = await db.select({ jam: timesheets.jam, tarif: timesheets.tarifPerJam })
    .from(timesheets).where(eq(timesheets.proyekId, proyekId))

  return {
    totalJam: bulatkan(tambah(...baris.map((b) => b.jam)), DESIMAL_JAM),
    totalBiaya: bulatkan(
      tambah(...baris.map((b) => kali(b.jam, b.tarif))), DESIMAL_NILAI,
    ),
  }
}
