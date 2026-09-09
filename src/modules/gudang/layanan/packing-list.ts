import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { packingLists, packingListItems, stockOperations } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { ambilNomorBerikut } from '@/modules/akuntansi/layanan/urutan'
import { skemaPackingList, type MasukanPackingList } from '../validasi/operasi'

export type PackingList = typeof packingLists.$inferSelect
export type ItemPackingList = typeof packingListItems.$inferSelect
export type PackingListLengkap = PackingList & { item: ItemPackingList[] }

const KODE_URUTAN = 'gudang:packing-list'

export async function daftarPackingList(): Promise<PackingList[]> {
  return db.select().from(packingLists).orderBy(desc(packingLists.tanggal), desc(packingLists.nomor))
}

export async function ambilPackingList(id: string): Promise<PackingListLengkap | null> {
  const [pl] = await db.select().from(packingLists).where(eq(packingLists.id, id)).limit(1)
  if (!pl) return null
  const item = await db.select().from(packingListItems)
    .where(eq(packingListItems.packingListId, id))
    .orderBy(asc(packingListItems.urutan))
  return { ...pl, item }
}

/**
 * Packing list adalah dokumen pendamping pengiriman, bukan pencatat stok.
 * Ia hanya merinci pembagian barang ke dalam koli, sehingga tidak
 * menghasilkan pergerakan stok maupun jurnal tersendiri.
 */
export async function buatPackingList(masukan: MasukanPackingList): Promise<PackingListLengkap> {
  const hasil = skemaPackingList.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  const [operasi] = await db.select().from(stockOperations)
    .where(eq(stockOperations.id, data.operasiId)).limit(1)
  if (!operasi) throw new ValidasiError('Pengiriman tidak ditemukan')
  if (operasi.tipe !== 'pengiriman') {
    throw new ValidasiError('Packing list hanya dapat dibuat untuk dokumen pengiriman')
  }

  const id = await db.transaction(async (tx) => {
    const nomor = await ambilNomorBerikut(
      tx, KODE_URUTAN, new Date(`${data.tanggal}T00:00:00Z`),
    )

    const [pl] = await tx.insert(packingLists).values({
      nomor, operasiId: data.operasiId, tanggal: data.tanggal, catatan: data.catatan,
    }).returning({ id: packingLists.id })

    await tx.insert(packingListItems).values(
      data.item.map((b, i) => ({
        packingListId: pl.id,
        urutan: i + 1,
        nomorKoli: b.nomorKoli,
        produkId: b.produkId,
        kuantitas: b.kuantitas,
        beratKg: b.beratKg,
        catatan: b.catatan,
      })),
    )

    return pl.id
  })

  return (await ambilPackingList(id))!
}

export async function hapusPackingList(id: string): Promise<void> {
  const pl = await ambilPackingList(id)
  if (!pl) throw new ValidasiError('Packing list tidak ditemukan')
  await db.delete(packingLists).where(eq(packingLists.id, id))
}
