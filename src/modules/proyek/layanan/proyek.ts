import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import {
  projects, projectTasks, timesheets, salesOrders, journalItems,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { skemaProyek, type MasukanProyek } from '../validasi/proyek'

export type Proyek = typeof projects.$inferSelect
export type Tugas = typeof projectTasks.$inferSelect
export type Timesheet = typeof timesheets.$inferSelect

function urai(masukan: MasukanProyek) {
  const hasil = skemaProyek.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

// ── Pembacaan ────────────────────────────────────────────────────────────────

export async function daftarProyek(
  saring: { status?: Proyek['status'] } = {},
): Promise<Proyek[]> {
  const kueri = db.select().from(projects)
    .orderBy(desc(projects.tanggalMulai), asc(projects.kode))
  return saring.status ? kueri.where(eq(projects.status, saring.status)) : kueri
}

export async function ambilProyek(id: string): Promise<Proyek | null> {
  const [proyek] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
  return proyek ?? null
}

export async function proyekUntukPesanan(soId: string): Promise<Proyek | null> {
  const [proyek] = await db.select().from(projects).where(eq(projects.soId, soId)).limit(1)
  return proyek ?? null
}

/**
 * Pesanan penjualan yang belum dipegang proyek mana pun. Satu pesanan hanya
 * boleh dipegang satu proyek, jadi yang sudah terpakai tidak ditawarkan lagi —
 * kecuali pesanan yang sedang dibuka untuk diubah.
 */
export async function pesananTanpaProyek(kecualiSoId?: string) {
  const terpakai = await db.select({ soId: projects.soId }).from(projects)
  const idTerpakai = new Set(terpakai.map((p) => p.soId).filter((s) => s !== kecualiSoId))

  // Penawaran belum menjadi komitmen, dan pesanan batal tidak punya pekerjaan.
  const daftar = await db.select().from(salesOrders)
    .where(inArray(salesOrders.status, ['dikonfirmasi', 'selesai']))
    .orderBy(desc(salesOrders.tanggal))

  return daftar.filter((s) => !idTerpakai.has(s.id))
}

// ── Penulisan ────────────────────────────────────────────────────────────────

async function wajibPesananSah(
  tx: Transaksi, soId: string, kecualiProyekId?: string,
): Promise<string> {
  const [pesanan] = await tx.select().from(salesOrders)
    .where(eq(salesOrders.id, soId)).limit(1)
  if (!pesanan) throw new ValidasiError('Pesanan penjualan tidak ditemukan')
  if (pesanan.status === 'penawaran') {
    throw new ValidasiError(
      'Pesanan masih berupa penawaran; konfirmasikan dulu sebelum membuka proyeknya.',
    )
  }
  if (pesanan.status === 'dibatalkan') {
    throw new ValidasiError('Pesanan yang dibatalkan tidak dapat dijadikan proyek')
  }

  const [sudahAda] = await tx.select().from(projects)
    .where(eq(projects.soId, soId)).limit(1)
  if (sudahAda && sudahAda.id !== kecualiProyekId) {
    throw new ValidasiError(
      `Pesanan ${pesanan.nomor} sudah dipegang proyek ${sudahAda.kode}. ` +
      'Satu pesanan penjualan hanya boleh dipegang satu proyek.',
    )
  }

  return pesanan.partnerId
}

export async function buatProyek(masukan: MasukanProyek, dibuatOleh: string): Promise<Proyek> {
  const data = urai(masukan)

  const id = await db.transaction(async (tx) => {
    const partnerId = await wajibPesananSah(tx, data.soId)
    const [proyek] = await tx.insert(projects).values({
      kode: data.kode,
      nama: data.nama,
      soId: data.soId,
      // Pelanggan proyek selalu pelanggan pesanannya; menyimpannya terpisah
      // hanya akan membuka peluang keduanya berbeda.
      partnerId,
      status: 'draft',
      tanggalMulai: data.tanggalMulai,
      tanggalTarget: data.tanggalTarget,
      manajerId: data.manajerId,
      tarifPerJam: data.tarifPerJam,
      catatan: data.catatan,
      dibuatOleh,
    }).returning({ id: projects.id })
    return proyek.id
  })

  return (await ambilProyek(id))!
}

export async function ubahProyek(id: string, masukan: MasukanProyek): Promise<Proyek> {
  const data = urai(masukan)
  const lama = await ambilProyek(id)
  if (!lama) throw new ValidasiError('Proyek tidak ditemukan')
  if (lama.status === 'selesai' || lama.status === 'dibatalkan') {
    throw new ValidasiError('Proyek yang sudah ditutup tidak dapat diubah')
  }

  await db.transaction(async (tx) => {
    const partnerId = await wajibPesananSah(tx, data.soId, id)
    await tx.update(projects).set({
      kode: data.kode,
      nama: data.nama,
      soId: data.soId,
      partnerId,
      tanggalMulai: data.tanggalMulai,
      tanggalTarget: data.tanggalTarget,
      manajerId: data.manajerId,
      tarifPerJam: data.tarifPerJam,
      catatan: data.catatan,
      diubahPada: new Date(),
    }).where(eq(projects.id, id))
  })

  return (await ambilProyek(id))!
}

export async function mulaiProyek(id: string): Promise<Proyek> {
  const proyek = await ambilProyek(id)
  if (!proyek) throw new ValidasiError('Proyek tidak ditemukan')
  if (proyek.status !== 'draft') throw new ValidasiError('Proyek ini sudah dimulai')

  await db.update(projects)
    .set({ status: 'berjalan', diubahPada: new Date() })
    .where(eq(projects.id, id))
  return (await ambilProyek(id))!
}

/**
 * Menutup proyek. Tugas yang belum selesai menahannya — proyek yang ditutup
 * sementara pekerjaannya masih terbuka akan membuat laporan menyesatkan.
 */
export async function selesaikanProyek(id: string, tanggalSelesai: string): Promise<Proyek> {
  const proyek = await ambilProyek(id)
  if (!proyek) throw new ValidasiError('Proyek tidak ditemukan')
  if (proyek.status !== 'berjalan') {
    throw new ValidasiError('Hanya proyek yang sedang berjalan yang dapat diselesaikan')
  }
  if (tanggalSelesai < proyek.tanggalMulai) {
    throw new ValidasiError('Tanggal selesai tidak boleh mendahului tanggal mulai')
  }

  const terbuka = await db.select({ id: projectTasks.id }).from(projectTasks)
    .where(and(
      eq(projectTasks.proyekId, id),
      sql`${projectTasks.status} IN ('belum_mulai', 'berjalan')`,
    ))
  if (terbuka.length > 0) {
    throw new ValidasiError(
      `Masih ada ${terbuka.length} tugas yang belum selesai. ` +
      'Selesaikan atau batalkan tugasnya terlebih dahulu.',
    )
  }

  await db.update(projects)
    .set({ status: 'selesai', tanggalSelesai, diubahPada: new Date() })
    .where(eq(projects.id, id))
  return (await ambilProyek(id))!
}

export async function batalkanProyek(id: string): Promise<Proyek> {
  const proyek = await ambilProyek(id)
  if (!proyek) throw new ValidasiError('Proyek tidak ditemukan')
  if (proyek.status === 'selesai') {
    throw new ValidasiError('Proyek yang sudah selesai tidak dapat dibatalkan')
  }

  await db.update(projects)
    .set({ status: 'dibatalkan', diubahPada: new Date() })
    .where(eq(projects.id, id))
  return (await ambilProyek(id))!
}

export async function hapusProyek(id: string): Promise<void> {
  const proyek = await ambilProyek(id)
  if (!proyek) throw new ValidasiError('Proyek tidak ditemukan')
  if (proyek.status !== 'draft') {
    throw new ValidasiError(
      'Hanya proyek berstatus draft yang dapat dihapus; proyek yang sudah berjalan dibatalkan.',
    )
  }

  const [bertanda] = await db.select({ id: journalItems.id }).from(journalItems)
    .where(eq(journalItems.projectId, id)).limit(1)
  if (bertanda) {
    throw new ValidasiError(
      'Proyek ini sudah menjadi penanda pada item jurnal sehingga tidak dapat dihapus.',
    )
  }

  await db.delete(projects).where(eq(projects.id, id))
}
