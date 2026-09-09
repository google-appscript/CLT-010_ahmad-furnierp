import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/klien'
import { users, partners, salesOrders, projects, projectTasks } from '@/db/schema'
import { pesananTanpaProyek } from '@/modules/proyek/layanan/proyek'

export async function ambilDataPilihanProyek(kecualiSoId?: string) {
  const [pengguna, pesanan] = await Promise.all([
    db.select({ id: users.id, nama: users.nama })
      .from(users).where(eq(users.isActive, true)).orderBy(asc(users.nama)),
    pesananTanpaProyek(kecualiSoId),
  ])

  const idMitra = [...new Set(pesanan.map((p) => p.partnerId))]
  const mitra = idMitra.length > 0
    ? await db.select({ id: partners.id, nama: partners.nama })
        .from(partners).where(inArray(partners.id, idMitra))
    : []
  const namaMitra = new Map(mitra.map((m) => [m.id, m.nama]))

  return {
    pengguna,
    pesanan: pesanan.map((p) => ({
      id: p.id,
      nomor: p.nomor ?? '—',
      tanggal: p.tanggal,
      namaPelanggan: namaMitra.get(p.partnerId) ?? '—',
    })),
  }
}

/** Proyek yang masih menerima tugas dan timesheet, beserta tugasnya. */
export async function ambilProyekTerbuka() {
  const daftar = await db.select({
    id: projects.id, kode: projects.kode, nama: projects.nama,
    status: projects.status, tarifPerJam: projects.tarifPerJam,
  })
    .from(projects)
    .where(inArray(projects.status, ['draft', 'berjalan']))
    .orderBy(asc(projects.kode))

  const tugas = daftar.length > 0
    ? await db.select({
        id: projectTasks.id, proyekId: projectTasks.proyekId, nama: projectTasks.nama,
      })
        .from(projectTasks)
        .where(inArray(projectTasks.proyekId, daftar.map((p) => p.id)))
        .orderBy(asc(projectTasks.urutan))
    : []

  return { proyek: daftar, tugas }
}

export async function nomorPesanan(soId: string): Promise<string | null> {
  const [so] = await db.select({ nomor: salesOrders.nomor }).from(salesOrders)
    .where(eq(salesOrders.id, soId)).limit(1)
  return so?.nomor ?? null
}
