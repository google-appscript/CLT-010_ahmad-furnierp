import { asc, eq, ne, and } from 'drizzle-orm'
import { db } from '@/db/klien'
import { productCategories, products, accounts } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { skemaKategoriProduk, type MasukanKategoriProduk } from '../validasi/kategori'

export type KategoriProduk = typeof productCategories.$inferSelect

/** Tipe akun yang masuk akal untuk setiap peran akun pada kategori. */
const TIPE_SAH = {
  akunPersediaanId: ['aset_persediaan'],
  akunHppId: ['beban_hpp'],
  akunSelisihId: ['beban_hpp', 'beban_operasional', 'beban_lain'],
  akunBarangRusakId: ['beban_hpp', 'beban_operasional', 'beban_lain'],
} as const

const LABEL_PERAN: Record<keyof typeof TIPE_SAH, string> = {
  akunPersediaanId: 'Akun persediaan',
  akunHppId: 'Akun harga pokok',
  akunSelisihId: 'Akun selisih opname',
  akunBarangRusakId: 'Akun barang rusak',
}

export async function daftarKategoriProduk(): Promise<KategoriProduk[]> {
  return db.select().from(productCategories).orderBy(asc(productCategories.kode))
}

function urai(masukan: MasukanKategoriProduk) {
  const hasil = skemaKategoriProduk.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

/**
 * Memeriksa bahwa setiap akun benar-benar bertipe yang sesuai perannya.
 *
 * Tanpa pemeriksaan ini, salah pilih akun baru ketahuan berbulan-bulan
 * kemudian lewat laporan yang ganjil — persediaan yang mendarat di akun beban,
 * misalnya, tidak akan pernah muncul di neraca.
 */
async function wajibAkunSesuaiPeran(data: MasukanKategoriProduk): Promise<void> {
  const semua = await db.select().from(accounts)
  const lewatId = new Map(semua.map((a) => [a.id, a]))

  for (const peran of Object.keys(TIPE_SAH) as (keyof typeof TIPE_SAH)[]) {
    const id = data[peran] as string
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
    ? and(eq(productCategories.kode, kode), ne(productCategories.id, kecualiId))
    : eq(productCategories.kode, kode)
  const [ada] = await db.select().from(productCategories).where(syarat).limit(1)
  if (ada) throw new ValidasiError(`Kode kategori ${kode} sudah dipakai`)
}

export async function buatKategoriProduk(
  masukan: MasukanKategoriProduk,
): Promise<KategoriProduk> {
  const data = urai(masukan)
  await wajibKodeBelumTerpakai(data.kode)
  await wajibAkunSesuaiPeran(data)

  const [kategori] = await db.insert(productCategories).values(data).returning()
  return kategori
}

/**
 * Mengubah kategori berlaku untuk pergerakan stok berikutnya. Jurnal yang
 * sudah terbit memakai akun yang berlaku saat itu dan tidak ikut berubah.
 */
export async function ubahKategoriProduk(
  id: string, masukan: MasukanKategoriProduk,
): Promise<KategoriProduk> {
  const data = urai(masukan)
  const [lama] = await db.select().from(productCategories)
    .where(eq(productCategories.id, id)).limit(1)
  if (!lama) throw new ValidasiError('Kategori produk tidak ditemukan')

  await wajibKodeBelumTerpakai(data.kode, id)
  await wajibAkunSesuaiPeran(data)

  const [kategori] = await db.update(productCategories)
    .set(data).where(eq(productCategories.id, id)).returning()
  return kategori
}

/**
 * Kategori dinonaktifkan, tidak dihapus — produk yang sudah memakainya
 * beserta jurnalnya harus tetap dapat ditelusuri.
 */
export async function ubahStatusKategoriProduk(id: string, isActive: boolean): Promise<void> {
  const [kategori] = await db.select().from(productCategories)
    .where(eq(productCategories.id, id)).limit(1)
  if (!kategori) throw new ValidasiError('Kategori produk tidak ditemukan')

  if (!isActive) {
    const [dipakai] = await db.select({ id: products.id }).from(products)
      .where(and(eq(products.kategoriId, id), eq(products.isActive, true))).limit(1)
    if (dipakai) {
      throw new ValidasiError(
        `Kategori ${kategori.nama} masih dipakai produk aktif dan belum dapat dinonaktifkan.`,
      )
    }
  }

  await db.update(productCategories).set({ isActive }).where(eq(productCategories.id, id))
}
