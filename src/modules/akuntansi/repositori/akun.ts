import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '@/db/klien'
import { accounts } from '@/db/schema'

export type Akun = typeof accounts.$inferSelect
export type AkunBaru = typeof accounts.$inferInsert

export async function ambilSemuaAkun(): Promise<Akun[]> {
  return db.select().from(accounts).orderBy(asc(accounts.kode))
}

export async function ambilAkunLewatId(id: string): Promise<Akun | null> {
  const [akun] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1)
  return akun ?? null
}

export async function kodeAkunTerpakai(kode: string, kecualiId?: string): Promise<boolean> {
  const syarat = kecualiId
    ? and(eq(accounts.kode, kode), ne(accounts.id, kecualiId))
    : eq(accounts.kode, kode)
  const [ada] = await db.select({ id: accounts.id }).from(accounts).where(syarat).limit(1)
  return Boolean(ada)
}

export async function sisipkanAkun(nilai: AkunBaru): Promise<Akun> {
  const [akun] = await db.insert(accounts).values(nilai).returning()
  return akun
}

export async function perbaruiAkun(id: string, nilai: Partial<AkunBaru>): Promise<Akun> {
  const [akun] = await db.update(accounts)
    .set({ ...nilai, diubahPada: new Date() })
    .where(eq(accounts.id, id))
    .returning()
  return akun
}
