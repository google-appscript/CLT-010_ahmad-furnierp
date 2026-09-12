import { asc, eq, ne, and } from 'drizzle-orm'
import { db } from '@/db/klien'
import { uoms, products } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { skemaUom, type MasukanUom } from '../validasi/uom'

export type Uom = typeof uoms.$inferSelect

export async function daftarUom(): Promise<Uom[]> {
  return db.select().from(uoms).orderBy(asc(uoms.kategori), asc(uoms.kode))
}

function urai(masukan: MasukanUom) {
  const hasil = skemaUom.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

async function wajibKodeBelumTerpakai(kode: string, kecualiId?: string): Promise<void> {
  const syarat = kecualiId
    ? and(eq(uoms.kode, kode), ne(uoms.id, kecualiId))
    : eq(uoms.kode, kode)
  const [ada] = await db.select().from(uoms).where(syarat).limit(1)
  if (ada) throw new ValidasiError(`Kode satuan ${kode} sudah dipakai`)
}

export async function buatUom(masukan: MasukanUom): Promise<Uom> {
  const data = urai(masukan)
  await wajibKodeBelumTerpakai(data.kode)
  const [uom] = await db.insert(uoms).values(data).returning()
  return uom
}

/**
 * Mengubah kategori atau faktor hanya berlaku untuk konversi berikutnya —
 * pergerakan stok yang sudah tercatat memakai kuantitas dasar yang sudah
 * dihitung saat itu dan tidak ikut berubah.
 */
export async function ubahUom(id: string, masukan: MasukanUom): Promise<Uom> {
  const data = urai(masukan)
  const [lama] = await db.select().from(uoms).where(eq(uoms.id, id)).limit(1)
  if (!lama) throw new ValidasiError('Satuan tidak ditemukan')
  await wajibKodeBelumTerpakai(data.kode, id)

  const [uom] = await db.update(uoms).set(data).where(eq(uoms.id, id)).returning()
  return uom
}

/**
 * Satuan dinonaktifkan, tidak dihapus. Satuan yang masih dipakai produk aktif
 * belum boleh dinonaktifkan sebab produk itu tidak boleh kehilangan satuannya.
 */
export async function ubahStatusUom(id: string, isActive: boolean): Promise<void> {
  const [uom] = await db.select().from(uoms).where(eq(uoms.id, id)).limit(1)
  if (!uom) throw new ValidasiError('Satuan tidak ditemukan')

  if (!isActive) {
    const [dipakai] = await db.select({ id: products.id }).from(products)
      .where(and(eq(products.uomId, id), eq(products.isActive, true))).limit(1)
    if (dipakai) {
      throw new ValidasiError(
        `Satuan ${uom.nama} masih dipakai produk aktif dan belum dapat dinonaktifkan.`,
      )
    }
  }

  await db.update(uoms).set({ isActive }).where(eq(uoms.id, id))
}
