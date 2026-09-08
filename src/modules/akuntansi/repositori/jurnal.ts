import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '@/db/klien'
import { journals } from '@/db/schema'

export type Jurnal = typeof journals.$inferSelect
export type JurnalBaru = typeof journals.$inferInsert
export type TipeJurnal = Jurnal['tipe']

export async function ambilSemuaJurnal(tipe?: TipeJurnal): Promise<Jurnal[]> {
  const kueri = db.select().from(journals).orderBy(asc(journals.kode))
  return tipe ? kueri.where(eq(journals.tipe, tipe)) : kueri
}

export async function ambilJurnalLewatId(id: string): Promise<Jurnal | null> {
  const [jurnal] = await db.select().from(journals).where(eq(journals.id, id)).limit(1)
  return jurnal ?? null
}

export async function kodeJurnalTerpakai(kode: string, kecualiId?: string): Promise<boolean> {
  const syarat = kecualiId
    ? and(eq(journals.kode, kode), ne(journals.id, kecualiId))
    : eq(journals.kode, kode)
  const [ada] = await db.select({ id: journals.id }).from(journals).where(syarat).limit(1)
  return Boolean(ada)
}

export async function perbaruiJurnal(id: string, nilai: Partial<JurnalBaru>): Promise<Jurnal> {
  const [jurnal] = await db.update(journals).set(nilai).where(eq(journals.id, id)).returning()
  return jurnal
}
