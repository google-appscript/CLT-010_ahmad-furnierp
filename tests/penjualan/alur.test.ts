import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  users, accounts, journals, sequences, companySettings, currencies,
  journalItems, journalEntries, uoms, productCategories, products,
  warehouses, locations, partners, taxes, salesOrderLines, stockMoves,
} from '@/db/schema'
import {
  buatPesanan, konfirmasiPesanan, batalkanPesanan, hapusPenawaran,
  ambilPesanan, barisDenganSisa, totalPesanan,
} from '@/modules/penjualan/layanan/pesanan'
import { kirimDariPesanan, pengirimanPesanan } from '@/modules/penjualan/layanan/pengiriman'
import {
  buatFaktur, postingFaktur, ringkasanFaktur, fakturBelumLunas,
} from '@/modules/penjualan/layanan/faktur'
import { buatPembayaran, postingPembayaran } from '@/modules/penjualan/layanan/pembayaran'
import {
  itemTerbuka, rekonsiliasi, daftarRekonsiliasi, batalkanRekonsiliasi,
} from '@/modules/akuntansi/layanan/rekonsiliasi'
import { buatOperasi, selesaikanOperasi } from '@/modules/gudang/layanan/operasi'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'
import { seedPemetaanJurnal } from '../bantuan/pemetaan'

const TABEL = [
  'customer_payment_allocations', 'customer_payments',
  'customer_invoice_lines', 'customer_invoices',
  'sales_order_lines', 'sales_orders',
  'vendor_payment_allocations', 'vendor_payments',
  'vendor_bill_lines', 'vendor_bills',
  'purchase_order_lines', 'purchase_orders',
  'packing_list_items', 'packing_lists', 'stock_moves', 'stock_operation_lines',
  'stock_operations', 'products', 'product_categories', 'uoms',
  'locations', 'warehouses',
  'journal_items', 'journal_entries', 'reconciliations', 'journal_mappings', 'journals', 'sequences',
  'company_settings', 'accounts', 'currency_rates', 'currencies',
  'audit_logs', 'user_roles', 'users', 'partners', 'payment_terms', 'taxes',
]

