import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  users, accounts, journals, sequences, companySettings, currencies,
  journalItems, journalEntries, uoms, productCategories, products,
  warehouses, locations, partners, taxes, purchaseOrderLines,
} from '@/db/schema'
import {
  buatPesanan, konfirmasiPesanan, batalkanPesanan, hapusPermintaan,
  ambilPesanan, barisDenganSisa, totalPesanan,
} from '@/modules/pembelian/layanan/pesanan'
import { terimaDariPesanan, penerimaanPesanan } from '@/modules/pembelian/layanan/penerimaan'
import {
  buatTagihan, postingTagihan, ringkasanTagihan, tagihanBelumLunas,
} from '@/modules/pembelian/layanan/tagihan'
import { buatPembayaran, postingPembayaran } from '@/modules/pembelian/layanan/pembayaran'
import { stokSeluruhProduk } from '@/modules/gudang/repositori/stok'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const TABEL = [
  'vendor_payment_allocations', 'vendor_payments',
  'vendor_bill_lines', 'vendor_bills',
  'purchase_order_lines', 'purchase_orders',
  'packing_list_items', 'packing_lists', 'stock_moves', 'stock_operation_lines',
  'stock_operations', 'products', 'product_categories', 'uoms',
  'locations', 'warehouses',
  'journal_items', 'journal_entries', 'journals', 'sequences',
  'company_settings', 'accounts', 'currency_rates', 'currencies',
  'audit_logs', 'user_roles', 'users', 'partners', 'payment_terms', 'taxes',
]

let penggunaId: string
let pemasokId: string
let produkKayuId: string
let lokasiGudangId: string
let satuanUnitId: string
let pajakPpnId: string
let pajakPphId: string
const akun: Record<string, string> = {}

