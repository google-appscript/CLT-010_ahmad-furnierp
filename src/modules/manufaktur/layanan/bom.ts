import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { billOfMaterials, bomLines, products, uoms } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bagi, bulatkan, kali, type Uang } from '@/lib/uang'
import { skemaBom, type MasukanBom } from '../validasi/produksi'

export type Bom = typeof billOfMaterials.$inferSelect
export type BarisBom = typeof bomLines.$inferSelect
export type BomLengkap = Bom & { baris: BarisBom[] }

const DESIMAL_KUANTITAS = 6

function urai(masukan: MasukanBom) {
  const hasil = skemaBom.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

// ── Pembacaan ────────────────────────────────────────────────────────────────

export async function daftarBom(saring: { produkId?: string } = {}): Promise<Bom[]> {
  const kueri = db.select().from(billOfMaterials).orderBy(asc(billOfMaterials.kode))
  return saring.produkId
    ? kueri.where(eq(billOfMaterials.produkId, saring.produkId))
    : kueri
}

export async function ambilBom(id: string): Promise<BomLengkap | null> {
  const [bom] = await db.select().from(billOfMaterials)
    .where(eq(billOfMaterials.id, id)).limit(1)
  if (!bom) return null
  const baris = await db.select().from(bomLines)
    .where(eq(bomLines.bomId, id))
    .orderBy(asc(bomLines.urutan))
  return { ...bom, baris }
}

/** Resep aktif untuk sebuah produk, dipakai saat perintah produksi dibuat. */
export async function bomAktifUntukProduk(produkId: string): Promise<Bom[]> {
  return db.select().from(billOfMaterials)
    .where(and(
      eq(billOfMaterials.produkId, produkId),
      eq(billOfMaterials.isActive, true),
    ))
    .orderBy(asc(billOfMaterials.kode))
}

export type KebutuhanBahan = {
  produkId: string
  namaProduk: string
  kuantitas: Uang
  uomId: string
  namaUom: string
  catatan: string | null
}

/**
 * Menskalakan resep ke kuantitas produksi yang diminta.
 *
 * Resep boleh ditulis dalam takaran berapa pun — bahan untuk sepuluh kursi
 * sekaligus, misalnya — sehingga kebutuhannya selalu proporsi terhadap
 * `kuantitas` resep, bukan angka per satu unit.
 */
export async function kebutuhanBahan(
  bomId: string, kuantitasProduksi: string,
): Promise<KebutuhanBahan[]> {
  const bom = await ambilBom(bomId)
  if (!bom) throw new ValidasiError('Resep tidak ditemukan')
  if (Number(kuantitasProduksi) <= 0) {
    throw new ValidasiError('Kuantitas produksi harus lebih besar dari nol')
  }

  // Faktor sengaja tidak dibulatkan; pembulatan hanya di kuantitas akhir
  // agar galat pembagian tidak menumpuk di setiap bahan.
  const faktor = bagi(kuantitasProduksi, bom.kuantitas)

  const baris = await db
    .select({ baris: bomLines, namaProduk: products.nama, namaUom: uoms.nama })
    .from(bomLines)
    .innerJoin(products, eq(products.id, bomLines.produkId))
    .innerJoin(uoms, eq(uoms.id, bomLines.uomId))
    .where(eq(bomLines.bomId, bomId))
    .orderBy(asc(bomLines.urutan))

  return baris.map((b) => ({
    produkId: b.baris.produkId,
    namaProduk: b.namaProduk,
    kuantitas: bulatkan(kali(b.baris.kuantitas, faktor), DESIMAL_KUANTITAS),
    uomId: b.baris.uomId,
    namaUom: b.namaUom,
    catatan: b.baris.catatan,
  }))
}

// ── Penulisan ────────────────────────────────────────────────────────────────

async function wajibResepMasukAkal(
  produkId: string, baris: { produkId: string }[],
): Promise<void> {
  const [produk] = await db.select().from(products)
    .where(eq(products.id, produkId)).limit(1)
  if (!produk) throw new ValidasiError('Produk hasil tidak ditemukan')

  // Resep yang memuat produknya sendiri akan membuat perintah produksi
  // mengonsumsi barang yang justru sedang dibuatnya.
  if (baris.some((b) => b.produkId === produkId)) {
    throw new ValidasiError(
      `${produk.nama} tidak boleh menjadi bahan bagi dirinya sendiri`,
    )
  }

  const unik = new Set(baris.map((b) => b.produkId))
  if (unik.size !== baris.length) {
    throw new ValidasiError('Setiap bahan hanya boleh muncul satu kali dalam resep')
  }
}

export async function buatBom(masukan: MasukanBom, dibuatOleh: string): Promise<BomLengkap> {
  const data = urai(masukan)
  await wajibResepMasukAkal(data.produkId, data.baris)

  const id = await db.transaction(async (tx) => {
    const [bom] = await tx.insert(billOfMaterials).values({
      kode: data.kode,
      nama: data.nama,
      produkId: data.produkId,
      kuantitas: data.kuantitas,
      uomId: data.uomId,
      catatan: data.catatan,
      dibuatOleh,
    }).returning({ id: billOfMaterials.id })

    await tx.insert(bomLines).values(
      data.baris.map((b, i) => ({
        bomId: bom.id,
        urutan: i + 1,
        produkId: b.produkId,
        kuantitas: b.kuantitas,
        uomId: b.uomId,
        catatan: b.catatan,
      })),
    )

    return bom.id
  })

  return (await ambilBom(id))!
}

export async function ubahBom(id: string, masukan: MasukanBom): Promise<BomLengkap> {
  const data = urai(masukan)
  const lama = await ambilBom(id)
  if (!lama) throw new ValidasiError('Resep tidak ditemukan')
  await wajibResepMasukAkal(data.produkId, data.baris)

  await db.transaction(async (tx) => {
    await tx.update(billOfMaterials).set({
      kode: data.kode,
      nama: data.nama,
      produkId: data.produkId,
      kuantitas: data.kuantitas,
      uomId: data.uomId,
      catatan: data.catatan,
      diubahPada: new Date(),
    }).where(eq(billOfMaterials.id, id))

    await tx.delete(bomLines).where(eq(bomLines.bomId, id))
    await tx.insert(bomLines).values(
      data.baris.map((b, i) => ({
        bomId: id,
        urutan: i + 1,
        produkId: b.produkId,
        kuantitas: b.kuantitas,
        uomId: b.uomId,
        catatan: b.catatan,
      })),
    )
  })

  return (await ambilBom(id))!
}

/**
 * Resep dinonaktifkan, tidak dihapus — perintah produksi yang sudah berjalan
 * merujuknya, dan riwayat produksi harus tetap dapat ditelusuri.
 */
export async function ubahStatusBom(id: string, isActive: boolean): Promise<void> {
  const bom = await ambilBom(id)
  if (!bom) throw new ValidasiError('Resep tidak ditemukan')
  await db.update(billOfMaterials)
    .set({ isActive, diubahPada: new Date() })
    .where(eq(billOfMaterials.id, id))
}
