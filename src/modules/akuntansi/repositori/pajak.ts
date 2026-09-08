import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '@/db/klien'
import { taxes, paymentTerms } from '@/db/schema'

export type Pajak = typeof taxes.$inferSelect
export type PajakBaru = typeof taxes.$inferInsert
export type SyaratPembayaran = typeof paymentTerms.$inferSelect
export type SyaratPembayaranBaru = typeof paymentTerms.$inferInsert

export async function ambilSemuaPajak(ruangLingkup?: 'penjualan' | 'pembelian'): Promise<Pajak[]> {
  const kueri = db.select().from(taxes).orderBy(asc(taxes.kode))
  return ruangLingkup ? kueri.where(eq(taxes.ruangLingkup, ruangLingkup)) : kueri
}

export async function ambilPajakLewatId(id: string): Promise<Pajak | null> {
  const [pajak] = await db.select().from(taxes).where(eq(taxes.id, id)).limit(1)
  return pajak ?? null
}

export async function kodePajakTerpakai(kode: string, kecualiId?: string): Promise<boolean> {
  const syarat = kecualiId ? and(eq(taxes.kode, kode), ne(taxes.id, kecualiId)) : eq(taxes.kode, kode)
  const [ada] = await db.select({ id: taxes.id }).from(taxes).where(syarat).limit(1)
  return Boolean(ada)
}

export async function sisipkanPajak(nilai: PajakBaru): Promise<Pajak> {
  const [pajak] = await db.insert(taxes).values(nilai).returning()
  return pajak
}

export async function perbaruiPajak(id: string, nilai: Partial<PajakBaru>): Promise<Pajak> {
  const [pajak] = await db.update(taxes).set(nilai).where(eq(taxes.id, id)).returning()
  return pajak
}

export async function ambilSemuaSyarat(): Promise<SyaratPembayaran[]> {
  return db.select().from(paymentTerms).orderBy(asc(paymentTerms.jumlahHari))
}

export async function ambilSyaratLewatId(id: string): Promise<SyaratPembayaran | null> {
  const [syarat] = await db.select().from(paymentTerms).where(eq(paymentTerms.id, id)).limit(1)
  return syarat ?? null
}

export async function namaSyaratTerpakai(nama: string, kecualiId?: string): Promise<boolean> {
  const syarat = kecualiId
    ? and(eq(paymentTerms.nama, nama), ne(paymentTerms.id, kecualiId))
    : eq(paymentTerms.nama, nama)
  const [ada] = await db.select({ id: paymentTerms.id }).from(paymentTerms).where(syarat).limit(1)
  return Boolean(ada)
}

export async function sisipkanSyarat(nilai: SyaratPembayaranBaru): Promise<SyaratPembayaran> {
  const [syarat] = await db.insert(paymentTerms).values(nilai).returning()
  return syarat
}

export async function perbaruiSyarat(
  id: string, nilai: Partial<SyaratPembayaranBaru>,
): Promise<SyaratPembayaran> {
  const [syarat] = await db.update(paymentTerms).set(nilai).where(eq(paymentTerms.id, id)).returning()
  return syarat
}
