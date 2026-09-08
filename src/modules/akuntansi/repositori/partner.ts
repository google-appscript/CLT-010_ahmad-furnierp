import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '@/db/klien'
import { partners } from '@/db/schema'

export type Partner = typeof partners.$inferSelect
export type PartnerBaru = typeof partners.$inferInsert
export type SaringPartner = { peran?: 'pelanggan' | 'pemasok' }

export async function ambilSemuaPartner(saring: SaringPartner = {}): Promise<Partner[]> {
  const syarat =
    saring.peran === 'pelanggan' ? eq(partners.isPelanggan, true)
    : saring.peran === 'pemasok' ? eq(partners.isPemasok, true)
    : undefined

  const kueri = db.select().from(partners).orderBy(asc(partners.nama))
  return syarat ? kueri.where(syarat) : kueri
}

export async function ambilPartnerLewatId(id: string): Promise<Partner | null> {
  const [mitra] = await db.select().from(partners).where(eq(partners.id, id)).limit(1)
  return mitra ?? null
}

export async function kodePartnerTerpakai(kode: string, kecualiId?: string): Promise<boolean> {
  const syarat = kecualiId
    ? and(eq(partners.kode, kode), ne(partners.id, kecualiId))
    : eq(partners.kode, kode)
  const [ada] = await db.select({ id: partners.id }).from(partners).where(syarat).limit(1)
  return Boolean(ada)
}

export async function sisipkanPartner(nilai: PartnerBaru): Promise<Partner> {
  const [mitra] = await db.insert(partners).values(nilai).returning()
  return mitra
}

export async function perbaruiPartner(id: string, nilai: Partial<PartnerBaru>): Promise<Partner> {
  const [mitra] = await db.update(partners)
    .set({ ...nilai, diubahPada: new Date() })
    .where(eq(partners.id, id))
    .returning()
  return mitra
}
