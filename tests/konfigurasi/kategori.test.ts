import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/klien'
import { accounts, uoms, products } from '@/db/schema'
import {
  buatKategoriProduk, ubahKategoriProduk, ubahStatusKategoriProduk, daftarKategoriProduk,
} from '@/modules/gudang/layanan/kategori'
import {
  buatKategoriAset, ubahKategoriAset, ubahStatusKategoriAset, daftarKategoriAset,
} from '@/modules/aset/layanan/kategori'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const TABEL = [
  'fixed_assets', 'asset_categories',
  'products', 'product_categories', 'uoms',
  'journal_items', 'journal_entries', 'journal_mappings', 'journals', 'sequences',
  'company_settings', 'accounts',
  'audit_logs', 'user_roles', 'users',
]

const akun: Record<string, string> = {}

beforeEach(async () => {
  await bersihkanTabel(TABEL)
  const dibuat = await db.insert(accounts).values([
    { kode: '1131', nama: 'Persediaan Bahan Baku', tipeAkun: 'aset_persediaan' },
    { kode: '1205', nama: 'Kendaraan', tipeAkun: 'aset_tetap' },
    { kode: '1214', nama: 'Akumulasi Depresiasi Kendaraan', tipeAkun: 'aset_akumulasi_depresiasi' },
    { kode: '5101', nama: 'HPP Bahan Baku', tipeAkun: 'beban_hpp' },
    { kode: '5105', nama: 'Selisih Persediaan', tipeAkun: 'beban_hpp' },
    { kode: '5106', nama: 'Kerugian Barang Rusak', tipeAkun: 'beban_hpp' },
    { kode: '6154', nama: 'Beban Depresiasi Kendaraan', tipeAkun: 'beban_depresiasi' },
    { kode: '4101', nama: 'Penjualan', tipeAkun: 'pendapatan' },
  ]).returning()
  for (const a of dibuat) akun[a.kode] = a.id
})

afterAll(async () => { await tutupKoneksi() })

function isiKategoriProduk(ubah: Record<string, unknown> = {}) {
  return {
    kode: 'BB', nama: 'Bahan Baku',
    akunPersediaanId: akun['1131'], akunHppId: akun['5101'],
    akunSelisihId: akun['5105'], akunBarangRusakId: akun['5106'],
    ...ubah,
  }
}

describe('kategori produk', () => {
  it('membuat kategori dan menampilkannya di daftar', async () => {
    const k = await buatKategoriProduk(isiKategoriProduk())
    expect(k.kode).toBe('BB')
    expect(await daftarKategoriProduk()).toHaveLength(1)
  })

  it('menolak kode yang sudah dipakai', async () => {
    await buatKategoriProduk(isiKategoriProduk())
    await expect(buatKategoriProduk(isiKategoriProduk({ nama: 'Lain' })))
      .rejects.toThrow(/sudah dipakai/)
  })

  it('menolak akun persediaan yang bukan bertipe persediaan', async () => {
    // Salah pilih akun baru ketahuan berbulan-bulan kemudian lewat laporan
    // yang ganjil kalau tidak ditolak di sini.
    await expect(buatKategoriProduk(isiKategoriProduk({ akunPersediaanId: akun['4101'] })))
      .rejects.toThrow(/Akun persediaan harus berupa akun bertipe yang sesuai/)
  })

  it('menolak akun harga pokok yang bukan beban HPP', async () => {
    await expect(buatKategoriProduk(isiKategoriProduk({ akunHppId: akun['1131'] })))
      .rejects.toThrow(/Akun harga pokok harus berupa akun bertipe yang sesuai/)
  })

  it('mengubah kategori memakai kode yang sama tetap boleh', async () => {
    const k = await buatKategoriProduk(isiKategoriProduk())
    const diubah = await ubahKategoriProduk(k.id, isiKategoriProduk({ nama: 'Bahan Baku Utama' }))
    expect(diubah.nama).toBe('Bahan Baku Utama')
  })

  it('kategori yang masih dipakai produk aktif tidak dapat dinonaktifkan', async () => {
    const k = await buatKategoriProduk(isiKategoriProduk())
    const [satuan] = await db.insert(uoms).values({
      kode: 'UNIT', nama: 'Unit', kategori: 'satuan', faktor: '1',
    }).returning()
    await db.insert(products).values({
      kode: 'P-01', nama: 'Produk', kategoriId: k.id, uomId: satuan.id,
    })

    await expect(ubahStatusKategoriProduk(k.id, false))
      .rejects.toThrow(/masih dipakai produk aktif/)
  })

  it('kategori tanpa produk aktif dapat dinonaktifkan, bukan dihapus', async () => {
    const k = await buatKategoriProduk(isiKategoriProduk())
    await ubahStatusKategoriProduk(k.id, false)

    const [setelah] = await daftarKategoriProduk()
    expect(setelah.isActive).toBe(false)
  })
})