beforeEach(async () => {
  await bersihkanTabel(TABEL)
  await db.insert(currencies).values({ kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 })

  const dibuatAkun = await db.insert(accounts).values([
    { kode: '1101', nama: 'Kas', tipeAkun: 'aset_kas' },
    { kode: '1111', nama: 'Bank BCA', tipeAkun: 'aset_bank' },
    { kode: '1131', nama: 'Persediaan Bahan Baku', tipeAkun: 'aset_persediaan' },
    { kode: '1141', nama: 'PPN Masukan', tipeAkun: 'aset_lancar_lain' },
    { kode: '1151', nama: 'Uang Muka Pembelian', tipeAkun: 'aset_lancar_lain' },
    { kode: '2101', nama: 'Utang Usaha', tipeAkun: 'liabilitas_utang_usaha' },
    { kode: '2113', nama: 'Utang PPh 23', tipeAkun: 'liabilitas_pajak' },
    { kode: '2151', nama: 'Penerimaan Barang Belum Ditagih', tipeAkun: 'liabilitas_jangka_pendek' },
    { kode: '5101', nama: 'HPP Bahan Baku', tipeAkun: 'beban_hpp' },
    { kode: '5105', nama: 'Selisih Persediaan', tipeAkun: 'beban_hpp' },
    { kode: '5106', nama: 'Kerugian Barang Rusak', tipeAkun: 'beban_hpp' },
    { kode: '6133', nama: 'Beban Jasa Profesional', tipeAkun: 'beban_operasional' },
  ]).returning()
  for (const a of dibuatAkun) akun[a.kode] = a.id

  await db.insert(companySettings).values({
    nama: 'PT Uji', akunPenerimaanBelumDitagihId: akun['2151'],
  })

  const [pengguna] = await db.insert(users).values({
    email: 'pembelian@uji.id', nama: 'Staf Pembelian', passwordHash: 'x',
  }).returning()
  penggunaId = pengguna.id

  const dibuatUrutan = await db.insert(sequences).values([
    { kode: 'jurnal:JPS', prefix: 'JPS', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'jurnal:PMB', prefix: 'FB', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'jurnal:BNK', prefix: 'BB', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'gudang:penerimaan', prefix: 'GRN', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'pembelian:pesanan', prefix: 'PO', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'pembelian:tagihan', prefix: 'FB', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'pembelian:nota-debit', prefix: 'ND', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'pembelian:pembayaran', prefix: 'BKK', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
  ]).returning()
  const urutanLewatKode = new Map(dibuatUrutan.map((u) => [u.kode, u.id]))

  await db.insert(journals).values([
    { kode: 'JPS', nama: 'Jurnal Penyesuaian Persediaan', tipe: 'umum', sequenceId: urutanLewatKode.get('jurnal:JPS')! },
    { kode: 'PMB', nama: 'Jurnal Pembelian', tipe: 'pembelian', sequenceId: urutanLewatKode.get('jurnal:PMB')! },
    { kode: 'BNK', nama: 'Jurnal Bank', tipe: 'bank', sequenceId: urutanLewatKode.get('jurnal:BNK')! },
  ])

  const [satuan] = await db.insert(uoms).values({
    kode: 'UNIT', nama: 'Unit', kategori: 'satuan', faktor: '1',
  }).returning()
  satuanUnitId = satuan.id

  const [kategori] = await db.insert(productCategories).values({
    kode: 'BB', nama: 'Bahan Baku',
    akunPersediaanId: akun['1131'], akunHppId: akun['5101'],
    akunSelisihId: akun['5105'], akunBarangRusakId: akun['5106'],
  }).returning()

  const [produk] = await db.insert(products).values({
    kode: 'BB-KAYU', nama: 'Kayu Jati', kategoriId: kategori.id, uomId: satuan.id,
  }).returning()
  produkKayuId = produk.id

  const [gudang] = await db.insert(warehouses).values({ kode: 'GU', nama: 'Gudang Utama' }).returning()
  const dibuatLokasi = await db.insert(locations).values([
    { kode: 'GU/BB', nama: 'Gudang Bahan Baku', tipe: 'internal', warehouseId: gudang.id },
    { kode: 'VIR/PEMASOK', nama: 'Pemasok', tipe: 'pemasok' },
    { kode: 'VIR/PELANGGAN', nama: 'Pelanggan', tipe: 'pelanggan' },
  ]).returning()
  lokasiGudangId = dibuatLokasi[0].id

  const [pemasok] = await db.insert(partners).values({
    kode: 'SUPP-001', nama: 'UD Kayu Nusantara', isPemasok: true,
  }).returning()
  pemasokId = pemasok.id

  const dibuatPajak = await db.insert(taxes).values([
    {
      kode: 'PPN-M-11', nama: 'PPN Masukan 11%', ruangLingkup: 'pembelian',
      tarif: '11', hargaTermasukPajak: false, isPemotongan: false, akunPajakId: akun['1141'],
    },
    {
      kode: 'PPH23-2', nama: 'PPh 23 Jasa 2%', ruangLingkup: 'pembelian',
      tarif: '2', hargaTermasukPajak: false, isPemotongan: true, akunPajakId: akun['2113'],
    },
  ]).returning()
  pajakPpnId = dibuatPajak[0].id
  pajakPphId = dibuatPajak[1].id
})

afterAll(async () => { await tutupKoneksi() })

// ── Pembantu ─────────────────────────────────────────────────────────────────

function pesananDasar(ubah: Record<string, unknown> = {}) {
  return {
    partnerId: pemasokId,
    tanggal: '2026-06-01',
    tanggalDiharapkan: '2026-06-10',
    lokasiTujuanId: lokasiGudangId,
    syaratPembayaranId: null,
    mataUangId: 'IDR',
    referensi: null, catatan: null,
    baris: [{
      produkId: produkKayuId, deskripsi: 'Kayu Jati Papan',
      kuantitas: '100', uomId: satuanUnitId, hargaSatuan: '500000', taxId: pajakPpnId,
    }],
    ...ubah,
  }
}

async function saldo(kodeAkun: string): Promise<number> {
  const item = await db.select().from(journalItems)
    .where(eq(journalItems.accountId, akun[kodeAkun]))
  return item.reduce((t, b) => t + Number(b.debit) - Number(b.kredit), 0)
}

// ── Permintaan dan pesanan ───────────────────────────────────────────────────

describe('permintaan penawaran', () => {
  it('menyimpan permintaan tanpa nomor', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    expect(po.status).toBe('permintaan')
    expect(po.nomor).toBeNull()
    expect(po.baris).toHaveLength(1)
  })

  it('menolak permintaan tanpa baris produk', async () => {
    await expect(buatPesanan(pesananDasar({ baris: [] }), penggunaId))
      .rejects.toThrow('minimal satu baris')
  })

  it('menolak lokasi tujuan yang bukan lokasi internal', async () => {
    const [virtual] = await db.select().from(locations).where(eq(locations.kode, 'VIR/PEMASOK'))
    await expect(buatPesanan(pesananDasar({ lokasiTujuanId: virtual.id }), penggunaId))
      .rejects.toThrow('harus lokasi internal')
  })

  it('menghitung total berikut PPN', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    const total = await totalPesanan(po.id)
    expect(total.totalDpp).toBe('50000000.00')
    expect(total.totalPpn).toBe('5500000.00')
    expect(total.totalTagihan).toBe('55500000.00')
  })

  it('memberi nomor saat dikonfirmasi, bukan saat dibuat', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    const dikonfirmasi = await konfirmasiPesanan(po.id, penggunaId)
    expect(dikonfirmasi.nomor).toBe('PO/2026/06/0001')
    expect(dikonfirmasi.status).toBe('dikonfirmasi')
  })

  it('menolak konfirmasi ganda', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(po.id, penggunaId)
    await expect(konfirmasiPesanan(po.id, penggunaId)).rejects.toThrow('sudah dikonfirmasi')
  })

  it('menolak penghapusan pesanan yang sudah dikonfirmasi', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(po.id, penggunaId)
    await expect(hapusPermintaan(po.id)).rejects.toThrow('sudah menjadi komitmen')
  })

  it('mengizinkan penghapusan permintaan yang belum dikonfirmasi', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await hapusPermintaan(po.id)
    expect(await ambilPesanan(po.id)).toBeNull()
  })
})

