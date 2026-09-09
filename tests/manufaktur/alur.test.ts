import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  users, accounts, journals, sequences, companySettings, currencies,
  journalEntries, journalItems, uoms, productCategories, products,
  warehouses, locations, stockOperations,
} from '@/db/schema'
import { buatOperasi, selesaikanOperasi } from '@/modules/gudang/layanan/operasi'
import { stokProdukPerLokasi } from '@/modules/gudang/repositori/stok'
import { buatBom, ubahBom, ambilBom, kebutuhanBahan, ubahStatusBom, bomAktifUntukProduk } from '@/modules/manufaktur/layanan/bom'
import {
  buatPerintahProduksi, ubahPerintahProduksi, konfirmasiPerintahProduksi,
  selesaikanPerintahProduksi, batalkanPerintahProduksi, hapusPerintahProduksi,
  ambilPerintahProduksi, biayaProduksi, operasiPerintahProduksi,
} from '@/modules/manufaktur/layanan/perintah-produksi'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const TABEL = [
  'work_order_lines', 'work_orders', 'bom_lines', 'bill_of_materials',
  'stock_moves', 'stock_operation_lines', 'stock_operations',
  'products', 'product_categories', 'uoms', 'locations', 'warehouses',
  'journal_items', 'journal_entries', 'journals', 'sequences',
  'company_settings', 'accounts', 'currency_rates', 'currencies',
  'audit_logs', 'user_roles', 'users', 'partners', 'payment_terms', 'taxes',
]

let penggunaId: string
const akun: Record<string, string> = {}
const lokasi: Record<string, string> = {}
const satuan: Record<string, string> = {}
let produkKayu: string
let produkSekrup: string
let produkKursi: string

