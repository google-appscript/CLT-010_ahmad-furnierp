import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { projectTasks, projects, timesheets, users } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, tambah, type Uang } from '@/lib/uang'
import { skemaTugas, type MasukanTugas } from '../validasi/proyek'

export type Tugas = typeof projectTasks.$inferSelect

const DESIMAL_JAM = 2

function urai(masukan: MasukanTugas) {
  const hasil = skemaTugas.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

export type TugasLengkap = Tugas & {
  namaProyek: string
  kodeProyek: string
  namaPenanggungJawab: string | null
  jamTercatat: Uang
}

/** Tugas beserta jam yang sudah tercatat padanya. */
export async function daftarTugas(saring: {
  proyekId?: string
  status?: Tugas['status']
} = {}): Promise<TugasLengkap[]> {
  const syarat = []
  if (saring.proyekId) syarat.push(eq(projectTasks.proyekId, saring.proyekId))
  if (saring.status) syarat.push(eq(projectTasks.status, saring.status))

  const baris = await db
    .select({
      tugas: projectTasks,
      kodeProyek: projects.kode,
      namaProyek: projects.nama,
      namaPenanggungJawab: users.nama,
    })
    .from(projectTasks)
    .innerJoin(projects, eq(projects.id, projectTasks.proyekId))
    .leftJoin(users, eq(users.id, projectTasks.penanggungJawabId))
    .where(syarat.length > 0 ? and(...syarat) : undefined)
    .orderBy(asc(projects.kode), asc(projectTasks.urutan))

  const jam = await db
    .select({ tugasId: timesheets.tugasId, jam: timesheets.jam })
    .from(timesheets)
  const jamPerTugas = new Map<string, string[]>()
  for (const t of jam) {
    if (!t.tugasId) continue
    jamPerTugas.set(t.tugasId, [...(jamPerTugas.get(t.tugasId) ?? []), t.jam])
  }

  return baris.map((b) => ({
    ...b.tugas,
    kodeProyek: b.kodeProyek,
    namaProyek: b.namaProyek,
    namaPenanggungJawab: b.namaPenanggungJawab,
    jamTercatat: bulatkan(tambah(...(jamPerTugas.get(b.tugas.id) ?? ['0'])), DESIMAL_JAM),
  }))
}

export async function ambilTugas(id: string): Promise<Tugas | null> {
  const [tugas] = await db.select().from(projectTasks).where(eq(projectTasks.id, id)).limit(1)
  return tugas ?? null
}

async function wajibProyekTerbuka(proyekId: string): Promise<void> {
  const [proyek] = await db.select().from(projects).where(eq(projects.id, proyekId)).limit(1)
  if (!proyek) throw new ValidasiError('Proyek tidak ditemukan')
  if (proyek.status === 'selesai' || proyek.status === 'dibatalkan') {
    throw new ValidasiError(`Proyek ${proyek.kode} sudah ditutup`)
  }
}

export async function buatTugas(masukan: MasukanTugas): Promise<Tugas> {
  const data = urai(masukan)
  await wajibProyekTerbuka(data.proyekId)

  const sudahAda = await db.select({ id: projectTasks.id }).from(projectTasks)
    .where(eq(projectTasks.proyekId, data.proyekId))

  const [tugas] = await db.insert(projectTasks).values({
    proyekId: data.proyekId,
    urutan: sudahAda.length + 1,
    nama: data.nama,
    deskripsi: data.deskripsi,
    penanggungJawabId: data.penanggungJawabId,
    tanggalMulai: data.tanggalMulai,
    tenggat: data.tenggat,
    estimasiJam: data.estimasiJam,
  }).returning()

  return tugas
}

export async function ubahTugas(id: string, masukan: MasukanTugas): Promise<Tugas> {
  const data = urai(masukan)
  const lama = await ambilTugas(id)
  if (!lama) throw new ValidasiError('Tugas tidak ditemukan')
  await wajibProyekTerbuka(data.proyekId)

  const [tugas] = await db.update(projectTasks).set({
    proyekId: data.proyekId,
    nama: data.nama,
    deskripsi: data.deskripsi,
    penanggungJawabId: data.penanggungJawabId,
    tanggalMulai: data.tanggalMulai,
    tenggat: data.tenggat,
    estimasiJam: data.estimasiJam,
    diubahPada: new Date(),
  }).where(eq(projectTasks.id, id)).returning()

  return tugas
}

export async function ubahStatusTugas(id: string, status: Tugas['status']): Promise<Tugas> {
  const lama = await ambilTugas(id)
  if (!lama) throw new ValidasiError('Tugas tidak ditemukan')
  await wajibProyekTerbuka(lama.proyekId)

  const [tugas] = await db.update(projectTasks)
    .set({ status, diubahPada: new Date() })
    .where(eq(projectTasks.id, id))
    .returning()
  return tugas
}

/**
 * Tugas yang sudah punya timesheet tidak dihapus melainkan dibatalkan —
 * jamnya sudah tercatat sebagai pekerjaan yang benar-benar dilakukan.
 */
export async function hapusTugas(id: string): Promise<void> {
  const tugas = await ambilTugas(id)
  if (!tugas) throw new ValidasiError('Tugas tidak ditemukan')

  const [adaJam] = await db.select({ id: timesheets.id }).from(timesheets)
    .where(eq(timesheets.tugasId, id)).limit(1)
  if (adaJam) {
    throw new ValidasiError(
      'Tugas ini sudah memiliki timesheet sehingga tidak dapat dihapus; batalkan saja.',
    )
  }

  await db.delete(projectTasks).where(eq(projectTasks.id, id))
}