// ── Penerimaan dari pesanan ──────────────────────────────────────────────────

describe('penerimaan barang atas pesanan', () => {
  it('menolak penerimaan atas pesanan yang belum dikonfirmasi', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await expect(terimaDariPesanan({
      poId: po.id, tanggal: '2026-06-10',
      baris: [{ poLineId: po.baris[0].id, kuantitas: '100' }],
    }, penggunaId)).rejects.toThrow('sudah dikonfirmasi')
  })

  it('menambah stok dan mencatat asal-usulnya ke pesanan', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(po.id, penggunaId)

    const hasil = await terimaDariPesanan({
      poId: po.id, tanggal: '2026-06-10',
      baris: [{ poLineId: po.baris[0].id, kuantitas: '100' }],
    }, penggunaId)

    expect(hasil.nomor).toBe('GRN/2026/06/0001')

    const stok = await stokSeluruhProduk()
    expect(Number(stok.find((s) => s.produkId === produkKayuId)!.stok)).toBe(100)

    const riwayat = await penerimaanPesanan(po.id)
    expect(riwayat).toHaveLength(1)
    expect(riwayat[0].nomor).toBe('GRN/2026/06/0001')
  })

  it('memakai harga pesanan sebagai harga pokok rata-rata', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(po.id, penggunaId)
    await terimaDariPesanan({
      poId: po.id, tanggal: '2026-06-10',
      baris: [{ poLineId: po.baris[0].id, kuantitas: '100' }],
    }, penggunaId)

    const [produk] = await db.select().from(products).where(eq(products.id, produkKayuId))
    expect(Number(produk.hargaPokokRataRata)).toBe(500000)
  })

  it('memposting Dr Persediaan / Cr Penerimaan Belum Ditagih', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(po.id, penggunaId)
    await terimaDariPesanan({
      poId: po.id, tanggal: '2026-06-10',
      baris: [{ poLineId: po.baris[0].id, kuantitas: '100' }],
    }, penggunaId)

    expect(await saldo('1131')).toBe(50_000_000)
    expect(await saldo('2151')).toBe(-50_000_000)
  })

  it('menolak penerimaan melebihi sisa pesanan', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(po.id, penggunaId)
    await expect(terimaDariPesanan({
      poId: po.id, tanggal: '2026-06-10',
      baris: [{ poLineId: po.baris[0].id, kuantitas: '150' }],
    }, penggunaId)).rejects.toThrow('melebihi sisa pesanan')
  })

  it('mendukung penerimaan bertahap', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(po.id, penggunaId)

    await terimaDariPesanan({
      poId: po.id, tanggal: '2026-06-10',
      baris: [{ poLineId: po.baris[0].id, kuantitas: '60' }],
    }, penggunaId)

    let sisa = await barisDenganSisa(po.id)
    expect(Number(sisa[0].kuantitasDiterima)).toBe(60)
    expect(Number(sisa[0].sisaDiterima)).toBe(40)

    await terimaDariPesanan({
      poId: po.id, tanggal: '2026-06-15',
      baris: [{ poLineId: po.baris[0].id, kuantitas: '40' }],
    }, penggunaId)

    sisa = await barisDenganSisa(po.id)
    expect(Number(sisa[0].sisaDiterima)).toBe(0)
  })

  it('menolak pembatalan pesanan yang sudah menerima barang', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(po.id, penggunaId)
    await terimaDariPesanan({
      poId: po.id, tanggal: '2026-06-10',
      baris: [{ poLineId: po.baris[0].id, kuantitas: '50' }],
    }, penggunaId)
    await expect(batalkanPesanan(po.id)).rejects.toThrow('sudah memiliki penerimaan')
  })
})

