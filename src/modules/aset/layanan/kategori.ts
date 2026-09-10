import { asc, eq, ne, and } from 'drizzle-orm'
import { db } from '@/db/klien'
import { assetCategories, fixedAssets, accounts } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { skemaKategoriAset, type MasukanKategoriAset } from '../validasi/kategori'

export type KategoriAset = typeof assetCategories.$inferSelect

const TIPE_SAH = {
  akunAsetId: ['aset_tetap'],
  akunAkumulasiId: ['aset_akumulasi_depresiasi'],
  akunBebanId: ['beban_depresiasi'],
} as const

const LABEL_PERAN: Record<keyof typeof TIPE_SAH, string> = {
  akunAsetId: 'Akun aset',
  akunAkumulasiId: 'Akun akumulasi depresiasi',
  akunBebanId: 'Akun beban depresiasi',
}

export async function daftarKategoriAset(): Promise<KategoriAset[]> {
  return db.select().from(assetCategories).orderBy(asc(assetCategories.kode))
}

function urai(masukan: MasukanKategoriAset) {
  const hasil = skemaKategoriAset.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

async function wajibAkunSesuaiPeran(data: MasukanKategoriAset): Promise<void> {
  const semua = await db.select().from(accounts)
  const lewatId = new Map(semua.map((a) => [a.id, a]))

  for (const peran of Object.keys(TIPE_SAH) as (keyof typeof TIPE_SAH)[]) {
    const id = data[peran] as string | null
    // Kategori yang tidak disusutkan boleh mengosongkan akumulasi dan bebannya.
    if (!id) continue
    const akun = lewatId.get(id)
    if (!akun) throw new ValidasiError(`${LABEL_PERAN[peran]} tidak ditemukan`)
    if (!akun.isActive) {
      throw new ValidasiError(`${LABEL_PERAN[peran]} ${akun.nama} sudah nonaktif`)
    }
    if (!(TIPE_SAH[peran] as readonly string[]).includes(akun.tipeAkun)) {
      throw new ValidasiError(
        `${LABEL_PERAN[peran]} harus berupa akun bertipe yang sesuai; ` +
        `${akun.kode} ${akun.nama} bertipe lain.`,
      )
    }
  }
}

async function wajibKodeBelumTerpakai(kode: string, kecualiId?: string): Promise<void> {
  const syarat = kecualiId
    ? and(eq(assetCategories.kode, kode), ne(assetCategories.id, kecualiId))
    : eq(assetCategories.kode, kode)
  const [ada] = await db.select().from(assetCategories).where(syarat).limit(1)
  if (ada) throw new ValidasiError(`Kode kategori ${kode} sudah dipakai`)
}

export async function buatKategoriAset(masukan: MasukanKategoriAset): Promise<KategoriAset> {
  const data = urai(masukan)
  await wajibKodeBelumTerpakai(data.kode)
  await wajibAkunSesuaiPeran(data)

  const [kategori] = await db.insert(assetCategories).values(data).returning()
  return kategori
}

export async function ubahKategoriAset(
  id: string, masukan: MasukanKategoriAset,
): Promise<KategoriAset> {
  const data = urai(masukan)
  const [lama] = await db.select().from(assetCategories)
    .where(eq(assetCategories.id, id)).limit(1)
  if (!lama) throw new ValidasiError('Kategori aset tidak ditemukan')

  await wajibKodeBelumTerpakai(data.kode, id)
  await wajibAkunSesuaiPeran(data)

  // Aset yang jadwalnya sudah berjalan tetap memakai akun yang berlaku saat
  // dijalankan; mengubah kategori tidak menulis ulang jurnal yang sudah ada.
  const [kategori] = await db.update(assetCategories)
    .set(data).where(eq(assetCategories.id, id)).returning()
  return kategori
}

export async function ubahStatusKategoriAset(id: string, isActive: boolean): Promise<void> {
  const [kategori] = await db.select().from(assetCategories)
    .where(eq(assetCategories.id, id)).limit(1)
  if (!kategori) throw new ValidasiError('Kategori aset tidak ditemukan')

  if (!isActive) {
    const [dipakai] = await db.select({ id: fixedAssets.id }).from(fixedAssets)
      .where(and(eq(fixedAssets.kategoriId, id), ne(fixedAssets.status, 'dilepas'))).limit(1)
    if (dipakai) {
      throw new ValidasiError(
        `Kategori ${kategori.nama} masih dipakai aset yang belum dilepas.`,
      )
    }
  }

  await db.update(assetCategories).set({ isActive }).where(eq(assetCategories.id, id))
}
