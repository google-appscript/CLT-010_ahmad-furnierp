import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import { products, locations, stockMoves, productCategories, uoms } from '@/db/schema'
import type { Uang } from '@/lib/uang'

/**
 * Stok dihitung dari riwayat pergerakan, bukan disimpan sebagai angka
 * tersendiri. Dengan begitu saldo stok tidak pernah bisa menyimpang dari
 * kartu stoknya. Barang masuk adalah pergerakan menuju lokasi internal,
 * barang keluar adalah pergerakan meninggalkannya; transfer antar lokasi
 * internal saling meniadakan sehingga tidak mengubah stok perusahaan.
 */
const MASUK = sql<string>`COALESCE(SUM(CASE WHEN tujuan.tipe = 'internal' THEN ${stockMoves.kuantitas} ELSE 0 END), 0)`
const KELUAR = sql<string>`COALESCE(SUM(CASE WHEN asal.tipe = 'internal' THEN ${stockMoves.kuantitas} ELSE 0 END), 0)`

export type StokProduk = {
  produkId: string
  kode: string
  nama: string
  namaUom: string
  hargaPokokRataRata: Uang
  stok: Uang
  nilai: Uang
}

export async function stokSeluruhProduk(sampaiIso?: string): Promise<StokProduk[]> {
  const batas = sampaiIso ? lte(stockMoves.tanggal, sampaiIso) : undefined

  const baris = await db
    .select({
      produkId: products.id,
      kode: products.kode,
      nama: products.nama,
      namaUom: uoms.nama,
      hargaPokokRataRata: products.hargaPokokRataRata,
      stok: sql<string>`(${MASUK} - ${KELUAR})::text`,
    })
    .from(products)
    .innerJoin(uoms, eq(uoms.id, products.uomId))
    .leftJoin(stockMoves, batas
      ? and(eq(stockMoves.produkId, products.id), batas)
      : eq(stockMoves.produkId, products.id))
    .leftJoin(sql`locations AS asal`, sql`asal.id = ${stockMoves.lokasiAsalId}`)
    .leftJoin(sql`locations AS tujuan`, sql`tujuan.id = ${stockMoves.lokasiTujuanId}`)
    .where(eq(products.tipe, 'disimpan'))
    .groupBy(products.id, products.kode, products.nama, uoms.nama, products.hargaPokokRataRata)
    .orderBy(asc(products.kode))

  return baris.map((b) => ({
    ...b,
    stok: Number(b.stok).toFixed(6),
    hargaPokokRataRata: Number(b.hargaPokokRataRata).toFixed(6),
    nilai: (Number(b.stok) * Number(b.hargaPokokRataRata)).toFixed(2),
  }))
}

/**
 * Stok satu produk pada satu lokasi internal, dibaca di dalam transaksi
 * berjalan agar pemeriksaan kecukupan stok dan penulisan pergerakan melihat
 * keadaan yang sama.
 */
export async function stokDiLokasi(
  tx: Transaksi, produkId: string, lokasiId: string,
): Promise<Uang> {
  const hasil = await tx.execute<{ stok: string }>(sql`
    SELECT COALESCE(SUM(
      CASE WHEN lokasi_tujuan_id = ${lokasiId} THEN kuantitas
           WHEN lokasi_asal_id = ${lokasiId} THEN -kuantitas
           ELSE 0 END
    ), 0)::text AS stok
    FROM stock_moves
    WHERE produk_id = ${produkId}
      AND (lokasi_asal_id = ${lokasiId} OR lokasi_tujuan_id = ${lokasiId})
  `)
  const baris = (hasil as unknown as { stok: string }[])[0]
  return Number(baris?.stok ?? 0).toFixed(6)
}

/** Stok seluruh perusahaan untuk satu produk, di dalam transaksi berjalan. */
export async function stokProdukDalamTx(tx: Transaksi, produkId: string): Promise<Uang> {
  const hasil = await tx.execute<{ stok: string }>(sql`
    SELECT COALESCE(SUM(
      CASE WHEN tujuan.tipe = 'internal' THEN m.kuantitas ELSE 0 END
      - CASE WHEN asal.tipe = 'internal' THEN m.kuantitas ELSE 0 END
    ), 0)::text AS stok
    FROM stock_moves m
    JOIN locations asal ON asal.id = m.lokasi_asal_id
    JOIN locations tujuan ON tujuan.id = m.lokasi_tujuan_id
    WHERE m.produk_id = ${produkId}
  `)
  const baris = (hasil as unknown as { stok: string }[])[0]
  return Number(baris?.stok ?? 0).toFixed(6)
}

export type StokPerLokasi = {
  lokasiId: string
  kodeLokasi: string
  namaLokasi: string
  stok: Uang
}

