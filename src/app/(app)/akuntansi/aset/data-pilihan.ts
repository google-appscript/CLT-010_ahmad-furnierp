import { asc, eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { assetCategories, partners } from '@/db/schema'
import { akunKasDanBank } from '@/modules/aset/layanan/aset'

export async function ambilDataPilihanAset() {
  const [kategori, mitra, akunKas] = await Promise.all([
    db.select({
      id: assetCategories.id, kode: assetCategories.kode, nama: assetCategories.nama,
      dapatDidepresiasi: assetCategories.dapatDidepresiasi,
      metodeBawaan: assetCategories.metodeBawaan,
      masaManfaatBulanBawaan: assetCategories.masaManfaatBulanBawaan,
    })
      .from(assetCategories)
      .where(eq(assetCategories.isActive, true))
      .orderBy(asc(assetCategories.kode)),
    db.select({ id: partners.id, nama: partners.nama })
      .from(partners).where(eq(partners.isActive, true)).orderBy(asc(partners.nama)),
    akunKasDanBank(),
  ])

  return {
    kategori,
    mitra,
    akunKas: akunKas.map((a) => ({ id: a.id, kode: a.kode, nama: a.nama })),
  }
}
