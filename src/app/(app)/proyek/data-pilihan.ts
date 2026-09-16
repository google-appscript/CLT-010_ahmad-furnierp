import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  users, partners, salesOrders, projects, projectTasks, workOrders,
} from '@/db/schema'
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

/**
 * Bahan pilihan formulir timesheet: proyek yang masih terbuka beserta tugas,
 * perintah produksi, dan pegawai yang dapat dipilih.
 */
export async function ambilProyekTerbuka() {
  const daftar = await db.select({
    id: projects.id, kode: projects.kode, nama: projects.nama,
    status: projects.status,
  })
    .from(projects)
    .where(inArray(projects.status, ['draft', 'berjalan']))
    .orderBy(asc(projects.kode))

  const idProyek = daftar.map((p) => p.id)

  const [tugas, perintahProduksi, pegawai] = await Promise.all([
    idProyek.length > 0
      ? db.select({
          id: projectTasks.id, proyekId: projectTasks.proyekId, nama: projectTasks.nama,
        })
          .from(projectTasks)
          .where(inArray(projectTasks.proyekId, idProyek))
          .orderBy(asc(projectTasks.urutan))
      : [],
    // Hanya perintah yang masih terbuka: upah yang menempel pada perintah
    // selesai tidak akan pernah terserap ke harga pokok.
    idProyek.length > 0
      ? db.select({
          id: workOrders.id, proyekId: workOrders.proyekId,
          nomor: workOrders.nomor, status: workOrders.status,
        })
          .from(workOrders)
          .where(and(
            inArray(workOrders.proyekId, idProyek),
            inArray(workOrders.status, ['draft', 'dikonfirmasi']),
          ))
          .orderBy(asc(workOrders.nomor))
      : [],
    db.select({
      id: partners.id, nama: partners.nama,
      tarif: partners.tarif, satuanTarif: partners.satuanTarif,
    })
      .from(partners)
      .where(and(eq(partners.isPegawai, true), eq(partners.isActive, true)))
      .orderBy(asc(partners.nama)),
  ])

  return { proyek: daftar, tugas, perintahProduksi, pegawai }
}

export async function nomorPesanan(soId: string): Promise<string | null> {
  const [so] = await db.select({ nomor: salesOrders.nomor }).from(salesOrders)
    .where(eq(salesOrders.id, soId)).limit(1)
  return so?.nomor ?? null
}
