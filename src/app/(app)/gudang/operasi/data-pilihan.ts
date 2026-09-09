import { asc, eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { products, locations, uoms, partners } from '@/db/schema'

/**
 * Data pilihan yang dibutuhkan formulir operasi. Dikumpulkan di satu tempat
 * agar setiap halaman operasi tidak mengulang kueri yang sama.
 */
export async function ambilDataPilihan() {
  const [daftarProduk, daftarLokasi, daftarSatuan, daftarMitra] = await Promise.all([
    db.select({ id: products.id, kode: products.kode, nama: products.nama, uomId: products.uomId })
      .from(products)
      .where(eq(products.tipe, 'disimpan'))
      .orderBy(asc(products.kode)),
    db.select({ id: locations.id, kode: locations.kode, nama: locations.nama, tipe: locations.tipe })
      .from(locations).where(eq(locations.isActive, true)).orderBy(asc(locations.kode)),
    db.select({ id: uoms.id, kode: uoms.kode, nama: uoms.nama, kategori: uoms.kategori })
      .from(uoms).where(eq(uoms.isActive, true)).orderBy(asc(uoms.kode)),
    db.select({ id: partners.id, nama: partners.nama })
      .from(partners).where(eq(partners.isActive, true)).orderBy(asc(partners.nama)),
  ])
  return { daftarProduk, daftarLokasi, daftarSatuan, daftarMitra }
}

/** Lokasi bawaan untuk tipe operasi tertentu. */
export function lokasiBawaan(
  daftarLokasi: { id: string; tipe: string }[], tipeLokasi: string,
): string {
  return daftarLokasi.find((l) => l.tipe === tipeLokasi)?.id ?? ''
}