let penggunaId: string
let pelangganId: string
let produkKursiId: string
let lokasiGudangId: string
let lokasiPemasokId: string
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
    { kode: '1121', nama: 'Piutang Usaha', tipeAkun: 'aset_piutang', dapatDirekonsiliasi: true },
    { kode: '1134', nama: 'Persediaan Barang Jadi', tipeAkun: 'aset_persediaan' },
    { kode: '1142', nama: 'PPh 23 Dibayar di Muka', tipeAkun: 'aset_lancar_lain' },
    { kode: '2111', nama: 'PPN Keluaran', tipeAkun: 'liabilitas_pajak' },
    { kode: '2131', nama: 'Uang Muka Penjualan', tipeAkun: 'liabilitas_jangka_pendek' },
    { kode: '2151', nama: 'Penerimaan Barang Belum Ditagih', tipeAkun: 'liabilitas_jangka_pendek' },
    { kode: '4101', nama: 'Penjualan Furnitur', tipeAkun: 'pendapatan' },
    { kode: '5104', nama: 'HPP Barang Jadi', tipeAkun: 'beban_hpp' },
    { kode: '5105', nama: 'Selisih Persediaan', tipeAkun: 'beban_hpp' },
    { kode: '5106', nama: 'Kerugian Barang Rusak', tipeAkun: 'beban_hpp' },
  ]).returning()
  for (const a of dibuatAkun) akun[a.kode] = a.id

  await db.insert(companySettings).values({
    nama: 'PT Uji', akunPenerimaanBelumDitagihId: akun['2151'],
  })

  const [pengguna] = await db.insert(users).values({
    email: 'penjualan@uji.id', nama: 'Staf Penjualan', passwordHash: 'x',
  }).returning()
  penggunaId = pengguna.id

  const dibuatUrutan = await db.insert(sequences).values([
    { kode: 'jurnal:JPS', prefix: 'JPS', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'jurnal:PNJ', prefix: 'FJ', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'jurnal:BNK', prefix: 'BB', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'gudang:penerimaan', prefix: 'GRN', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'gudang:pengiriman', prefix: 'DO', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'penjualan:pesanan', prefix: 'SO', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'penjualan:faktur', prefix: 'FJ', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'penjualan:nota-kredit', prefix: 'NK', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'penjualan:pembayaran', prefix: 'BKM', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
  ]).returning()
  const urutanLewatKode = new Map(dibuatUrutan.map((u) => [u.kode, u.id]))

  await db.insert(journals).values([
    { kode: 'JPS', nama: 'Jurnal Penyesuaian Persediaan', tipe: 'umum', sequenceId: urutanLewatKode.get('jurnal:JPS')! },
    { kode: 'PNJ', nama: 'Jurnal Penjualan', tipe: 'penjualan', sequenceId: urutanLewatKode.get('jurnal:PNJ')! },
    { kode: 'BNK', nama: 'Jurnal Bank', tipe: 'bank', sequenceId: urutanLewatKode.get('jurnal:BNK')! },
  ])
  await seedPemetaanJurnal()

  const [satuan] = await db.insert(uoms).values({
    kode: 'UNIT', nama: 'Unit', kategori: 'satuan', faktor: '1',
  }).returning()
  satuanUnitId = satuan.id

  const [kategori] = await db.insert(productCategories).values({
    kode: 'BJ', nama: 'Barang Jadi',
    akunPersediaanId: akun['1134'], akunHppId: akun['5104'],
    akunSelisihId: akun['5105'], akunBarangRusakId: akun['5106'],
  }).returning()

  const [produk] = await db.insert(products).values({
    kode: 'BJ-KURSI', nama: 'Kursi Makan Jati', kategoriId: kategori.id, uomId: satuan.id,
    hargaJual: '1850000',
  }).returning()
  produkKursiId = produk.id

  const [gudang] = await db.insert(warehouses).values({ kode: 'GU', nama: 'Gudang Utama' }).returning()
  const dibuatLokasi = await db.insert(locations).values([
    { kode: 'GU/BJ', nama: 'Gudang Barang Jadi', tipe: 'internal', warehouseId: gudang.id },
    { kode: 'VIR/PEMASOK', nama: 'Pemasok', tipe: 'pemasok' },
    { kode: 'VIR/PELANGGAN', nama: 'Pelanggan', tipe: 'pelanggan' },
  ]).returning()
  lokasiGudangId = dibuatLokasi[0].id
  lokasiPemasokId = dibuatLokasi[1].id

  const [pelanggan] = await db.insert(partners).values({
    kode: 'CUST-001', nama: 'PT Mebel Sejahtera', isPelanggan: true,
  }).returning()
  pelangganId = pelanggan.id

  const dibuatPajak = await db.insert(taxes).values([
    {
      kode: 'PPN-K-11', nama: 'PPN Keluaran 11%', ruangLingkup: 'penjualan',
      tarif: '11', hargaTermasukPajak: false, isPemotongan: false, akunPajakId: akun['2111'],
    },
    {
      kode: 'PPH23-DIPOTONG', nama: 'PPh 23 Dipotong Pelanggan 2%', ruangLingkup: 'penjualan',
      tarif: '2', hargaTermasukPajak: false, isPemotongan: true, akunPajakId: akun['1142'],
    },
  ]).returning()
  pajakPpnId = dibuatPajak[0].id
  pajakPphId = dibuatPajak[1].id

  // Stok awal 50 kursi @ 1.000.000 agar pengiriman punya barang.
  const masuk = await buatOperasi({
    tipe: 'penerimaan', tanggal: '2026-05-01',
    lokasiAsalId: lokasiPemasokId, lokasiTujuanId: lokasiGudangId,
    partnerId: null, referensi: null, catatan: 'Stok awal',
    baris: [{
      produkId: produkKursiId, kuantitas: '50', uomId: satuanUnitId,
      hargaSatuan: '1000000', catatan: null,
    }],
  }, penggunaId)
  await selesaikanOperasi(masuk.id, penggunaId)
})

afterAll(async () => { await tutupKoneksi() })

// ── Pembantu ─────────────────────────────────────────────────────────────────