// ── Tagihan menutup penampung ────────────────────────────────────────────────

describe('tagihan pembelian', () => {
  async function siapkanPenerimaan() {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(po.id, penggunaId)
    await terimaDariPesanan({
      poId: po.id, tanggal: '2026-06-10',
      baris: [{ poLineId: po.baris[0].id, kuantitas: '100' }],
    }, penggunaId)
    return po
  }

  function tagihanDariPo(po: Awaited<ReturnType<typeof buatPesanan>>, ubah: Record<string, unknown> = {}) {
    return {
      tipe: 'tagihan' as const,
      partnerId: pemasokId,
      poId: po.id,
      tanggal: '2026-06-12',
      tanggalJatuhTempo: '2026-07-12',
      referensiPemasok: 'INV-PMS-9911',
      mataUangId: 'IDR',
      catatan: null,
      baris: [{
        produkId: produkKayuId,
        poLineId: po.baris[0].id,
        deskripsi: 'Kayu Jati Papan',
        kuantitas: '100',
        uomId: satuanUnitId,
        hargaSatuan: '500000',
        taxId: pajakPpnId,
        akunId: akun['2151'],
      }],
      ...ubah,
    }
  }

  it('menutup akun Penerimaan Barang Belum Ditagih sampai nol', async () => {
    const po = await siapkanPenerimaan()
    expect(await saldo('2151')).toBe(-50_000_000)

    const tagihan = await buatTagihan(tagihanDariPo(po), penggunaId)
    await postingTagihan(tagihan.id, penggunaId)

    expect(await saldo('2151')).toBe(0)
  })

  it('mendebit PPN Masukan dan mengkredit Utang Usaha', async () => {
    const po = await siapkanPenerimaan()
    const tagihan = await buatTagihan(tagihanDariPo(po), penggunaId)
    await postingTagihan(tagihan.id, penggunaId)

    expect(await saldo('1141')).toBe(5_500_000)
    expect(await saldo('2101')).toBe(-55_500_000)
  })

  it('memberi nomor saat diposting dan mengunci isinya', async () => {
    const po = await siapkanPenerimaan()
    const tagihan = await buatTagihan(tagihanDariPo(po), penggunaId)
    expect(tagihan.nomor).toBeNull()

    const diposting = await postingTagihan(tagihan.id, penggunaId)
    expect(diposting.nomor).toBe('FB/2026/06/0001')
    expect(diposting.status).toBe('diposting')
    await expect(postingTagihan(tagihan.id, penggunaId)).rejects.toThrow('sudah diposting')
  })

  it('memperbarui kuantitas ditagih pada pesanan', async () => {
    const po = await siapkanPenerimaan()
    const tagihan = await buatTagihan(tagihanDariPo(po), penggunaId)
    await postingTagihan(tagihan.id, penggunaId)

    const [baris] = await db.select().from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.poId, po.id))
    expect(Number(baris.kuantitasDitagih)).toBe(100)
  })

  it('menandai pesanan selesai saat seluruhnya diterima dan ditagih', async () => {
    const po = await siapkanPenerimaan()
    const tagihan = await buatTagihan(tagihanDariPo(po), penggunaId)
    await postingTagihan(tagihan.id, penggunaId)

    expect((await ambilPesanan(po.id))!.status).toBe('selesai')
  })

  it('menghasilkan jurnal yang seimbang', async () => {
    const po = await siapkanPenerimaan()
    const tagihan = await buatTagihan(tagihanDariPo(po), penggunaId)
    const diposting = await postingTagihan(tagihan.id, penggunaId)

    const item = await db.select().from(journalItems)
      .where(eq(journalItems.entryId, diposting.jurnalEntryId!))
    const debit = item.reduce((t, b) => t + Number(b.debit), 0)
    const kredit = item.reduce((t, b) => t + Number(b.kredit), 0)
    expect(debit).toBeCloseTo(kredit, 2)
  })

  it('memperlakukan PPh sebagai pengurang pembayaran, bukan pengurang tagihan', async () => {
    const tagihan = await buatTagihan({
      tipe: 'tagihan', partnerId: pemasokId, poId: null,
      tanggal: '2026-06-20', tanggalJatuhTempo: null,
      referensiPemasok: 'INV-JASA-01', mataUangId: 'IDR', catatan: null,
      baris: [{
        produkId: null, poLineId: null, deskripsi: 'Jasa desain furnitur',
        kuantitas: '1', uomId: null, hargaSatuan: '10000000',
        taxId: pajakPphId, akunId: akun['6133'],
      }],
    }, penggunaId)
    await postingTagihan(tagihan.id, penggunaId)

    expect(await saldo('6133')).toBe(10_000_000)
    expect(await saldo('2113')).toBe(-200_000)
    // Utang bersih adalah nilai jasa dikurangi PPh yang dipotong.
    expect(await saldo('2101')).toBe(-9_800_000)
  })

  it('membalik seluruh arah pada nota debit', async () => {
    const po = await siapkanPenerimaan()
    const tagihan = await buatTagihan(tagihanDariPo(po), penggunaId)
    await postingTagihan(tagihan.id, penggunaId)

    const nota = await buatTagihan(tagihanDariPo(po, {
      tipe: 'nota_debit', tanggal: '2026-06-25',
      baris: [{
        produkId: produkKayuId, poLineId: po.baris[0].id,
        deskripsi: 'Retur kayu cacat', kuantitas: '10',
        uomId: satuanUnitId, hargaSatuan: '500000',
        taxId: pajakPpnId, akunId: akun['2151'],
      }],
    }), penggunaId)
    const diposting = await postingTagihan(nota.id, penggunaId)

    expect(diposting.nomor).toBe('ND/2026/06/0001')
    // Utang usaha berkurang: 55.500.000 dikurangi 5.550.000.
    expect(await saldo('2101')).toBeCloseTo(-49_950_000, 2)
  })
})

