import { and, eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { filterTersimpan } from '@/db/schema'

export async function simpanFilter(data: {
  penggunaId: string
  kunciDaftar: string
  nama: string
  kriteria: unknown
}): Promise<{ id: string }> {
  const [baris] = await db.insert(filterTersimpan).values({
    penggunaId: data.penggunaId,
    kunciDaftar: data.kunciDaftar,
    nama: data.nama,
    kriteria: data.kriteria,
  }).returning({ id: filterTersimpan.id })
  return baris
}

export async function daftarFilter(
  penggunaId: string,
  kunciDaftar: string,
): Promise<{ id: string; nama: string; kriteria: unknown }[]> {
  return db.select({
    id: filterTersimpan.id,
    nama: filterTersimpan.nama,
    kriteria: filterTersimpan.kriteria,
  }).from(filterTersimpan)
    .where(and(
      eq(filterTersimpan.penggunaId, penggunaId),
      eq(filterTersimpan.kunciDaftar, kunciDaftar),
    ))
}

/** Hapus hanya jika `penggunaId` cocok — tidak boleh menghapus favorit pengguna lain. */
export async function hapusFilter(id: string, penggunaId: string): Promise<void> {
  await db.delete(filterTersimpan)
    .where(and(eq(filterTersimpan.id, id), eq(filterTersimpan.penggunaId, penggunaId)))
}