function pesananDasar(ubah: Record<string, unknown> = {}) {
  return {
    partnerId: pelangganId,
    tanggal: '2026-06-01',
    tanggalPengiriman: '2026-06-10',
    lokasiAsalId: lokasiGudangId,
    syaratPembayaranId: null,
    mataUangId: 'IDR',
    referensi: null, catatan: null,
    baris: [{
      produkId: produkKursiId, deskripsi: 'Kursi Makan Jati',
      kuantitas: '20', uomId: satuanUnitId, hargaSatuan: '1850000', taxId: pajakPpnId,
    }],
    ...ubah,
  }
}

async function saldo(kodeAkun: string): Promise<number> {
  const item = await db.select().from(journalItems)
    .where(eq(journalItems.accountId, akun[kodeAkun]))
  return item.reduce((t, b) => t + Number(b.debit) - Number(b.kredit), 0)
}

async function siapkanPesananTerkirim() {
  const so = await buatPesanan(pesananDasar(), penggunaId)
  await konfirmasiPesanan(so.id, penggunaId)
  await kirimDariPesanan({
    soId: so.id, tanggal: '2026-06-10',
    baris: [{ soLineId: so.baris[0].id, kuantitas: '20' }],
  }, penggunaId)
  return so
}

function fakturDariSo(so: Awaited<ReturnType<typeof buatPesanan>>, ubah: Record<string, unknown> = {}) {
  return {
    tipe: 'faktur' as const,
    partnerId: pelangganId,
    soId: so.id,
    tanggal: '2026-06-12',
    tanggalJatuhTempo: '2026-07-12',
    referensi: null,
    mataUangId: 'IDR',
    catatan: null,
    baris: [{
      produkId: produkKursiId, soLineId: so.baris[0].id,
      deskripsi: 'Kursi Makan Jati', kuantitas: '20',
      uomId: satuanUnitId, hargaSatuan: '1850000',
      taxId: pajakPpnId, akunId: akun['4101'],
    }],
    ...ubah,
  }
}

// ── Penawaran dan pesanan ────────────────────────────────────────────────────

describe('penawaran penjualan', () => {
  it('menyimpan penawaran tanpa nomor', async () => {
    const so = await buatPesanan(pesananDasar(), penggunaId)
    expect(so.status).toBe('penawaran')
    expect(so.nomor).toBeNull()
  })

  it('menolak gudang asal yang bukan lokasi internal', async () => {
    await expect(buatPesanan(pesananDasar({ lokasiAsalId: lokasiPemasokId }), penggunaId))
      .rejects.toThrow('harus lokasi internal')
  })

  it('menghitung total berikut PPN Keluaran', async () => {
    const so = await buatPesanan(pesananDasar(), penggunaId)
    const total = await totalPesanan(so.id)
    expect(total.totalDpp).toBe('37000000.00')
    expect(total.totalPpn).toBe('4070000.00')
    expect(total.totalTagihan).toBe('41070000.00')
  })

  it('memberi nomor saat dikonfirmasi', async () => {
    const so = await buatPesanan(pesananDasar(), penggunaId)
    expect((await konfirmasiPesanan(so.id, penggunaId)).nomor).toBe('SO/2026/06/0001')
  })

  it('menolak penghapusan pesanan yang sudah dikonfirmasi', async () => {
    const so = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(so.id, penggunaId)
    await expect(hapusPenawaran(so.id)).rejects.toThrow('sudah menjadi komitmen')
  })
})

// ── Pengiriman ───────────────────────────────────────────────────────────────