beforeEach(async () => {
  await bersihkanTabel(TABEL)

  await db.insert(currencies).values({ kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 })

  const dibuatAkun = await db.insert(accounts).values([
    { kode: '1131', nama: 'Persediaan Bahan Baku', tipeAkun: 'aset_persediaan' },
    { kode: '1133', nama: 'Persediaan Barang Dalam Proses', tipeAkun: 'aset_persediaan' },
    { kode: '1134', nama: 'Persediaan Barang Jadi', tipeAkun: 'aset_persediaan' },
    { kode: '2151', nama: 'Penerimaan Barang Belum Ditagih', tipeAkun: 'liabilitas_jangka_pendek' },
    { kode: '5101', nama: 'HPP Bahan Baku', tipeAkun: 'beban_hpp' },
    { kode: '5102', nama: 'HPP Tenaga Kerja Langsung', tipeAkun: 'beban_hpp' },
    { kode: '5103', nama: 'HPP Overhead Pabrik', tipeAkun: 'beban_hpp' },
    { kode: '5104', nama: 'HPP Barang Jadi', tipeAkun: 'beban_hpp' },
    { kode: '5105', nama: 'Selisih Persediaan', tipeAkun: 'beban_hpp' },
    { kode: '5106', nama: 'Kerugian Barang Rusak', tipeAkun: 'beban_hpp' },
    { kode: '7104', nama: 'Selisih Pembulatan', tipeAkun: 'beban_lain' },
  ]).returning()
  for (const a of dibuatAkun) akun[a.kode] = a.id

  await db.insert(companySettings).values({
    nama: 'PT Uji',
    akunPenerimaanBelumDitagihId: akun['2151'],
    akunBarangDalamProsesId: akun['1133'],
    akunPembulatanId: akun['7104'],
  })

  const [pengguna] = await db.insert(users).values({
    email: 'produksi@uji.id', nama: 'Kepala Produksi', passwordHash: 'x',
  }).returning()
  penggunaId = pengguna.id

  const [urutanJps] = await db.insert(sequences).values({
    kode: 'jurnal:JPS', prefix: 'JPS', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan',
  }).returning()
  const [urutanJu] = await db.insert(sequences).values({
    kode: 'jurnal:JU', prefix: 'JU', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan',
  }).returning()
  await db.insert(journals).values([
    { kode: 'JPS', nama: 'Jurnal Penyesuaian Persediaan', tipe: 'umum', sequenceId: urutanJps.id },
    { kode: 'JU', nama: 'Jurnal Umum', tipe: 'umum', sequenceId: urutanJu.id },
  ])
  await db.insert(sequences).values([
    { kode: 'gudang:penerimaan', prefix: 'GRN', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'gudang:konsumsi-produksi', prefix: 'KSP', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'gudang:hasil-produksi', prefix: 'HSP', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'manufaktur:perintah-produksi', prefix: 'PK', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
  ])

  const dibuatSatuan = await db.insert(uoms).values([
    { kode: 'UNIT', nama: 'Unit', kategori: 'satuan', faktor: '1' },
    { kode: 'LSN', nama: 'Lusin', kategori: 'satuan', faktor: '12' },
  ]).returning()
  for (const u of dibuatSatuan) satuan[u.kode] = u.id

  const dibuatKategori = await db.insert(productCategories).values([
    {
      kode: 'BB', nama: 'Bahan Baku',
      akunPersediaanId: akun['1131'], akunHppId: akun['5101'],
      akunSelisihId: akun['5105'], akunBarangRusakId: akun['5106'],
    },
    {
      kode: 'BJ', nama: 'Barang Jadi',
      akunPersediaanId: akun['1134'], akunHppId: akun['5104'],
      akunSelisihId: akun['5105'], akunBarangRusakId: akun['5106'],
    },
  ]).returning()
  const kategoriBb = dibuatKategori[0].id
  const kategoriBj = dibuatKategori[1].id

  const dibuatProduk = await db.insert(products).values([
    { kode: 'BB-KAYU', nama: 'Kayu Jati', kategoriId: kategoriBb, uomId: satuan.UNIT },
    { kode: 'BB-SKRUP', nama: 'Sekrup Kayu', kategoriId: kategoriBb, uomId: satuan.UNIT },
    { kode: 'BJ-KURSI', nama: 'Kursi Jati', kategoriId: kategoriBj, uomId: satuan.UNIT },
  ]).returning()
  produkKayu = dibuatProduk[0].id
  produkSekrup = dibuatProduk[1].id
  produkKursi = dibuatProduk[2].id

  const [gudang] = await db.insert(warehouses).values({ kode: 'GU', nama: 'Gudang Utama' }).returning()
  const dibuatLokasi = await db.insert(locations).values([
    { kode: 'GU/BB', nama: 'Gudang Bahan Baku', tipe: 'internal', warehouseId: gudang.id },
    { kode: 'GU/BJ', nama: 'Gudang Barang Jadi', tipe: 'internal', warehouseId: gudang.id },
    { kode: 'VIR/PEMASOK', nama: 'Pemasok', tipe: 'pemasok' },
    { kode: 'VIR/PRODUKSI', nama: 'Produksi', tipe: 'produksi' },
  ]).returning()
  for (const l of dibuatLokasi) lokasi[l.kode] = l.id
})

afterAll(async () => { await tutupKoneksi() })

// ── Pembantu ─────────────────────────────────────────────────────────────────

async function terima(produkId: string, kuantitas: string, harga: string) {
  const op = await buatOperasi({
    tipe: 'penerimaan',
    tanggal: '2026-06-01',
    lokasiAsalId: lokasi['VIR/PEMASOK'],
    lokasiTujuanId: lokasi['GU/BB'],
    partnerId: null, referensi: null, catatan: null,
    baris: [{ produkId, kuantitas, uomId: satuan.UNIT, hargaSatuan: harga, catatan: null }],
  }, penggunaId)
  return selesaikanOperasi(op.id, penggunaId)
}

async function siapkanBahan() {
  await terima(produkKayu, '100', '50000')
  await terima(produkSekrup, '500', '1000')
}

function resepKursi(ubah: Record<string, unknown> = {}) {
  return {
    kode: 'BOM-KURSI',
    nama: 'Resep Kursi Jati',
    produkId: produkKursi,
    kuantitas: '1',
    uomId: satuan.UNIT,
    catatan: null,
    baris: [
      { produkId: produkKayu, kuantitas: '4', uomId: satuan.UNIT, catatan: null },
      { produkId: produkSekrup, kuantitas: '20', uomId: satuan.UNIT, catatan: null },
    ],
    ...ubah,
  }
}

function perintah(ubah: Record<string, unknown> = {}) {
  return {
    produkId: produkKursi,
    bomId: null,
    kuantitas: '5',
    uomId: satuan.UNIT,
    tanggal: '2026-06-10',
    tanggalTarget: null,
    lokasiSumberId: lokasi['GU/BB'],
    lokasiTujuanId: lokasi['GU/BJ'],
    biayaTenagaKerja: '500000',
    biayaOverhead: '250000',
    referensi: null,
    catatan: null,
    baris: [
      { produkId: produkKayu, kuantitas: '20', uomId: satuan.UNIT, catatan: null },
      { produkId: produkSekrup, kuantitas: '100', uomId: satuan.UNIT, catatan: null },
    ],
    ...ubah,
  }
}

async function saldoAkun(kode: string): Promise<number> {
  const hasil = await db
    .select({
      debit: sql<string>`COALESCE(SUM(${journalItems.debit}), 0)::text`,
      kredit: sql<string>`COALESCE(SUM(${journalItems.kredit}), 0)::text`,
    })
    .from(journalItems)
    .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
    .where(eq(journalItems.accountId, akun[kode]))
  return Number(hasil[0].debit) - Number(hasil[0].kredit)
}

async function stokDi(produkId: string, kodeLokasi: string): Promise<number> {
  const perLokasi = await stokProdukPerLokasi(produkId)
  return Number(perLokasi.find((l) => l.kodeLokasi === kodeLokasi)?.stok ?? 0)
}

// ── Bill of Materials ────────────────────────────────────────────────────────

describe('bill of materials', () => {
  it('menyimpan resep beserta bahannya', async () => {
    const bom = await buatBom(resepKursi(), penggunaId)
    expect(bom.kode).toBe('BOM-KURSI')
    expect(bom.baris).toHaveLength(2)
    expect(bom.isActive).toBe(true)
  })

  it('menolak produk hasil yang menjadi bahannya sendiri', async () => {
    await expect(buatBom(resepKursi({
      baris: [{ produkId: produkKursi, kuantitas: '1', uomId: satuan.UNIT, catatan: null }],
    }), penggunaId)).rejects.toThrow(/bahan bagi dirinya sendiri/)
  })

  it('menolak bahan yang sama muncul dua kali', async () => {
    await expect(buatBom(resepKursi({
      baris: [
        { produkId: produkKayu, kuantitas: '4', uomId: satuan.UNIT, catatan: null },
        { produkId: produkKayu, kuantitas: '2', uomId: satuan.UNIT, catatan: null },
      ],
    }), penggunaId)).rejects.toThrow(/satu kali/)
  })

  it('menolak resep tanpa bahan', async () => {
    await expect(buatBom(resepKursi({ baris: [] }), penggunaId))
      .rejects.toThrow(/minimal satu bahan/)
  })

  it('menskalakan kebutuhan terhadap kuantitas resep', async () => {
    // Resep ditulis untuk sepuluh kursi sekaligus.
    const bom = await buatBom(resepKursi({
      kuantitas: '10',
      baris: [
        { produkId: produkKayu, kuantitas: '40', uomId: satuan.UNIT, catatan: null },
        { produkId: produkSekrup, kuantitas: '200', uomId: satuan.UNIT, catatan: null },
      ],
    }), penggunaId)

    const kebutuhan = await kebutuhanBahan(bom.id, '5')
    expect(Number(kebutuhan[0].kuantitas)).toBe(20)
    expect(Number(kebutuhan[1].kuantitas)).toBe(100)
  })

  it('menskalakan kebutuhan pecahan tanpa kehilangan presisi', async () => {
    const bom = await buatBom(resepKursi({ kuantitas: '3' }), penggunaId)
    const kebutuhan = await kebutuhanBahan(bom.id, '1')
    expect(Number(kebutuhan[0].kuantitas)).toBeCloseTo(4 / 3, 6)
  })

  it('mengubah resep mengganti seluruh bahannya', async () => {
    const bom = await buatBom(resepKursi(), penggunaId)
    const diubah = await ubahBom(bom.id, resepKursi({
      baris: [{ produkId: produkKayu, kuantitas: '6', uomId: satuan.UNIT, catatan: null }],
    }))
    expect(diubah.baris).toHaveLength(1)
    expect(Number(diubah.baris[0].kuantitas)).toBe(6)
  })

  it('menonaktifkan resep tanpa menghapusnya', async () => {
    const bom = await buatBom(resepKursi(), penggunaId)
    await ubahStatusBom(bom.id, false)
    expect((await ambilBom(bom.id))!.isActive).toBe(false)
    expect(await bomAktifUntukProduk(produkKursi)).toHaveLength(0)
  })
})

// ── Perintah produksi ───────────────────────────────────────────────────────────

describe('perintah produksi', () => {
  it('draft belum bernomor', async () => {
    const pk = await buatPerintahProduksi(perintah(), penggunaId)
    expect(pk.status).toBe('draft')
    expect(pk.nomor).toBeNull()
    expect(pk.baris).toHaveLength(2)
  })

  it('konfirmasi memberi nomor', async () => {
    const pk = await buatPerintahProduksi(perintah(), penggunaId)
    const dikonfirmasi = await konfirmasiPerintahProduksi(pk.id, penggunaId)
    expect(dikonfirmasi.status).toBe('dikonfirmasi')
    expect(dikonfirmasi.nomor).toBe('PK/2026/06/0001')
  })

  it('menolak gudang bahan yang bukan lokasi internal', async () => {
    await expect(buatPerintahProduksi(
      perintah({ lokasiSumberId: lokasi['VIR/PEMASOK'] }), penggunaId,
    )).rejects.toThrow(/harus lokasi internal/)
  })

  it('menolak gudang bahan dan gudang barang jadi yang sama', async () => {
    await expect(buatPerintahProduksi(
      perintah({ lokasiTujuanId: lokasi['GU/BB'] }), penggunaId,
    )).rejects.toThrow(/tidak boleh sama/)
  })

  it('menolak produk yang menjadi bahannya sendiri', async () => {
    await expect(buatPerintahProduksi(perintah({
      baris: [{ produkId: produkKursi, kuantitas: '1', uomId: satuan.UNIT, catatan: null }],
    }), penggunaId)).rejects.toThrow(/bahannya sendiri/)
  })

  it('menolak resep milik produk lain', async () => {
    const bom = await buatBom(resepKursi({ produkId: produkKayu, baris: [
      { produkId: produkSekrup, kuantitas: '2', uomId: satuan.UNIT, catatan: null },
    ] }), penggunaId)
    await expect(buatPerintahProduksi(perintah({ bomId: bom.id }), penggunaId))
      .rejects.toThrow(/bukan resep untuk produk ini/)
  })

  it('perintah yang sudah dikonfirmasi tidak dapat diubah', async () => {
    const pk = await buatPerintahProduksi(perintah(), penggunaId)
    await konfirmasiPerintahProduksi(pk.id, penggunaId)
    await expect(ubahPerintahProduksi(pk.id, perintah())).rejects.toThrow(/tidak dapat diubah/)
  })

  it('perintah yang sudah dikonfirmasi tidak dapat dihapus', async () => {
    const pk = await buatPerintahProduksi(perintah(), penggunaId)
    await konfirmasiPerintahProduksi(pk.id, penggunaId)
    await expect(hapusPerintahProduksi(pk.id)).rejects.toThrow(/sudah bernomor/)
  })

  it('draft dapat dibatalkan lalu tidak dapat dikonfirmasi lagi', async () => {
    const pk = await buatPerintahProduksi(perintah(), penggunaId)
    await batalkanPerintahProduksi(pk.id)
    expect((await ambilPerintahProduksi(pk.id))!.status).toBe('dibatalkan')
    await expect(konfirmasiPerintahProduksi(pk.id, penggunaId)).rejects.toThrow(/dibatalkan/)
  })

  it('perintah yang belum dikonfirmasi tidak dapat diselesaikan', async () => {
    await siapkanBahan()
    const pk = await buatPerintahProduksi(perintah(), penggunaId)
    await expect(selesaikanPerintahProduksi(pk.id, penggunaId))
      .rejects.toThrow(/sudah dikonfirmasi yang dapat diselesaikan/)
  })
})

// ── Penyelesaian produksi ────────────────────────────────────────────────────

describe('penyelesaian perintah produksi', () => {
  async function jalankanProduksi(ubah: Record<string, unknown> = {}) {
    await siapkanBahan()
    const pk = await buatPerintahProduksi(perintah(ubah), penggunaId)
    await konfirmasiPerintahProduksi(pk.id, penggunaId)
    return selesaikanPerintahProduksi(pk.id, penggunaId)
  }

  it('mengurangi bahan dan menambah barang jadi', async () => {
    await jalankanProduksi()

    expect(await stokDi(produkKayu, 'GU/BB')).toBe(80)
    expect(await stokDi(produkSekrup, 'GU/BB')).toBe(400)
    expect(await stokDi(produkKursi, 'GU/BJ')).toBe(5)
  })

  it('lokasi virtual Produksi kembali kosong setelah selesai', async () => {
    await jalankanProduksi()

    expect(await stokDi(produkKayu, 'VIR/PRODUKSI')).toBe(0)
    expect(await stokDi(produkKursi, 'VIR/PRODUKSI')).toBe(0)
  })

  it('harga pokok barang jadi menyerap bahan, tenaga kerja, dan overhead', async () => {
    const pk = await jalankanProduksi()

    // 20 × 50.000 + 100 × 1.000 = 1.100.000 bahan
    // + 500.000 tenaga kerja + 250.000 overhead = 1.850.000 untuk 5 unit
    const biaya = await biayaProduksi(pk.id)
    expect(Number(biaya.bahan)).toBe(1_100_000)
    expect(Number(biaya.tenagaKerja)).toBe(500_000)
    expect(Number(biaya.overhead)).toBe(250_000)
    expect(Number(biaya.total)).toBe(1_850_000)
    expect(Number(pk.hargaPokokSatuan)).toBe(370_000)

    const [produk] = await db.select().from(products).where(eq(products.id, produkKursi))
    expect(Number(produk.hargaPokokRataRata)).toBe(370_000)
  })

  it('Barang Dalam Proses kembali nol', async () => {
    await jalankanProduksi()
    expect(await saldoAkun('1133')).toBe(0)
  })

  it('membebankan bahan ke persediaan barang jadi lewat penampung', async () => {
    await jalankanProduksi()

    // Bahan baku tersisa 80 × 50.000 + 400 × 1.000 = 4.400.000
    expect(await saldoAkun('1131')).toBe(4_400_000)
    expect(await saldoAkun('1134')).toBe(1_850_000)
    // Beban konversi terserap seluruhnya, jadi bersaldo kredit.
    expect(await saldoAkun('5102')).toBe(-500_000)
    expect(await saldoAkun('5103')).toBe(-250_000)
  })

  it('menghasilkan dua operasi gudang yang tertaut ke perintahnya', async () => {
    const pk = await jalankanProduksi()
    const operasi = await operasiPerintahProduksi(pk.id)

    expect(operasi.map((o) => o.tipe)).toEqual(['konsumsi_produksi', 'hasil_produksi'])
    expect(operasi[0].nomor).toBe('KSP/2026/06/0001')
    expect(operasi[1].nomor).toBe('HSP/2026/06/0001')
    expect(pk.operasiKonsumsiId).toBe(operasi[0].operasiId)
    expect(pk.operasiHasilId).toBe(operasi[1].operasiId)
  })

  it('tanpa biaya konversi tidak memposting jurnal biaya', async () => {
    const pk = await jalankanProduksi({ biayaTenagaKerja: '0', biayaOverhead: '0' })

    expect(pk.jurnalBiayaId).toBeNull()
    expect(Number(pk.hargaPokokSatuan)).toBe(220_000)
    expect(await saldoAkun('1133')).toBe(0)
  })

  it('menolak penyelesaian bila stok bahan tidak mencukupi', async () => {
    await terima(produkKayu, '10', '50000')
    await terima(produkSekrup, '500', '1000')
    const pk = await buatPerintahProduksi(perintah(), penggunaId)
    await konfirmasiPerintahProduksi(pk.id, penggunaId)

    await expect(selesaikanPerintahProduksi(pk.id, penggunaId)).rejects.toThrow(/tidak mencukupi/)
  })

  it('penyelesaian yang gagal tidak menyisakan pergerakan maupun jurnal', async () => {
    await terima(produkKayu, '10', '50000')
    await terima(produkSekrup, '500', '1000')
    const pk = await buatPerintahProduksi(perintah(), penggunaId)
    await konfirmasiPerintahProduksi(pk.id, penggunaId)

    await expect(selesaikanPerintahProduksi(pk.id, penggunaId)).rejects.toThrow()

    // Konsumsi sempat dibukukan sebelum kegagalan; transaksi harus
    // mengembalikan seluruhnya, termasuk saldo Barang Dalam Proses.
    expect(await saldoAkun('1133')).toBe(0)
    expect(await stokDi(produkKayu, 'GU/BB')).toBe(10)
    expect(await stokDi(produkKayu, 'VIR/PRODUKSI')).toBe(0)
    const operasi = await db.select().from(stockOperations)
      .where(eq(stockOperations.tipe, 'konsumsi_produksi'))
    expect(operasi).toHaveLength(0)
    expect((await ambilPerintahProduksi(pk.id))!.status).toBe('dikonfirmasi')
  })

  it('perintah yang sudah selesai tidak dapat diselesaikan atau dibatalkan lagi', async () => {
    const pk = await jalankanProduksi()
    await expect(selesaikanPerintahProduksi(pk.id, penggunaId)).rejects.toThrow(/sudah selesai/)
    await expect(batalkanPerintahProduksi(pk.id)).rejects.toThrow(/tidak dapat dibatalkan/)
  })

  it('menghitung harga pokok per satuan dasar ketika diproduksi dalam lusin', async () => {
    // Satu lusin kursi = 12 unit; bahan cukup untuk itu.
    await db.update(products)
      .set({ hargaPokokRataRata: '0' })
      .where(eq(products.id, produkKursi))

    await siapkanBahan()
    const pk = await buatPerintahProduksi(perintah({
      kuantitas: '1',
      uomId: satuan.LSN,
      biayaTenagaKerja: '400000',
      biayaOverhead: '200000',
      baris: [
        { produkId: produkKayu, kuantitas: '48', uomId: satuan.UNIT, catatan: null },
        { produkId: produkSekrup, kuantitas: '240', uomId: satuan.UNIT, catatan: null },
      ],
    }), penggunaId)
    await konfirmasiPerintahProduksi(pk.id, penggunaId)
    const selesai = await selesaikanPerintahProduksi(pk.id, penggunaId)

    // 48 × 50.000 + 240 × 1.000 = 2.640.000 bahan + 600.000 konversi
    // = 3.240.000 untuk 12 unit = 270.000 per unit.
    expect(Number(selesai.hargaPokokSatuan)).toBe(270_000)
    expect(await stokDi(produkKursi, 'GU/BJ')).toBe(12)
    expect(await saldoAkun('1133')).toBe(0)
  })

  it('buku besar tetap seimbang setelah produksi', async () => {
    await jalankanProduksi()

    const hasil = await db
      .select({
        debit: sql<string>`COALESCE(SUM(${journalItems.debit}), 0)::text`,
        kredit: sql<string>`COALESCE(SUM(${journalItems.kredit}), 0)::text`,
      })
      .from(journalItems)
      .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
      .where(eq(journalEntries.status, 'diposting'))

    expect(Number(hasil[0].debit)).toBe(Number(hasil[0].kredit))
    expect(Number(hasil[0].debit)).toBeGreaterThan(0)
  })
})

// ── Batasan modul gudang ─────────────────────────────────────────────────────

describe('operasi produksi lewat gudang', () => {
  it('konsumsi produksi harus berakhir di lokasi virtual Produksi', async () => {
    await siapkanBahan()
    await expect(buatOperasi({
      tipe: 'konsumsi_produksi',
      tanggal: '2026-06-10',
      lokasiAsalId: lokasi['GU/BB'],
      lokasiTujuanId: lokasi['GU/BJ'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '1', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)).rejects.toThrow(/lokasi virtual Produksi/)
  })

  it('hasil produksi harus berasal dari lokasi virtual Produksi', async () => {
    await expect(buatOperasi({
      tipe: 'hasil_produksi',
      tanggal: '2026-06-10',
      lokasiAsalId: lokasi['VIR/PEMASOK'],
      lokasiTujuanId: lokasi['GU/BJ'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKursi, kuantitas: '1', uomId: satuan.UNIT, hargaSatuan: '1000', catatan: null }],
    }, penggunaId)).rejects.toThrow(/lokasi virtual Produksi/)
  })
})
