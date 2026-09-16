import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/klien'
import { accounts, taxes, partners, projects } from '@/db/schema'

export async function ambilDataPilihanTagihan() {
  const [akun, pajak, pemasok, proyek] = await Promise.all([
    db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama })
      .from(accounts).where(eq(accounts.isActive, true)).orderBy(asc(accounts.kode)),
    db.select({
      id: taxes.id, nama: taxes.nama, tarif: taxes.tarif, isPemotongan: taxes.isPemotongan,
    })
      .from(taxes)
      .where(and(eq(taxes.isActive, true), eq(taxes.ruangLingkup, 'pembelian')))
      .orderBy(asc(taxes.kode)),
    db.select({ id: partners.id, nama: partners.nama })
      .from(partners)
      .where(and(eq(partners.isActive, true), eq(partners.isPemasok, true)))
      .orderBy(asc(partners.nama)),
    // Proyek terkunci sengaja tidak ditawarkan: posting yang menandainya akan
    // ditolak `postingJurnalDalamTx()`, jadi lebih baik tidak bisa dipilih.
    db.select({ id: projects.id, kode: projects.kode, nama: projects.nama })
      .from(projects)
      .where(inArray(projects.status, ['draft', 'berjalan', 'selesai']))
      .orderBy(asc(projects.kode)),
  ])
  return { akun, pajak, pemasok, proyek }
}