describe('pengiriman atas pesanan', () => {
  it('menolak pengiriman atas pesanan yang belum dikonfirmasi', async () => {
    const so = await buatPesanan(pesananDasar(), penggunaId)
    await expect(kirimDariPesanan({
      soId: so.id, tanggal: '2026-06-10',
      baris: [{ soLineId: so.baris[0].id, kuantitas: '20' }],
    }, penggunaId)).rejects.toThrow('sudah dikonfirmasi')
  })

  it('mengurangi stok dan membebankan harga pokok, bukan harga jual', async () => {
    const so = await siapkanPesananTerkirim()
    const riwayat = await pengirimanPesanan(so.id)
    expect(riwayat).toHaveLength(1)
    expect(riwayat[0].nomor).toBe('DO/2026/06/0001')

    // 20 unit dikeluarkan pada harga pokok 1.000.000, bukan harga jual.
    expect(await saldo('5104')).toBe(20_000_000)
    expect(await saldo('1134')).toBe(30_000_000)
  })

  it('tidak mencatat pendapatan saat pengiriman', async () => {
    await siapkanPesananTerkirim()
    expect(await saldo('4101')).toBe(0)
    expect(await saldo('1121')).toBe(0)
  })

  it('menolak pengiriman melebihi sisa pesanan', async () => {
    const so = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(so.id, penggunaId)
    await expect(kirimDariPesanan({
      soId: so.id, tanggal: '2026-06-10',
      baris: [{ soLineId: so.baris[0].id, kuantitas: '30' }],
    }, penggunaId)).rejects.toThrow('melebihi sisa pesanan')
  })

  it('menolak pengiriman melebihi stok tersedia', async () => {
    const so = await buatPesanan(pesananDasar({
      baris: [{
        produkId: produkKursiId, deskripsi: 'Kursi', kuantitas: '80',
        uomId: satuanUnitId, hargaSatuan: '1850000', taxId: null,
      }],
    }), penggunaId)
    await konfirmasiPesanan(so.id, penggunaId)
    await expect(kirimDariPesanan({
      soId: so.id, tanggal: '2026-06-10',
      baris: [{ soLineId: so.baris[0].id, kuantitas: '80' }],
    }, penggunaId)).rejects.toThrow('tidak mencukupi')
  })

  it('mendukung pengiriman bertahap', async () => {
    const so = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(so.id, penggunaId)

    await kirimDariPesanan({
      soId: so.id, tanggal: '2026-06-10',
      baris: [{ soLineId: so.baris[0].id, kuantitas: '12' }],
    }, penggunaId)

    const sisa = await barisDenganSisa(so.id)
    expect(Number(sisa[0].kuantitasDikirim)).toBe(12)
    expect(Number(sisa[0].sisaDikirim)).toBe(8)
    // Yang boleh difakturkan hanya yang sudah dikirim.
    expect(Number(sisa[0].sisaDifakturkan)).toBe(12)
  })

  it('menolak pembatalan pesanan yang sudah mengirim barang', async () => {
    const so = await siapkanPesananTerkirim()
    await expect(batalkanPesanan(so.id)).rejects.toThrow('sudah memiliki pengiriman')
  })
})

// ── Faktur ───────────────────────────────────────────────────────────────────