// ── Pembayaran ───────────────────────────────────────────────────────────────

describe('pembayaran kepada pemasok', () => {
  async function siapkanTagihanTerposting() {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(po.id, penggunaId)
    await terimaDariPesanan({
      poId: po.id, tanggal: '2026-06-10',
      baris: [{ poLineId: po.baris[0].id, kuantitas: '100' }],
    }, penggunaId)
    const tagihan = await buatTagihan({
      tipe: 'tagihan', partnerId: pemasokId, poId: po.id,
      tanggal: '2026-06-12', tanggalJatuhTempo: '2026-07-12',
      referensiPemasok: 'INV-1', mataUangId: 'IDR', catatan: null,
      baris: [{
        produkId: produkKayuId, poLineId: po.baris[0].id,
        deskripsi: 'Kayu Jati', kuantitas: '100', uomId: satuanUnitId,
        hargaSatuan: '500000', taxId: pajakPpnId, akunId: akun['2151'],
      }],
    }, penggunaId)
    return postingTagihan(tagihan.id, penggunaId)
  }

  it('menampilkan sisa tagihan sebelum dibayar', async () => {
    const tagihan = await siapkanTagihanTerposting()
    const ringkasan = await ringkasanTagihan(tagihan.id)
    expect(ringkasan!.totalTagihan).toBe('55500000.00')
    expect(ringkasan!.terbayar).toBe('0.00')
    expect(ringkasan!.sisa).toBe('55500000.00')
  })

  it('melunasi tagihan penuh dan mengosongkan utang usaha', async () => {
    const tagihan = await siapkanTagihanTerposting()
    const pembayaran = await buatPembayaran({
      partnerId: pemasokId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '55500000',
      referensi: 'TRF-001', catatan: null,
      alokasi: [{ billId: tagihan.id, jumlah: '55500000' }],
    }, penggunaId)
    const diposting = await postingPembayaran(pembayaran.id, penggunaId)

    expect(diposting.nomor).toBe('BKK/2026/07/0001')
    expect(await saldo('2101')).toBe(0)
    expect(await saldo('1111')).toBe(-55_500_000)

    const ringkasan = await ringkasanTagihan(tagihan.id)
    expect(ringkasan!.sisa).toBe('0.00')
  })

  it('mendukung pembayaran sebagian', async () => {
    const tagihan = await siapkanTagihanTerposting()
    const pembayaran = await buatPembayaran({
      partnerId: pemasokId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '20000000',
      referensi: null, catatan: null,
      alokasi: [{ billId: tagihan.id, jumlah: '20000000' }],
    }, penggunaId)
    await postingPembayaran(pembayaran.id, penggunaId)

    const ringkasan = await ringkasanTagihan(tagihan.id)
    expect(ringkasan!.terbayar).toBe('20000000.00')
    expect(ringkasan!.sisa).toBe('35500000.00')
    expect((await tagihanBelumLunas(pemasokId))).toHaveLength(1)
  })

  it('menolak alokasi melebihi sisa tagihan', async () => {
    const tagihan = await siapkanTagihanTerposting()
    await expect(buatPembayaran({
      partnerId: pemasokId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '60000000',
      referensi: null, catatan: null,
      alokasi: [{ billId: tagihan.id, jumlah: '60000000' }],
    }, penggunaId)).rejects.toThrow('melebihi sisanya')
  })

  it('menolak total alokasi melebihi jumlah pembayaran', async () => {
    const tagihan = await siapkanTagihanTerposting()
    await expect(buatPembayaran({
      partnerId: pemasokId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '10000000',
      referensi: null, catatan: null,
      alokasi: [{ billId: tagihan.id, jumlah: '20000000' }],
    }, penggunaId)).rejects.toThrow('melebihi jumlah pembayaran')
  })

  it('menolak pembayaran atas tagihan yang masih draft', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(po.id, penggunaId)
    const tagihan = await buatTagihan({
      tipe: 'tagihan', partnerId: pemasokId, poId: po.id,
      tanggal: '2026-06-12', tanggalJatuhTempo: null,
      referensiPemasok: null, mataUangId: 'IDR', catatan: null,
      baris: [{
        produkId: produkKayuId, poLineId: null, deskripsi: 'Kayu',
        kuantitas: '1', uomId: satuanUnitId, hargaSatuan: '100',
        taxId: null, akunId: akun['2151'],
      }],
    }, penggunaId)

    await expect(buatPembayaran({
      partnerId: pemasokId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '100',
      referensi: null, catatan: null,
      alokasi: [{ billId: tagihan.id, jumlah: '100' }],
    }, penggunaId)).rejects.toThrow('belum diposting')
  })

  it('mencatat kelebihan pembayaran sebagai uang muka pembelian', async () => {
    const tagihan = await siapkanTagihanTerposting()
    const pembayaran = await buatPembayaran({
      partnerId: pemasokId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '60000000',
      referensi: null, catatan: null,
      alokasi: [{ billId: tagihan.id, jumlah: '55500000' }],
    }, penggunaId)
    await postingPembayaran(pembayaran.id, penggunaId)

    expect(await saldo('1151')).toBe(4_500_000)
    expect(await saldo('1111')).toBe(-60_000_000)
  })
})