function isiKategoriAset(ubah: Record<string, unknown> = {}) {
  return {
    kode: 'KND', nama: 'Kendaraan',
    akunAsetId: akun['1205'], akunAkumulasiId: akun['1214'], akunBebanId: akun['6154'],
    dapatDidepresiasi: true, metodeBawaan: 'garis_lurus' as const,
    masaManfaatBulanBawaan: 96,
    ...ubah,
  }
}

describe('kategori aset', () => {
  it('membuat kategori yang disusutkan', async () => {
    const k = await buatKategoriAset(isiKategoriAset())
    expect(k.dapatDidepresiasi).toBe(true)
    expect(await daftarKategoriAset()).toHaveLength(1)
  })

  it('kategori yang tidak disusutkan boleh tanpa akun akumulasi dan beban', async () => {
    const k = await buatKategoriAset(isiKategoriAset({
      kode: 'TNH', nama: 'Tanah', dapatDidepresiasi: false,
      akunAkumulasiId: null, akunBebanId: null,
    }))
    expect(k.akunAkumulasiId).toBeNull()
  })

  it('kategori yang disusutkan wajib punya kedua akun lawannya', async () => {
    await expect(buatKategoriAset(isiKategoriAset({ akunAkumulasiId: null })))
      .rejects.toThrow(/wajib punya akun akumulasi dan akun beban/)
  })

  it('menolak akun akumulasi yang bertipe keliru', async () => {
    await expect(buatKategoriAset(isiKategoriAset({ akunAkumulasiId: akun['1205'] })))
      .rejects.toThrow(/Akun akumulasi depresiasi harus berupa akun bertipe yang sesuai/)
  })

  it('menolak masa manfaat nol', async () => {
    await expect(buatKategoriAset(isiKategoriAset({ masaManfaatBulanBawaan: 0 })))
      .rejects.toThrow(/minimal satu bulan/)
  })

  it('kategori yang masih dipakai aset belum dapat dinonaktifkan', async () => {
    const k = await buatKategoriAset(isiKategoriAset())
    const { buatAset } = await import('@/modules/aset/layanan/aset')
    await buatAset({
      kode: 'AST-1', nama: 'Mobil', kategoriId: k.id,
      tanggalPerolehan: '2026-01-01', tanggalMulaiDepresiasi: '2026-01-01',
      nilaiPerolehan: '100000000', nilaiResidu: '0', masaManfaatBulan: 48,
      metode: 'garis_lurus', partnerId: null, referensi: null, catatan: null,
    }, null as unknown as string)

    await expect(ubahStatusKategoriAset(k.id, false))
      .rejects.toThrow(/masih dipakai aset yang belum dilepas/)
  })

  it('mengubah kategori berlaku untuk aset berikutnya', async () => {
    const k = await buatKategoriAset(isiKategoriAset())
    const diubah = await ubahKategoriAset(k.id, isiKategoriAset({ masaManfaatBulanBawaan: 60 }))
    expect(diubah.masaManfaatBulanBawaan).toBe(60)
  })
})
