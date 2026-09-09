import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { products, uoms, taxes, partners, locations, paymentTerms } from '@/db/schema'

export async function ambilDataPilihanPenjualan() {
  const [produk, satuan, pajak, pelanggan, lokasi, syaratPembayaran] = await Promise.all([
    db.select({
      id: products.id, kode: products.kode, nama: products.nama,
      uomId: products.uomId, hargaJual: products.hargaJual,
    })
      .from(products).where(eq(products.isActive, true)).orderBy(asc(products.kode)),
    db.select({ id: uoms.id, nama: uoms.nama, kategori: uoms.kategori })
      .from(uoms).where(eq(uoms.isActive, true)).orderBy(asc(uoms.kode)),
    db.select({
      id: taxes.id, nama: taxes.nama, tarif: taxes.tarif, isPemotongan: taxes.isPemotongan,
    })
      .from(taxes)
      .where(and(eq(taxes.isActive, true), eq(taxes.ruangLingkup, 'penjualan')))
      .orderBy(asc(taxes.kode)),
    db.select({ id: partners.id, nama: partners.nama })
      .from(partners)
      .where(and(eq(partners.isActive, true), eq(partners.isPelanggan, true)))
      .orderBy(asc(partners.nama)),
    db.select({ id: locations.id, nama: locations.nama })
      .from(locations)
      .where(and(eq(locations.isActive, true), eq(locations.tipe, 'internal')))
      .orderBy(asc(locations.kode)),
    db.select({ id: paymentTerms.id, nama: paymentTerms.nama })
      .from(paymentTerms).where(eq(paymentTerms.isActive, true))
      .orderBy(asc(paymentTerms.jumlahHari)),
  ])
  return { produk, satuan, pajak, pelanggan, lokasi, syaratPembayaran }
}
