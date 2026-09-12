import { asc, eq, ne, and } from 'drizzle-orm'
import { db } from '@/db/klien'
import { warehouses, locations } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import {
  skemaWarehouse, skemaLokasiBaru, skemaLokasiUbah,
  type MasukanWarehouse, type MasukanLokasiBaru, type MasukanLokasiUbah,
} from '../validasi/lokasi'

export type Warehouse = typeof warehouses.$inferSelect
export type Lokasi = typeof locations.$inferSelect

const TIPE_VIRTUAL_SINGLETON = [
  'pemasok', 'pelanggan', 'penyesuaian', 'rusak', 'produksi',
] as const

// ── Gudang ───────────────────────────────────────────────────────────────────

export async function daftarWarehouse(): Promise<Warehouse[]> {
  return db.select().from(warehouses).orderBy(asc(warehouses.kode))
}

function uraiWarehouse(masukan: MasukanWarehouse) {
  const hasil = skemaWarehouse.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

async function wajibKodeWarehouseBelumTerpakai(kode: string, kecualiId?: string): Promise<void> {
  const syarat = kecualiId
    ? and(eq(warehouses.kode, kode), ne(warehouses.id, kecualiId))
    : eq(warehouses.kode, kode)
  const [ada] = await db.select().from(warehouses).where(syarat).limit(1)
  if (ada) throw new ValidasiError(`Kode gudang ${kode} sudah dipakai`)
}

export async function buatWarehouse(masukan: MasukanWarehouse): Promise<Warehouse> {
  const data = uraiWarehouse(masukan)
  await wajibKodeWarehouseBelumTerpakai(data.kode)
  const [gudang] = await db.insert(warehouses).values(data).returning()
  return gudang
}

export async function ubahWarehouse(id: string, masukan: MasukanWarehouse): Promise<Warehouse> {
  const data = uraiWarehouse(masukan)
  const [lama] = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1)
  if (!lama) throw new ValidasiError('Gudang tidak ditemukan')
  await wajibKodeWarehouseBelumTerpakai(data.kode, id)
  const [gudang] = await db.update(warehouses).set(data).where(eq(warehouses.id, id)).returning()
  return gudang
}

/**
 * Gudang dinonaktifkan, tidak dihapus. Lokasi internal yang masih menunjuk
 * padanya harus dinonaktifkan lebih dulu agar tidak ada lokasi aktif yang
 * kehilangan gudangnya.
 */
export async function ubahStatusWarehouse(id: string, isActive: boolean): Promise<void> {
  const [gudang] = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1)
  if (!gudang) throw new ValidasiError('Gudang tidak ditemukan')

  if (!isActive) {
    const [dipakai] = await db.select({ id: locations.id }).from(locations)
      .where(and(eq(locations.warehouseId, id), eq(locations.isActive, true))).limit(1)
    if (dipakai) {
      throw new ValidasiError(
        `Gudang ${gudang.nama} masih memiliki lokasi aktif dan belum dapat dinonaktifkan.`,
      )
    }
  }

  await db.update(warehouses).set({ isActive }).where(eq(warehouses.id, id))
}

// ── Lokasi ───────────────────────────────────────────────────────────────────

export async function daftarLokasi(): Promise<Lokasi[]> {
  return db.select().from(locations).orderBy(asc(locations.kode))
}

async function wajibKodeLokasiBelumTerpakai(kode: string, kecualiId?: string): Promise<void> {
  const syarat = kecualiId
    ? and(eq(locations.kode, kode), ne(locations.id, kecualiId))
    : eq(locations.kode, kode)
  const [ada] = await db.select().from(locations).where(syarat).limit(1)
  if (ada) throw new ValidasiError(`Kode lokasi ${kode} sudah dipakai`)
}

async function wajibRelasiValid(
  data: { warehouseId: string | null; parentId: string | null }, id?: string,
): Promise<void> {
  if (data.warehouseId) {
    const [gudang] = await db.select().from(warehouses)
      .where(eq(warehouses.id, data.warehouseId)).limit(1)
    if (!gudang) throw new ValidasiError('Gudang tidak ditemukan')
  }
  if (data.parentId) {
    if (data.parentId === id) {
      throw new ValidasiError('Lokasi tidak boleh menjadi induk bagi dirinya sendiri')
    }
    const [induk] = await db.select().from(locations)
      .where(eq(locations.id, data.parentId)).limit(1)
    if (!induk) throw new ValidasiError('Lokasi induk tidak ditemukan')
  }
}

/**
 * Hanya lokasi internal dan transit yang boleh dibuat lewat menu ini — lokasi
 * virtual (Pemasok, Pelanggan, Penyesuaian, Barang Rusak, Produksi) adalah
 * penampung tunggal yang dibaca modul lain lewat tipenya; lokasi virtual
 * kedua akan membuat pemilihannya ambigu, jadi divalidasi lewat skema.
 */
export async function buatLokasi(masukan: MasukanLokasiBaru): Promise<Lokasi> {
  const hasil = skemaLokasiBaru.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  await wajibKodeLokasiBelumTerpakai(data.kode)
  await wajibRelasiValid(data)

  const [lokasi] = await db.insert(locations).values(data).returning()
  return lokasi
}

/** Tipe lokasi tidak dapat diubah setelah dibuat — operasi gudang membacanya lewat tipe itu. */
export async function ubahLokasi(id: string, masukan: MasukanLokasiUbah): Promise<Lokasi> {
  const hasil = skemaLokasiUbah.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  const [lama] = await db.select().from(locations).where(eq(locations.id, id)).limit(1)
  if (!lama) throw new ValidasiError('Lokasi tidak ditemukan')
  if (lama.tipe === 'internal' && !data.warehouseId) {
    throw new ValidasiError('Lokasi internal wajib memilih gudang')
  }
  await wajibKodeLokasiBelumTerpakai(data.kode, id)
  await wajibRelasiValid(data, id)

  const [lokasi] = await db.update(locations).set({
    kode: data.kode,
    nama: data.nama,
    warehouseId: data.warehouseId,
    parentId: data.parentId,
  }).where(eq(locations.id, id)).returning()
  return lokasi
}

/**
 * Lokasi dinonaktifkan, tidak dihapus. Untuk lokasi virtual — penampung
 * tunggal tipenya yang dibaca modul pembelian/penjualan/manufaktur — menonaktifkan
 * satu-satunya yang aktif akan menghentikan operasi yang bergantung padanya,
 * sehingga dicegah kecuali ada penggantinya yang sudah aktif.
 */
export async function ubahStatusLokasi(id: string, isActive: boolean): Promise<void> {
  const [lokasi] = await db.select().from(locations).where(eq(locations.id, id)).limit(1)
  if (!lokasi) throw new ValidasiError('Lokasi tidak ditemukan')

  if (!isActive && (TIPE_VIRTUAL_SINGLETON as readonly string[]).includes(lokasi.tipe)) {
    const penggantiAktif = await db.select({ id: locations.id }).from(locations)
      .where(and(
        eq(locations.tipe, lokasi.tipe), eq(locations.isActive, true), ne(locations.id, id),
      )).limit(1)
    if (penggantiAktif.length === 0) {
      throw new ValidasiError(
        `${lokasi.nama} satu-satunya lokasi bertipe ${lokasi.tipe} yang aktif; operasi yang ` +
        'bergantung padanya akan berhenti. Aktifkan lokasi pengganti dahulu.',
      )
    }
  }

  await db.update(locations).set({ isActive }).where(eq(locations.id, id))
}