export async function stokProdukPerLokasi(produkId: string): Promise<StokPerLokasi[]> {
  const hasil = await db.execute<StokPerLokasi>(sql`
    SELECT l.id AS "lokasiId", l.kode AS "kodeLokasi", l.nama AS "namaLokasi",
           SUM(
             CASE WHEN m.lokasi_tujuan_id = l.id THEN m.kuantitas ELSE 0 END
             - CASE WHEN m.lokasi_asal_id = l.id THEN m.kuantitas ELSE 0 END
           )::text AS stok
    FROM locations l
    JOIN stock_moves m
      ON (m.lokasi_asal_id = l.id OR m.lokasi_tujuan_id = l.id)
    WHERE l.tipe = 'internal' AND m.produk_id = ${produkId}
    GROUP BY l.id, l.kode, l.nama
    HAVING SUM(
      CASE WHEN m.lokasi_tujuan_id = l.id THEN m.kuantitas ELSE 0 END
      - CASE WHEN m.lokasi_asal_id = l.id THEN m.kuantitas ELSE 0 END
    ) <> 0
    ORDER BY l.kode
  `)
  return (hasil as unknown as StokPerLokasi[]).map((b) => ({
    ...b, stok: Number(b.stok).toFixed(6),
  }))
}

export type BarisKartuStok = {
  moveId: string
  tanggal: string
  nomorOperasi: string | null
  tipeOperasi: string | null
  namaAsal: string
  namaTujuan: string
  masuk: Uang
  keluar: Uang
  hargaPokokSatuan: Uang
  nilaiTotal: Uang
}

export async function kartuStok(
  produkId: string, dariIso: string, sampaiIso: string,
): Promise<BarisKartuStok[]> {
  const hasil = await db.execute<BarisKartuStok>(sql`
    SELECT m.id AS "moveId", m.tanggal::text AS tanggal,
           o.nomor AS "nomorOperasi", o.tipe::text AS "tipeOperasi",
           asal.nama AS "namaAsal", tujuan.nama AS "namaTujuan",
           (CASE WHEN tujuan.tipe = 'internal' AND asal.tipe <> 'internal'
                 THEN m.kuantitas ELSE 0 END)::text AS masuk,
           (CASE WHEN asal.tipe = 'internal' AND tujuan.tipe <> 'internal'
                 THEN m.kuantitas ELSE 0 END)::text AS keluar,
           m.harga_pokok_satuan::text AS "hargaPokokSatuan",
           m.nilai_total::text AS "nilaiTotal"
    FROM stock_moves m
    JOIN locations asal ON asal.id = m.lokasi_asal_id
    JOIN locations tujuan ON tujuan.id = m.lokasi_tujuan_id
    LEFT JOIN stock_operations o ON o.id = m.operasi_id
    WHERE m.produk_id = ${produkId}
      AND m.tanggal >= ${dariIso} AND m.tanggal <= ${sampaiIso}
    ORDER BY m.tanggal, m.dibuat_pada
  `)

  return (hasil as unknown as BarisKartuStok[]).map((b) => ({
    ...b,
    masuk: Number(b.masuk).toFixed(6),
    keluar: Number(b.keluar).toFixed(6),
    hargaPokokSatuan: Number(b.hargaPokokSatuan).toFixed(6),
    nilaiTotal: Number(b.nilaiTotal).toFixed(2),
  }))
}

export type ValuasiKategori = {
  kategoriId: string
  kodeKategori: string
  namaKategori: string
  nilai: Uang
}

/** Nilai persediaan dikelompokkan per kategori, untuk dicocokkan ke Neraca. */
export async function valuasiPerKategori(): Promise<ValuasiKategori[]> {
  const stok = await stokSeluruhProduk()
  const produk = await db
    .select({
      produkId: products.id,
      kategoriId: productCategories.id,
      kodeKategori: productCategories.kode,
      namaKategori: productCategories.nama,
    })
    .from(products)
    .innerJoin(productCategories, eq(productCategories.id, products.kategoriId))

  const kategoriLewatProduk = new Map(produk.map((p) => [p.produkId, p]))
  const terkumpul = new Map<string, ValuasiKategori>()

  for (const s of stok) {
    const k = kategoriLewatProduk.get(s.produkId)
    if (!k) continue
    const sudahAda = terkumpul.get(k.kategoriId) ?? {
      kategoriId: k.kategoriId, kodeKategori: k.kodeKategori,
      namaKategori: k.namaKategori, nilai: '0.00',
    }
    sudahAda.nilai = (Number(sudahAda.nilai) + Number(s.nilai)).toFixed(2)
    terkumpul.set(k.kategoriId, sudahAda)
  }

  return [...terkumpul.values()].sort((a, b) => a.kodeKategori.localeCompare(b.kodeKategori))
}

export async function daftarLokasiInternal() {
  return db.select().from(locations)
    .where(and(eq(locations.tipe, 'internal'), eq(locations.isActive, true)))
    .orderBy(asc(locations.kode))
}

export async function ambilLokasiLewatTipe(tipe: typeof locations.$inferSelect['tipe']) {
  const [lokasi] = await db.select().from(locations)
    .where(and(eq(locations.tipe, tipe), eq(locations.isActive, true)))
    .orderBy(asc(locations.kode))
    .limit(1)
  return lokasi ?? null
}

export { gte }
