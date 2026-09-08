import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/db/klien'
import { currencies, currencyRates, fiscalYears, companySettings } from '@/db/schema'

export type MataUang = typeof currencies.$inferSelect
export type TahunBuku = typeof fiscalYears.$inferSelect
export type Pengaturan = typeof companySettings.$inferSelect
export type BarisKurs = { id: string; kodeMataUang: string; tanggal: string; kurs: string }

export async function ambilSemuaMataUang(): Promise<MataUang[]> {
  return db.select().from(currencies).orderBy(asc(currencies.kode))
}

export async function mataUangAda(kode: string): Promise<boolean> {
  const [ada] = await db.select({ kode: currencies.kode }).from(currencies)
    .where(eq(currencies.kode, kode)).limit(1)
  return Boolean(ada)
}

export async function ambilSemuaKurs(kodeMataUang?: string): Promise<BarisKurs[]> {
  const kueri = db.select({
    id: currencyRates.id,
    kodeMataUang: currencyRates.kodeMataUang,
    tanggal: currencyRates.tanggal,
    kurs: currencyRates.kurs,
  }).from(currencyRates).orderBy(desc(currencyRates.tanggal), asc(currencyRates.kodeMataUang))

  return kodeMataUang ? kueri.where(eq(currencyRates.kodeMataUang, kodeMataUang)) : kueri
}

/** Menimpa kurs bila tanggal dan mata uangnya sudah tercatat. */
export async function simpanKurs(kodeMataUang: string, tanggal: string, kurs: string): Promise<void> {
  await db.insert(currencyRates)
    .values({ kodeMataUang, tanggal, kurs })
    .onConflictDoUpdate({
      target: [currencyRates.kodeMataUang, currencyRates.tanggal],
      set: { kurs },
    })
}

export async function ambilSemuaTahunBuku(): Promise<TahunBuku[]> {
  return db.select().from(fiscalYears).orderBy(desc(fiscalYears.tanggalMulai))
}

export async function namaTahunBukuTerpakai(nama: string): Promise<boolean> {
  const [ada] = await db.select({ id: fiscalYears.id }).from(fiscalYears)
    .where(eq(fiscalYears.nama, nama)).limit(1)
  return Boolean(ada)
}

/**
 * Dua rentang bertumpang tindih bila yang satu dimulai sebelum yang lain
 * berakhir dan berakhir setelah yang lain dimulai — satu kondisi ini
 * menangkap seluruh bentuk tumpang tindih, termasuk pembungkusan penuh.
 */
export async function adaTahunBukuBertumpangTindih(
  tanggalMulai: string, tanggalSelesai: string,
): Promise<boolean> {
  const [ada] = await db.select({ id: fiscalYears.id }).from(fiscalYears)
    .where(and(
      lte(fiscalYears.tanggalMulai, tanggalSelesai),
      gte(fiscalYears.tanggalSelesai, tanggalMulai),
    ))
    .limit(1)
  return Boolean(ada)
}

export async function sisipkanTahunBuku(
  nilai: typeof fiscalYears.$inferInsert,
): Promise<TahunBuku> {
  const [tahun] = await db.insert(fiscalYears).values(nilai).returning()
  return tahun
}

export async function ambilPengaturanPerusahaan(): Promise<Pengaturan | null> {
  const [pengaturan] = await db.select().from(companySettings).limit(1)
  return pengaturan ?? null
}

export async function perbaruiPengaturanPerusahaan(
  id: string, nilai: Partial<typeof companySettings.$inferInsert>,
): Promise<void> {
  await db.update(companySettings)
    .set({ ...nilai, diubahPada: new Date() })
    .where(eq(companySettings.id, id))
}
