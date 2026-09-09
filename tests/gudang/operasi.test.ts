import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  users, accounts, journals, sequences, companySettings, currencies,
  journalEntries, journalItems, uoms, productCategories, products,
  warehouses, locations, stockMoves, stockOperations,
} from '@/db/schema'
import {
  buatOperasi, ubahOperasi, selesaikanOperasi, batalkanOperasi,
  hapusOperasi, ambilOperasi, nilaiOperasi,
} from '@/modules/gudang/layanan/operasi'
import { stokSeluruhProduk, kartuStok, stokProdukPerLokasi } from '@/modules/gudang/repositori/stok'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const TABEL = [
  'packing_list_items', 'packing_lists', 'stock_moves', 'stock_operation_lines',
  'stock_operations', 'products', 'product_categories', 'uoms',
  'locations', 'warehouses',
  'journal_items', 'journal_entries', 'journals', 'sequences',
  'company_settings', 'accounts', 'currency_rates', 'currencies',
  'audit_logs', 'user_roles', 'users', 'partners', 'payment_terms', 'taxes',
]

let penggunaId: string
const akun: Record<string, string> = {}
const lokasi: Record<string, string> = {}
const satuan: Record<string, string> = {}
let kategoriId: string
let produkKayu: string
let produkKursi: string