describe('faktur penjualan', () => {
  it('mencatat piutang, pendapatan, dan PPN Keluaran', async () => {
    const so = await siapkanPesananTerkirim()
    const faktur = await buatFaktur(fakturDariSo(so), penggunaId)
    const diposting = await postingFaktur(faktur.id, penggunaId)

    expect(diposting.nomor).toBe('FJ/2026/06/0001')
    expect(await saldo('1121')).toBe(41_070_000)
    expect(await saldo('4101')).toBe(-37_000_000)
    expect(await saldo('2111')).toBe(-4_070_000)
  })

  it('memberi nomor saat diposting dan mengunci isinya', async () => {
    const so = await siapkanPesananTerkirim()
    const faktur = await buatFaktur(fakturDariSo(so), penggunaId)
    expect(faktur.nomor).toBeNull()
    await postingFaktur(faktur.id, penggunaId)
    await expect(postingFaktur(faktur.id, penggunaId)).rejects.toThrow('sudah diposting')
  })

  it('memperbarui kuantitas difakturkan dan menandai pesanan selesai', async () => {
    const so = await siapkanPesananTerkirim()
    const faktur = await buatFaktur(fakturDariSo(so), penggunaId)
    await postingFaktur(faktur.id, penggunaId)

    const [baris] = await db.select().from(salesOrderLines).where(eq(salesOrderLines.soId, so.id))
    expect(Number(baris.kuantitasDifakturkan)).toBe(20)
    expect((await ambilPesanan(so.id))!.status).toBe('selesai')
  })

  it('memperlakukan PPh yang dipotong pelanggan sebagai pengurang piutang', async () => {
    const so = await siapkanPesananTerkirim()
    const faktur = await buatFaktur(fakturDariSo(so, {
      baris: [{
        produkId: produkKursiId, soLineId: so.baris[0].id,
        deskripsi: 'Jasa pemasangan', kuantitas: '1',
        uomId: satuanUnitId, hargaSatuan: '10000000',
        taxId: pajakPphId, akunId: akun['4101'],
      }],
    }), penggunaId)
    await postingFaktur(faktur.id, penggunaId)

    expect(await saldo('4101')).toBe(-10_000_000)
    // PPh menjadi kredit pajak, bukan beban.
    expect(await saldo('1142')).toBe(200_000)
    expect(await saldo('1121')).toBe(9_800_000)
  })

  it('membalik seluruh arah pada nota kredit', async () => {
    const so = await siapkanPesananTerkirim()
    const faktur = await buatFaktur(fakturDariSo(so), penggunaId)
    await postingFaktur(faktur.id, penggunaId)

    const nota = await buatFaktur(fakturDariSo(so, {
      tipe: 'nota_kredit', tanggal: '2026-06-20',
      baris: [{
        produkId: produkKursiId, soLineId: so.baris[0].id,
        deskripsi: 'Retur kursi cacat', kuantitas: '2',
        uomId: satuanUnitId, hargaSatuan: '1850000',
        taxId: pajakPpnId, akunId: akun['4101'],
      }],
    }), penggunaId)
    const diposting = await postingFaktur(nota.id, penggunaId)

    expect(diposting.nomor).toBe('NK/2026/06/0001')
    // Piutang berkurang 2 × 1.850.000 × 1,11 = 4.107.000.
    expect(await saldo('1121')).toBeCloseTo(36_963_000, 2)
  })

  it('menghasilkan jurnal yang seimbang', async () => {
    const so = await siapkanPesananTerkirim()
    const faktur = await buatFaktur(fakturDariSo(so), penggunaId)
    const diposting = await postingFaktur(faktur.id, penggunaId)

    const item = await db.select().from(journalItems)
      .where(eq(journalItems.entryId, diposting.jurnalEntryId!))
    const debit = item.reduce((t, b) => t + Number(b.debit), 0)
    const kredit = item.reduce((t, b) => t + Number(b.kredit), 0)
    expect(debit).toBeCloseTo(kredit, 2)
  })
})

// ── Penerimaan pembayaran ────────────────────────────────────────────────────

describe('penerimaan dari pelanggan', () => {
  async function siapkanFakturTerposting() {
    const so = await siapkanPesananTerkirim()
    const faktur = await buatFaktur(fakturDariSo(so), penggunaId)
    return postingFaktur(faktur.id, penggunaId)
  }

  it('menampilkan sisa faktur sebelum dilunasi', async () => {
    const faktur = await siapkanFakturTerposting()
    const ringkasan = await ringkasanFaktur(faktur.id)
    expect(ringkasan!.totalTagihan).toBe('41070000.00')
    expect(ringkasan!.sisa).toBe('41070000.00')
  })

  it('melunasi penuh dan mengosongkan piutang', async () => {
    const faktur = await siapkanFakturTerposting()
    const bayar = await buatPembayaran({
      partnerId: pelangganId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '41070000',
      referensi: 'TRF-9911', catatan: null,
      alokasi: [{ invoiceId: faktur.id, jumlah: '41070000' }],
    }, penggunaId)
    const diposting = await postingPembayaran(bayar.id, penggunaId)

    expect(diposting.nomor).toBe('BKM/2026/07/0001')
    expect(await saldo('1121')).toBe(0)
    expect(await saldo('1111')).toBe(41_070_000)
    expect((await ringkasanFaktur(faktur.id))!.sisa).toBe('0.00')
  })

  it('mendukung penerimaan sebagian', async () => {
    const faktur = await siapkanFakturTerposting()
    const bayar = await buatPembayaran({
      partnerId: pelangganId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '15000000',
      referensi: null, catatan: null,
      alokasi: [{ invoiceId: faktur.id, jumlah: '15000000' }],
    }, penggunaId)
    await postingPembayaran(bayar.id, penggunaId)

    const ringkasan = await ringkasanFaktur(faktur.id)
    expect(ringkasan!.terbayar).toBe('15000000.00')
    expect(ringkasan!.sisa).toBe('26070000.00')
    expect(await fakturBelumLunas(pelangganId)).toHaveLength(1)
  })

  it('menolak alokasi melebihi sisa faktur', async () => {
    const faktur = await siapkanFakturTerposting()
    await expect(buatPembayaran({
      partnerId: pelangganId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '50000000',
      referensi: null, catatan: null,
      alokasi: [{ invoiceId: faktur.id, jumlah: '50000000' }],
    }, penggunaId)).rejects.toThrow('melebihi sisanya')
  })

  it('mencatat kelebihan penerimaan sebagai uang muka penjualan', async () => {
    const faktur = await siapkanFakturTerposting()
    const bayar = await buatPembayaran({
      partnerId: pelangganId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '45000000',
      referensi: null, catatan: null,
      alokasi: [{ invoiceId: faktur.id, jumlah: '41070000' }],
    }, penggunaId)
    await postingPembayaran(bayar.id, penggunaId)

    expect(await saldo('2131')).toBe(-3_930_000)
    expect(await saldo('1111')).toBe(45_000_000)
  })
})