// ── Sifat yang harus selalu terpenuhi ────────────────────────────────────────

describe('pembelian — buku besar tetap seimbang di sepanjang alur', () => {
  it('penampung tertutup dan seluruh jurnal seimbang dari pesanan sampai lunas', async () => {
    const po = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(po.id, penggunaId)

    await terimaDariPesanan({
      poId: po.id, tanggal: '2026-06-10',
      baris: [{ poLineId: po.baris[0].id, kuantitas: '60' }],
    }, penggunaId)
    await terimaDariPesanan({
      poId: po.id, tanggal: '2026-06-15',
      baris: [{ poLineId: po.baris[0].id, kuantitas: '40' }],
    }, penggunaId)

    const tagihan = await buatTagihan({
      tipe: 'tagihan', partnerId: pemasokId, poId: po.id,
      tanggal: '2026-06-20', tanggalJatuhTempo: '2026-07-20',
      referensiPemasok: 'INV-9', mataUangId: 'IDR', catatan: null,
      baris: [{
        produkId: produkKayuId, poLineId: po.baris[0].id,
        deskripsi: 'Kayu Jati', kuantitas: '100', uomId: satuanUnitId,
        hargaSatuan: '500000', taxId: pajakPpnId, akunId: akun['2151'],
      }],
    }, penggunaId)
    await postingTagihan(tagihan.id, penggunaId)

    const pembayaran = await buatPembayaran({
      partnerId: pemasokId, tanggal: '2026-07-05',
      akunKasId: akun['1111'], jumlah: '55500000',
      referensi: null, catatan: null,
      alokasi: [{ billId: tagihan.id, jumlah: '55500000' }],
    }, penggunaId)
    await postingPembayaran(pembayaran.id, penggunaId)

    // Penampung tertutup, utang lunas, persediaan tetap tercatat.
    expect(await saldo('2151')).toBe(0)
    expect(await saldo('2101')).toBe(0)
    expect(await saldo('1131')).toBe(50_000_000)
    expect(await saldo('1141')).toBe(5_500_000)
    expect(await saldo('1111')).toBe(-55_500_000)

    // Setiap entri jurnal harus seimbang.
    const entri = await db.select().from(journalEntries)
    for (const e of entri) {
      const item = await db.select().from(journalItems).where(eq(journalItems.entryId, e.id))
      const debit = item.reduce((t, b) => t + Number(b.debit), 0)
      const kredit = item.reduce((t, b) => t + Number(b.kredit), 0)
      expect(debit, `entri ${e.nomor} tidak seimbang`).toBeCloseTo(kredit, 2)
    }

    // Seluruh buku besar harus seimbang.
    const semua = await db.select().from(journalItems)
    const totalDebit = semua.reduce((t, b) => t + Number(b.debit), 0)
    const totalKredit = semua.reduce((t, b) => t + Number(b.kredit), 0)
    expect(totalDebit).toBeCloseTo(totalKredit, 2)
  })
})
