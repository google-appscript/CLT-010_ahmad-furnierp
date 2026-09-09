import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { accounts, taxes, partners } from '@/db/schema'

export async function ambilDataPilihanFaktur() {
  const [akun, pajak, pelanggan] = await Promise.all([
    db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama })
      .from(accounts).where(eq(accounts.isActive, true)).orderBy(asc(accounts.kode)),
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
  ])
  return { akun, pajak, pelanggan }
}