// ── Rekonsiliasi ─────────────────────────────────────────────────────────────

describe('rekonsiliasi item jurnal', () => {
  async function siapkanFakturTerposting() {
    const so = await siapkanPesananTerkirim()
    const faktur = await buatFaktur(fakturDariSo(so), penggunaId)
    return postingFaktur(faktur.id, penggunaId)
  }

  it('menampilkan item piutang yang belum ditutup', async () => {
    await siapkanFakturTerposting()
    const terbuka = await itemTerbuka({ akunId: akun['1121'] })
    expect(terbuka).toHaveLength(1)
    expect(terbuka[0].debit).toBe('41070000.00')
  })

  it('menutup otomatis saat faktur dilunasi penuh', async () => {
    const faktur = await siapkanFakturTerposting()
    const bayar = await buatPembayaran({
      partnerId: pelangganId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '41070000',
      referensi: null, catatan: null,
      alokasi: [{ invoiceId: faktur.id, jumlah: '41070000' }],
    }, penggunaId)
    await postingPembayaran(bayar.id, penggunaId)

    expect(await itemTerbuka({ akunId: akun['1121'] })).toHaveLength(0)
    const kelompok = await daftarRekonsiliasi()
    expect(kelompok).toHaveLength(1)
    expect(kelompok[0].asal).toBe('otomatis')
    expect(kelompok[0].jumlahItem).toBe(2)
  })

  it('membiarkan item terbuka saat pelunasan baru sebagian', async () => {
    const faktur = await siapkanFakturTerposting()
    const bayar = await buatPembayaran({
      partnerId: pelangganId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '15000000',
      referensi: null, catatan: null,
      alokasi: [{ invoiceId: faktur.id, jumlah: '15000000' }],
    }, penggunaId)
    await postingPembayaran(bayar.id, penggunaId)

    // Dua item masih terbuka: piutang faktur dan pelunasan sebagiannya.
    expect(await itemTerbuka({ akunId: akun['1121'] })).toHaveLength(2)
    expect(await daftarRekonsiliasi()).toHaveLength(0)
  })

  it('menolak rekonsiliasi yang tidak seimbang', async () => {
    const faktur = await siapkanFakturTerposting()
    const bayar = await buatPembayaran({
      partnerId: pelangganId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '15000000',
      referensi: null, catatan: null,
      alokasi: [{ invoiceId: faktur.id, jumlah: '15000000' }],
    }, penggunaId)
    await postingPembayaran(bayar.id, penggunaId)

    const terbuka = await itemTerbuka({ akunId: akun['1121'] })
    await expect(rekonsiliasi(terbuka.map((t) => t.itemId), '2026-07-01', penggunaId))
      .rejects.toThrow('tidak seimbang')
  })

  it('menolak rekonsiliasi lintas akun', async () => {
    await siapkanFakturTerposting()
    const semua = await db.select().from(journalItems)
    const piutang = semua.find((b) => b.accountId === akun['1121'])!
    const pendapatan = semua.find((b) => b.accountId === akun['4101'])!
    await expect(
      rekonsiliasi([piutang.id, pendapatan.id], '2026-07-01', penggunaId),
    ).rejects.toThrow('akun yang sama')
  })

  it('menolak rekonsiliasi dengan kurang dari dua item', async () => {
    await siapkanFakturTerposting()
    const terbuka = await itemTerbuka({ akunId: akun['1121'] })
    await expect(rekonsiliasi([terbuka[0].itemId], '2026-07-01', penggunaId))
      .rejects.toThrow('minimal dua item')
  })

  it('mengembalikan item ke keadaan terbuka saat rekonsiliasi dibatalkan', async () => {
    const faktur = await siapkanFakturTerposting()
    const bayar = await buatPembayaran({
      partnerId: pelangganId, tanggal: '2026-07-01',
      akunKasId: akun['1111'], jumlah: '41070000',
      referensi: null, catatan: null,
      alokasi: [{ invoiceId: faktur.id, jumlah: '41070000' }],
    }, penggunaId)
    await postingPembayaran(bayar.id, penggunaId)

    const [kelompok] = await daftarRekonsiliasi()
    await batalkanRekonsiliasi(kelompok.id)

    expect(await itemTerbuka({ akunId: akun['1121'] })).toHaveLength(2)
    expect(await daftarRekonsiliasi()).toHaveLength(0)
  })
})

