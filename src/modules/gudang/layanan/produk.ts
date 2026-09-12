import { asc, eq, ne, and } from 'drizzle-orm'
import { db } from '@/db/klien'
import { products, productCategories, uoms } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { skemaProduk, type MasukanProduk } from '../validasi/produk'

export type Produk = typeof products.$inferSelect

export async function daftarProduk(): Promise<Produk[]> {
  return db.select().from(products).orderBy(asc(products.kode))
}

export async function ambilProduk(id: string): Promise<Produk | null> {
  const [produk] = await db.select().from(products).where(eq(products.id, id)).limit(1)
  return produk ?? null
}

function urai(masukan: MasukanProduk) {
  const hasil = skemaProduk.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

async function wajibKodeBelumTerpakai(kode: string, kecualiId?: string): Promise<void> {
  const syarat = kecualiId
    ? and(eq(products.kode, kode), ne(products.id, kecualiId))
    : eq(products.kode, kode)
  const [ada] = await db.select().from(products).where(syarat).limit(1)
  if (ada) throw new ValidasiError(`Kode produk ${kode} sudah dipakai`)
}

async function wajibKategoriDanUomAktif(data: MasukanProduk): Promise<void> {
  const [kategori] = await db.select().from(productCategories)
    .where(eq(productCategories.id, data.kategoriId)).limit(1)
  if (!kategori) throw new ValidasiError('Kategori produk tidak ditemukan')
  if (!kategori.isActive) throw new ValidasiError(`Kategori ${kategori.nama} sudah nonaktif`)

  const [uom] = await db.select().from(uoms).where(eq(uoms.id, data.uomId)).limit(1)
  if (!uom) throw new ValidasiError('Satuan tidak ditemukan')
  if (!uom.isActive) throw new ValidasiError(`Satuan ${uom.nama} sudah nonaktif`)
}

export async function buatProduk(masukan: MasukanProduk): Promise<Produk> {
  const data = urai(masukan)
  await wajibKodeBelumTerpakai(data.kode)
  await wajibKategoriDanUomAktif(data)

  const [produk] = await db.insert(products).values(data).returning()
  return produk
}

/**
 * Kategori dan satuan boleh diganti kapan pun — perubahan hanya berlaku untuk
 * pergerakan stok berikutnya. Harga pokok rata-rata tidak pernah diubah lewat
 * sini; nilainya murni turunan riwayat pergerakan stok.
 */
export async function ubahProduk(id: string, masukan: MasukanProduk): Promise<Produk> {
  const data = urai(masukan)
  const [lama] = await db.select().from(products).where(eq(products.id, id)).limit(1)
  if (!lama) throw new ValidasiError('Produk tidak ditemukan')

  await wajibKodeBelumTerpakai(data.kode, id)
  await wajibKategoriDanUomAktif(data)

  const [produk] = await db.update(products).set(data).where(eq(products.id, id)).returning()
  return produk
}

/** Produk dinonaktifkan, tidak dihapus — riwayat pergerakan stoknya harus tetap dapat ditelusuri. */
export async function ubahStatusProduk(id: string, isActive: boolean): Promise<void> {
  const [produk] = await db.select().from(products).where(eq(products.id, id)).limit(1)
  if (!produk) throw new ValidasiError('Produk tidak ditemukan')

  await db.update(products).set({ isActive }).where(eq(products.id, id))
}