beforeEach(async () => {
  await bersihkanTabel(TABEL)

  await db.insert(currencies).values({ kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 })

  const dibuatAkun = await db.insert(accounts).values([
    { kode: '1131', nama: 'Persediaan Bahan Baku', tipeAkun: 'aset_persediaan' },
    { kode: '2151', nama: 'Penerimaan Barang Belum Ditagih', tipeAkun: 'liabilitas_jangka_pendek' },
    { kode: '5101', nama: 'HPP Bahan Baku', tipeAkun: 'beban_hpp' },
    { kode: '5105', nama: 'Selisih Persediaan', tipeAkun: 'beban_hpp' },
    { kode: '5106', nama: 'Kerugian Barang Rusak', tipeAkun: 'beban_hpp' },
  ]).returning()
  for (const a of dibuatAkun) akun[a.kode] = a.id

  await db.insert(companySettings).values({
    nama: 'PT Uji', akunPenerimaanBelumDitagihId: akun['2151'],
  })

  const [pengguna] = await db.insert(users).values({
    email: 'gudang@uji.id', nama: 'Petugas Gudang', passwordHash: 'x',
  }).returning()
  penggunaId = pengguna.id

  const [urutanJurnal] = await db.insert(sequences).values({
    kode: 'jurnal:JPS', prefix: 'JPS', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan',
  }).returning()
  await db.insert(journals).values({
    kode: 'JPS', nama: 'Jurnal Penyesuaian Persediaan', tipe: 'umum', sequenceId: urutanJurnal.id,
  })
  await db.insert(sequences).values([
    { kode: 'gudang:penerimaan', prefix: 'GRN', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'gudang:pengiriman', prefix: 'DO', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'gudang:transfer', prefix: 'TRF', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'gudang:barang-rusak', prefix: 'SCR', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'gudang:opname', prefix: 'OPN', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
  ])

  const dibuatSatuan = await db.insert(uoms).values([
    { kode: 'UNIT', nama: 'Unit', kategori: 'satuan', faktor: '1' },
    { kode: 'LSN', nama: 'Lusin', kategori: 'satuan', faktor: '12' },
    { kode: 'KG', nama: 'Kilogram', kategori: 'berat', faktor: '1' },
  ]).returning()
  for (const u of dibuatSatuan) satuan[u.kode] = u.id

  const [kategori] = await db.insert(productCategories).values({
    kode: 'BB', nama: 'Bahan Baku',
    akunPersediaanId: akun['1131'], akunHppId: akun['5101'],
    akunSelisihId: akun['5105'], akunBarangRusakId: akun['5106'],
  }).returning()
  kategoriId = kategori.id

  const dibuatProduk = await db.insert(products).values([
    { kode: 'BB-KAYU', nama: 'Kayu Jati', kategoriId, uomId: satuan.UNIT },
    { kode: 'BJ-KURSI', nama: 'Kursi Jati', kategoriId, uomId: satuan.UNIT },
  ]).returning()
  produkKayu = dibuatProduk[0].id
  produkKursi = dibuatProduk[1].id

  const [gudang] = await db.insert(warehouses).values({ kode: 'GU', nama: 'Gudang Utama' }).returning()
  const dibuatLokasi = await db.insert(locations).values([
    { kode: 'GU/BB', nama: 'Gudang Bahan Baku', tipe: 'internal', warehouseId: gudang.id },
    { kode: 'GU/BJ', nama: 'Gudang Barang Jadi', tipe: 'internal', warehouseId: gudang.id },
    { kode: 'VIR/PEMASOK', nama: 'Pemasok', tipe: 'pemasok' },
    { kode: 'VIR/PELANGGAN', nama: 'Pelanggan', tipe: 'pelanggan' },
    { kode: 'VIR/PENYESUAIAN', nama: 'Penyesuaian Persediaan', tipe: 'penyesuaian' },
    { kode: 'VIR/RUSAK', nama: 'Barang Rusak', tipe: 'rusak' },
  ]).returning()
  for (const l of dibuatLokasi) lokasi[l.kode] = l.id
})

afterAll(async () => { await tutupKoneksi() })

// ── Pembantu ─────────────────────────────────────────────────────────────────

function operasiPenerimaan(ubah: Record<string, unknown> = {}) {
  return {
    tipe: 'penerimaan' as const,
    tanggal: '2026-06-10',
    lokasiAsalId: lokasi['VIR/PEMASOK'],
    lokasiTujuanId: lokasi['GU/BB'],
    partnerId: null, referensi: null, catatan: null,
    baris: [{
      produkId: produkKayu, kuantitas: '100', uomId: satuan.UNIT,
      hargaSatuan: '50000', catatan: null,
    }],
    ...ubah,
  }
}

async function terima(kuantitas: string, harga: string, tanggal = '2026-06-10') {
  const op = await buatOperasi(operasiPenerimaan({
    tanggal,
    baris: [{
      produkId: produkKayu, kuantitas, uomId: satuan.UNIT,
      hargaSatuan: harga, catatan: null,
    }],
  }), penggunaId)
  return selesaikanOperasi(op.id, penggunaId)
}

async function stokKayu(): Promise<number> {
  const stok = await stokSeluruhProduk()
  return Number(stok.find((s) => s.produkId === produkKayu)?.stok ?? 0)
}

async function rataRataKayu(): Promise<number> {
  const [p] = await db.select().from(products).where(eq(products.id, produkKayu))
  return Number(p.hargaPokokRataRata)
}

// ── Draft ────────────────────────────────────────────────────────────────────

describe('operasi draft', () => {
  it('menyimpan draft tanpa nomor dan tanpa menyentuh stok', async () => {
    const op = await buatOperasi(operasiPenerimaan(), penggunaId)
    expect(op.status).toBe('draft')
    expect(op.nomor).toBeNull()
    expect(await stokKayu()).toBe(0)
    expect(await db.select().from(stockMoves)).toHaveLength(0)
  })

  it('menolak operasi tanpa baris produk', async () => {
    await expect(buatOperasi(operasiPenerimaan({ baris: [] }), penggunaId))
      .rejects.toThrow('minimal satu baris')
  })

  it('menolak kuantitas nol atau negatif', async () => {
    await expect(buatOperasi(operasiPenerimaan({
      baris: [{ produkId: produkKayu, kuantitas: '0', uomId: satuan.UNIT, hargaSatuan: '1', catatan: null }],
    }), penggunaId)).rejects.toThrow('lebih besar dari nol')
  })

  it('menolak lokasi asal dan tujuan yang sama', async () => {
    await expect(buatOperasi(operasiPenerimaan({
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['GU/BB'],
    }), penggunaId)).rejects.toThrow('tidak boleh sama')
  })

  it('menolak penerimaan yang arahnya justru keluar dari gudang', async () => {
    await expect(buatOperasi(operasiPenerimaan({
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['VIR/PELANGGAN'],
    }), penggunaId)).rejects.toThrow('harus berakhir di lokasi internal')
  })

  it('menolak pengiriman yang tidak berasal dari lokasi internal', async () => {
    await expect(buatOperasi(operasiPenerimaan({
      tipe: 'pengiriman',
      lokasiAsalId: lokasi['VIR/PEMASOK'], lokasiTujuanId: lokasi['GU/BB'],
    }), penggunaId)).rejects.toThrow('harus berasal dari lokasi internal')
  })

  it('menolak transfer yang salah satu ujungnya bukan lokasi internal', async () => {
    await expect(buatOperasi(operasiPenerimaan({
      tipe: 'transfer',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['VIR/RUSAK'],
    }), penggunaId)).rejects.toThrow('antara dua lokasi internal')
  })

  it('menolak pergerakan antar dua lokasi virtual', async () => {
    await expect(buatOperasi(operasiPenerimaan({
      tipe: 'transfer',
      lokasiAsalId: lokasi['VIR/PEMASOK'], lokasiTujuanId: lokasi['VIR/PELANGGAN'],
    }), penggunaId)).rejects.toThrow('tidak mengubah stok perusahaan')
  })

  it('mengizinkan perubahan selama masih draft', async () => {
    const op = await buatOperasi(operasiPenerimaan(), penggunaId)
    const hasil = await ubahOperasi(op.id, operasiPenerimaan({ referensi: 'PO-001' }))
    expect(hasil.referensi).toBe('PO-001')
  })

  it('mengizinkan pembatalan dan penghapusan draft', async () => {
    const a = await buatOperasi(operasiPenerimaan(), penggunaId)
    await batalkanOperasi(a.id)
    expect((await ambilOperasi(a.id))!.status).toBe('dibatalkan')

    const b = await buatOperasi(operasiPenerimaan(), penggunaId)
    await hapusOperasi(b.id)
    expect(await ambilOperasi(b.id)).toBeNull()
  })
})

// ── Penerimaan dan valuasi ───────────────────────────────────────────────────

describe('penerimaan barang', () => {
  it('menambah stok, menetapkan harga pokok, dan memberi nomor', async () => {
    const op = await terima('100', '50000')
    expect(op.status).toBe('selesai')
    expect(op.nomor).toBe('GRN/2026/06/0001')
    expect(await stokKayu()).toBe(100)
    expect(await rataRataKayu()).toBe(50000)
  })

  it('menghitung rata-rata bergerak pada penerimaan kedua', async () => {
    await terima('100', '50000')
    await terima('100', '70000', '2026-06-15')
    expect(await stokKayu()).toBe(200)
    expect(await rataRataKayu()).toBe(60000)
  })

  it('mengonversi satuan penerimaan ke satuan dasar produk', async () => {
    const op = await buatOperasi(operasiPenerimaan({
      baris: [{
        produkId: produkKayu, kuantitas: '5', uomId: satuan.LSN,
        hargaSatuan: '10000', catatan: null,
      }],
    }), penggunaId)
    await selesaikanOperasi(op.id, penggunaId)
    // 5 lusin = 60 unit.
    expect(await stokKayu()).toBe(60)
  })

  it('menolak satuan dari kategori yang berbeda', async () => {
    const op = await buatOperasi(operasiPenerimaan({
      baris: [{
        produkId: produkKayu, kuantitas: '5', uomId: satuan.KG,
        hargaSatuan: '10000', catatan: null,
      }],
    }), penggunaId)
    await expect(selesaikanOperasi(op.id, penggunaId)).rejects.toThrow('tidak sekategori')
  })

  it('memposting jurnal Dr Persediaan / Cr Penerimaan Belum Ditagih', async () => {
    const op = await terima('100', '50000')
    const [entri] = await db.select().from(journalEntries)
      .where(eq(journalEntries.id, op.jurnalEntryId!))
    expect(entri.status).toBe('diposting')
    expect(entri.sumberTipe).toBe('gudang:penerimaan')
    expect(entri.sumberId).toBe(op.id)

    const item = await db.select().from(journalItems)
      .where(eq(journalItems.entryId, entri.id))
    const persediaan = item.find((b) => b.accountId === akun['1131'])!
    const lawan = item.find((b) => b.accountId === akun['2151'])!
    expect(persediaan.debit).toBe('5000000.00')
    expect(lawan.kredit).toBe('5000000.00')
  })

  it('menolak penyelesaian ganda', async () => {
    const op = await terima('100', '50000')
    await expect(selesaikanOperasi(op.id, penggunaId)).rejects.toThrow('sudah diselesaikan')
  })

  it('menolak perubahan dan penghapusan setelah selesai', async () => {
    const op = await terima('100', '50000')
    await expect(ubahOperasi(op.id, operasiPenerimaan())).rejects.toThrow('tidak dapat diubah')
    await expect(hapusOperasi(op.id)).rejects.toThrow('tidak dapat dihapus')
  })
})

// ── Pengiriman ───────────────────────────────────────────────────────────────

describe('pengiriman', () => {
  beforeEach(async () => { await terima('100', '50000') })

  it('mengurangi stok dan membebankan harga pokok rata-rata', async () => {
    const op = await buatOperasi({
      tipe: 'pengiriman', tanggal: '2026-06-20',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['VIR/PELANGGAN'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '30', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    const selesai = await selesaikanOperasi(op.id, penggunaId)

    expect(selesai.nomor).toBe('DO/2026/06/0001')
    expect(await stokKayu()).toBe(70)
    expect(await nilaiOperasi(op.id)).toBe('1500000.00')
  })

  it('tidak mengubah harga pokok rata-rata', async () => {
    const op = await buatOperasi({
      tipe: 'pengiriman', tanggal: '2026-06-20',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['VIR/PELANGGAN'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '30', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    await selesaikanOperasi(op.id, penggunaId)
    expect(await rataRataKayu()).toBe(50000)
  })

  it('memposting jurnal Dr HPP / Cr Persediaan', async () => {
    const op = await buatOperasi({
      tipe: 'pengiriman', tanggal: '2026-06-20',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['VIR/PELANGGAN'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '30', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    const selesai = await selesaikanOperasi(op.id, penggunaId)

    const item = await db.select().from(journalItems)
      .where(eq(journalItems.entryId, selesai.jurnalEntryId!))
    expect(item.find((b) => b.accountId === akun['5101'])!.debit).toBe('1500000.00')
    expect(item.find((b) => b.accountId === akun['1131'])!.kredit).toBe('1500000.00')
  })

  it('menolak pengeluaran melebihi stok tersedia', async () => {
    const op = await buatOperasi({
      tipe: 'pengiriman', tanggal: '2026-06-20',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['VIR/PELANGGAN'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '150', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    await expect(selesaikanOperasi(op.id, penggunaId)).rejects.toThrow('tidak mencukupi')
  })

  it('tidak menyisakan pergerakan maupun jurnal saat stok tidak mencukupi', async () => {
    const jumlahGerakSebelum = (await db.select().from(stockMoves)).length
    const jumlahEntriSebelum = (await db.select().from(journalEntries)).length

    const op = await buatOperasi({
      tipe: 'pengiriman', tanggal: '2026-06-20',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['VIR/PELANGGAN'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '150', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    await selesaikanOperasi(op.id, penggunaId).catch(() => undefined)

    expect(await db.select().from(stockMoves)).toHaveLength(jumlahGerakSebelum)
    expect(await db.select().from(journalEntries)).toHaveLength(jumlahEntriSebelum)
    expect((await ambilOperasi(op.id))!.status).toBe('draft')
  })
})

// ── Transfer internal ────────────────────────────────────────────────────────

describe('transfer internal', () => {
  beforeEach(async () => { await terima('100', '50000') })

  it('memindahkan stok antar lokasi tanpa mengubah stok perusahaan', async () => {
    const op = await buatOperasi({
      tipe: 'transfer', tanggal: '2026-06-20',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['GU/BJ'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '40', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    await selesaikanOperasi(op.id, penggunaId)

    expect(await stokKayu()).toBe(100)
    const perLokasi = await stokProdukPerLokasi(produkKayu)
    const peta = Object.fromEntries(perLokasi.map((l) => [l.kodeLokasi, Number(l.stok)]))
    expect(peta['GU/BB']).toBe(60)
    expect(peta['GU/BJ']).toBe(40)
  })

  it('tidak menghasilkan jurnal karena nilai persediaan tidak berubah', async () => {
    const jumlahSebelum = (await db.select().from(journalEntries)).length
    const op = await buatOperasi({
      tipe: 'transfer', tanggal: '2026-06-20',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['GU/BJ'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '40', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    const selesai = await selesaikanOperasi(op.id, penggunaId)

    expect(selesai.jurnalEntryId).toBeNull()
    expect(await db.select().from(journalEntries)).toHaveLength(jumlahSebelum)
  })
})

// ── Barang rusak ─────────────────────────────────────────────────────────────

describe('barang rusak', () => {
  beforeEach(async () => { await terima('100', '50000') })

  it('mengurangi stok dan membebankan kerugian barang rusak', async () => {
    const op = await buatOperasi({
      tipe: 'barang_rusak', tanggal: '2026-06-20',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['VIR/RUSAK'],
      partnerId: null, referensi: null, catatan: 'Terkena air hujan',
      baris: [{ produkId: produkKayu, kuantitas: '5', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    const selesai = await selesaikanOperasi(op.id, penggunaId)

    expect(selesai.nomor).toBe('SCR/2026/06/0001')
    expect(await stokKayu()).toBe(95)

    const item = await db.select().from(journalItems)
      .where(eq(journalItems.entryId, selesai.jurnalEntryId!))
    expect(item.find((b) => b.accountId === akun['5106'])!.debit).toBe('250000.00')
    expect(item.find((b) => b.accountId === akun['1131'])!.kredit).toBe('250000.00')
  })

  it('memakai akun kerugian barang rusak, bukan akun selisih persediaan', async () => {
    const op = await buatOperasi({
      tipe: 'barang_rusak', tanggal: '2026-06-20',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['VIR/RUSAK'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '5', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    const selesai = await selesaikanOperasi(op.id, penggunaId)
    const item = await db.select().from(journalItems)
      .where(eq(journalItems.entryId, selesai.jurnalEntryId!))
    expect(item.some((b) => b.accountId === akun['5105'])).toBe(false)
  })
})

// ── Stock opname ─────────────────────────────────────────────────────────────

describe('stock opname', () => {
  beforeEach(async () => { await terima('100', '50000') })

  function opname(kuantitasHitung: string) {
    return buatOperasi({
      tipe: 'opname', tanggal: '2026-06-25',
      lokasiAsalId: lokasi['VIR/PENYESUAIAN'], lokasiTujuanId: lokasi['GU/BB'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{
        produkId: produkKayu, kuantitas: kuantitasHitung,
        uomId: satuan.UNIT, hargaSatuan: null, catatan: null,
      }],
    }, penggunaId)
  }

  it('membukukan selisih lebih saat hitung fisik melebihi catatan', async () => {
    const op = await opname('110')
    const selesai = await selesaikanOperasi(op.id, penggunaId)

    expect(selesai.nomor).toBe('OPN/2026/06/0001')
    expect(await stokKayu()).toBe(110)

    const item = await db.select().from(journalItems)
      .where(eq(journalItems.entryId, selesai.jurnalEntryId!))
    expect(item.find((b) => b.accountId === akun['1131'])!.debit).toBe('500000.00')
    expect(item.find((b) => b.accountId === akun['5105'])!.kredit).toBe('500000.00')
  })

  it('membukukan selisih kurang saat hitung fisik di bawah catatan', async () => {
    const op = await opname('90')
    const selesai = await selesaikanOperasi(op.id, penggunaId)

    expect(await stokKayu()).toBe(90)

    const item = await db.select().from(journalItems)
      .where(eq(journalItems.entryId, selesai.jurnalEntryId!))
    expect(item.find((b) => b.accountId === akun['5105'])!.debit).toBe('500000.00')
    expect(item.find((b) => b.accountId === akun['1131'])!.kredit).toBe('500000.00')
  })

  it('menolak opname yang tidak menghasilkan selisih apa pun', async () => {
    const op = await opname('100')
    await expect(selesaikanOperasi(op.id, penggunaId))
      .rejects.toThrow('sama dengan stok tercatat')
  })

  it('membukukan hanya selisihnya, bukan seluruh hasil hitung', async () => {
    const op = await opname('110')
    await selesaikanOperasi(op.id, penggunaId)
    const gerak = await db.select().from(stockMoves).where(eq(stockMoves.operasiId, op.id))
    expect(gerak).toHaveLength(1)
    expect(Number(gerak[0].kuantitas)).toBe(10)
  })
})

// ── Kartu stok dan valuasi ───────────────────────────────────────────────────

describe('kartu stok', () => {
  it('mencatat setiap pergerakan berurut tanggal dengan nilainya', async () => {
    await terima('100', '50000', '2026-06-10')
    await terima('50', '70000', '2026-06-12')

    const op = await buatOperasi({
      tipe: 'pengiriman', tanggal: '2026-06-20',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['VIR/PELANGGAN'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '30', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    await selesaikanOperasi(op.id, penggunaId)

    const kartu = await kartuStok(produkKayu, '2026-01-01', '2026-12-31')
    expect(kartu).toHaveLength(3)
    expect(kartu.map((b) => Number(b.masuk))).toEqual([100, 50, 0])
    expect(kartu.map((b) => Number(b.keluar))).toEqual([0, 0, 30])
    expect(kartu[0].tipeOperasi).toBe('penerimaan')
    expect(kartu[2].tipeOperasi).toBe('pengiriman')
  })

  it('menghormati batas rentang tanggal', async () => {
    await terima('100', '50000', '2026-06-10')
    await terima('50', '70000', '2026-07-12')
    expect(await kartuStok(produkKayu, '2026-06-01', '2026-06-30')).toHaveLength(1)
  })
})

describe('valuasi persediaan', () => {
  it('menghitung nilai sebagai stok dikali harga pokok rata-rata', async () => {
    await terima('100', '50000')
    await terima('100', '70000', '2026-06-15')

    const stok = await stokSeluruhProduk()
    const kayu = stok.find((s) => s.produkId === produkKayu)!
    expect(Number(kayu.stok)).toBe(200)
    expect(Number(kayu.hargaPokokRataRata)).toBe(60000)
    expect(kayu.nilai).toBe('12000000.00')
  })

  it('menampilkan produk tanpa pergerakan dengan stok nol', async () => {
    const stok = await stokSeluruhProduk()
    const kursi = stok.find((s) => s.produkId === produkKursi)!
    expect(Number(kursi.stok)).toBe(0)
    expect(kursi.nilai).toBe('0.00')
  })
})

// ── Sifat yang harus selalu terpenuhi ────────────────────────────────────────

describe('gudang — nilai persediaan selalu cocok dengan buku besar', () => {
  /**
   * Setiap pergerakan stok yang mengubah nilai persediaan wajib menghasilkan
   * jurnal dengan nilai yang persis sama. Bila tidak, Neraca akan menyimpang
   * dari laporan valuasi persediaan.
   */
  it('saldo akun persediaan sama dengan nilai persediaan setelah rangkaian operasi', async () => {
    await terima('100', '50000', '2026-06-01')
    await terima('50', '70000', '2026-06-05')

    const keluar = await buatOperasi({
      tipe: 'pengiriman', tanggal: '2026-06-10',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['VIR/PELANGGAN'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '40', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    await selesaikanOperasi(keluar.id, penggunaId)

    const rusak = await buatOperasi({
      tipe: 'barang_rusak', tanggal: '2026-06-12',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['VIR/RUSAK'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '10', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    await selesaikanOperasi(rusak.id, penggunaId)

    const transfer = await buatOperasi({
      tipe: 'transfer', tanggal: '2026-06-14',
      lokasiAsalId: lokasi['GU/BB'], lokasiTujuanId: lokasi['GU/BJ'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '25', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    await selesaikanOperasi(transfer.id, penggunaId)

    const opname = await buatOperasi({
      tipe: 'opname', tanggal: '2026-06-20',
      lokasiAsalId: lokasi['VIR/PENYESUAIAN'], lokasiTujuanId: lokasi['GU/BB'],
      partnerId: null, referensi: null, catatan: null,
      baris: [{ produkId: produkKayu, kuantitas: '70', uomId: satuan.UNIT, hargaSatuan: null, catatan: null }],
    }, penggunaId)
    await selesaikanOperasi(opname.id, penggunaId)

    const item = await db.select().from(journalItems)
      .where(eq(journalItems.accountId, akun['1131']))
    const saldoBukuBesar = item.reduce(
      (t, b) => t + Number(b.debit) - Number(b.kredit), 0,
    )

    const stok = await stokSeluruhProduk()
    const nilaiPersediaan = stok.reduce((t, s) => t + Number(s.nilai), 0)

    expect(
      Math.abs(saldoBukuBesar - nilaiPersediaan),
      `saldo buku besar ${saldoBukuBesar} menyimpang dari nilai persediaan ${nilaiPersediaan}`,
    ).toBeLessThan(0.01)
  })

  it('setiap operasi berdampak nilai memiliki jurnal yang seimbang', async () => {
    await terima('100', '50000')
    const operasi = await db.select().from(stockOperations)
      .where(eq(stockOperations.status, 'selesai'))

    for (const op of operasi) {
      if (!op.jurnalEntryId) continue
      const item = await db.select().from(journalItems)
        .where(eq(journalItems.entryId, op.jurnalEntryId))
      const debit = item.reduce((t, b) => t + Number(b.debit), 0)
      const kredit = item.reduce((t, b) => t + Number(b.kredit), 0)
      expect(debit, `operasi ${op.nomor} tidak seimbang`).toBeCloseTo(kredit, 2)
    }
  })
})