// ── Sifat yang harus selalu terpenuhi ────────────────────────────────────────

describe('penjualan — buku besar seimbang di sepanjang alur', () => {
  it('laba kotor benar dan seluruh jurnal seimbang dari penawaran sampai lunas', async () => {
    const so = await buatPesanan(pesananDasar(), penggunaId)
    await konfirmasiPesanan(so.id, penggunaId)

    await kirimDariPesanan({
      soId: so.id, tanggal: '2026-06-08',
      baris: [{ soLineId: so.baris[0].id, kuantitas: '12' }],
    }, penggunaId)
    await kirimDariPesanan({
      soId: so.id, tanggal: '2026-06-15',
      baris: [{ soLineId: so.baris[0].id, kuantitas: '8' }],
    }, penggunaId)

    const faktur = await buatFaktur(fakturDariSo(so, { tanggal: '2026-06-20' }), penggunaId)
    await postingFaktur(faktur.id, penggunaId)

    const bayar = await buatPembayaran({
      partnerId: pelangganId, tanggal: '2026-07-05',
      akunKasId: akun['1111'], jumlah: '41070000',
      referensi: null, catatan: null,
      alokasi: [{ invoiceId: faktur.id, jumlah: '41070000' }],
    }, penggunaId)
    await postingPembayaran(bayar.id, penggunaId)

    // Pendapatan 37 juta lawan harga pokok 20 juta.
    expect(await saldo('4101')).toBe(-37_000_000)
    expect(await saldo('5104')).toBe(20_000_000)
    expect(await saldo('1121')).toBe(0)
    expect(await saldo('1111')).toBe(41_070_000)
    expect(await saldo('2111')).toBe(-4_070_000)
    // Persediaan awal 50 juta dikurangi 20 juta yang terjual.
    expect(await saldo('1134')).toBe(30_000_000)

    for (const e of await db.select().from(journalEntries)) {
      const item = await db.select().from(journalItems).where(eq(journalItems.entryId, e.id))
      const debit = item.reduce((t, b) => t + Number(b.debit), 0)
      const kredit = item.reduce((t, b) => t + Number(b.kredit), 0)
      expect(debit, `entri ${e.nomor} tidak seimbang`).toBeCloseTo(kredit, 2)
    }

    const semua = await db.select().from(journalItems)
    expect(semua.reduce((t, b) => t + Number(b.debit), 0))
      .toBeCloseTo(semua.reduce((t, b) => t + Number(b.kredit), 0), 2)

    // Stok berkurang tepat sebanyak yang dikirim.
    const gerak = await db.select().from(stockMoves)
    expect(gerak).toHaveLength(3)
  })
})
