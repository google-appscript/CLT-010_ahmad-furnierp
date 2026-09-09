import { asc, eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { products, locations, uoms, billOfMaterials } from '@/db/schema'

/**
 * Data pilihan yang dibutuhkan formulir resep dan perintah produksi.
 * Dikumpulkan di satu tempat agar setiap halaman tidak mengulang kueri sama.
 */
export async function ambilDataPilihanManufaktur() {
  const [produk, lokasi, satuan, resep] = await Promise.all([
    db.select({
      id: products.id, kode: products.kode, nama: products.nama, uomId: products.uomId,
    })
      .from(products)
      .where(eq(products.tipe, 'disimpan'))
      .orderBy(asc(products.kode)),
    db.select({ id: locations.id, kode: locations.kode, nama: locations.nama })
      .from(locations)
      .where(eq(locations.tipe, 'internal'))
      .orderBy(asc(locations.kode)),
    db.select({ id: uoms.id, kode: uoms.kode, nama: uoms.nama })
      .from(uoms).where(eq(uoms.isActive, true)).orderBy(asc(uoms.kode)),
    db.select({
      id: billOfMaterials.id, kode: billOfMaterials.kode, nama: billOfMaterials.nama,
      produkId: billOfMaterials.produkId, kuantitas: billOfMaterials.kuantitas,
    })
      .from(billOfMaterials)
      .where(eq(billOfMaterials.isActive, true))
      .orderBy(asc(billOfMaterials.kode)),
  ])
  return { produk, lokasi, satuan, resep }
}
