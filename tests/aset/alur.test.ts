import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  users, accounts, journals, sequences, companySettings, currencies,
  journalEntries, journalItems, assetCategories, depreciationLines,
} from '@/db/schema'
import {
  buatAset, ubahAset, jalankanAset, hapusAset, lepaskanAset,
  ambilAset, ringkasanAset, daftarAset,
} from '@/modules/aset/layanan/aset'
import {
  postingBaris, postingDepresiasiSampai, daftarJadwal,
} from '@/modules/aset/layanan/depresiasi'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const TABEL = [
  'depreciation_lines', 'fixed_assets', 'asset_categories',
  'journal_items', 'journal_entries', 'journals', 'sequences',
  'company_settings', 'accounts', 'currency_rates', 'currencies',
  'audit_logs', 'user_roles', 'users', 'partners', 'payment_terms', 'taxes',
]

let penggunaId: string
const akun: Record<string, string> = {}
let kategoriKendaraan: string
let kategoriTanah: string

beforeEach(async () => {
  await bersihkanTabel(TABEL)

  await db.insert(currencies).values({ kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 })

  const dibuatAkun = await db.insert(accounts).values([
    { kode: '1101', nama: 'Kas', tipeAkun: 'aset_kas' },
    { kode: '1201', nama: 'Tanah', tipeAkun: 'aset_tetap' },
    { kode: '1205', nama: 'Kendaraan', tipeAkun: 'aset_tetap' },
    { kode: '1214', nama: 'Akumulasi Depresiasi Kendaraan', tipeAkun: 'aset_akumulasi_depresiasi' },
    { kode: '4203', nama: 'Pendapatan Lain-lain', tipeAkun: 'pendapatan_lain' },
    { kode: '6154', nama: 'Beban Depresiasi Kendaraan', tipeAkun: 'beban_depresiasi' },
    { kode: '7103', nama: 'Beban Lain-lain', tipeAkun: 'beban_lain' },
  ]).returning()
  for (const a of dibuatAkun) akun[a.kode] = a.id

  await db.insert(companySettings).values({ nama: 'PT Uji' })

  const [pengguna] = await db.insert(users).values({
    email: 'aset@uji.id', nama: 'Staf Akuntansi', passwordHash: 'x',
  }).returning()
  penggunaId = pengguna.id

  const [urutanJu] = await db.insert(sequences).values({
    kode: 'jurnal:JU', prefix: 'JU', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan',
  }).returning()
  await db.insert(journals).values({
    kode: 'JU', nama: 'Jurnal Umum', tipe: 'umum', sequenceId: urutanJu.id,
  })

  const dibuatKategori = await db.insert(assetCategories).values([
    {
      kode: 'KND', nama: 'Kendaraan',
      akunAsetId: akun['1205'], akunAkumulasiId: akun['1214'], akunBebanId: akun['6154'],
      dapatDidepresiasi: true, metodeBawaan: 'garis_lurus', masaManfaatBulanBawaan: 48,
    },
    {
      kode: 'TNH', nama: 'Tanah',
      akunAsetId: akun['1201'], akunAkumulasiId: null, akunBebanId: null,
      dapatDidepresiasi: false, metodeBawaan: 'garis_lurus', masaManfaatBulanBawaan: 12,
    },
  ]).returning()
  kategoriKendaraan = dibuatKategori[0].id
  kategoriTanah = dibuatKategori[1].id
})

afterAll(async () => { await tutupKoneksi() })

// ── Pembantu ─────────────────────────────────────────────────────────────────

function mobil(ubah: Record<string, unknown> = {}) {
  return {
    kode: 'AST-001',
    nama: 'Mobil Boks Operasional',
    kategoriId: kategoriKendaraan,
    tanggalPerolehan: '2026-01-10',
    tanggalMulaiDepresiasi: '2026-01-10',
    nilaiPerolehan: '240000000',
    nilaiResidu: '0',
    masaManfaatBulan: 48,
    metode: 'garis_lurus' as const,
    partnerId: null,
    referensi: null,
    catatan: null,
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

async function bukuBesarSeimbang(): Promise<boolean> {
  const hasil = await db
    .select({
      debit: sql<string>`COALESCE(SUM(${journalItems.debit}), 0)::text`,
      kredit: sql<string>`COALESCE(SUM(${journalItems.kredit}), 0)::text`,
    })
    .from(journalItems)
    .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
    .where(eq(journalEntries.status, 'diposting'))
  return Number(hasil[0].debit) === Number(hasil[0].kredit)
}

// ── Pendaftaran aset ─────────────────────────────────────────────────────────

describe('pendaftaran aset', () => {
  it('aset baru berstatus draft dan belum punya jadwal', async () => {
    const aset = await buatAset(mobil(), penggunaId)
    expect(aset.status).toBe('draft')
    expect(aset.baris).toHaveLength(0)
  })

  it('mendaftarkan aset tidak menyentuh buku besar', async () => {
    await buatAset(mobil(), penggunaId)
    // Perolehan sudah masuk lewat tagihan pembelian atau saldo awal;
    // mencatatnya lagi akan menghitung aset yang sama dua kali.
    expect(await db.select().from(journalEntries)).toHaveLength(0)
  })

  it('menolak residu yang tidak lebih kecil dari perolehan', async () => {
    await expect(buatAset(mobil({ nilaiResidu: '240000000' }), penggunaId))
      .rejects.toThrow(/residu harus lebih kecil/)
  })

  it('menolak depresiasi yang dimulai sebelum perolehan', async () => {
    await expect(buatAset(mobil({ tanggalMulaiDepresiasi: '2025-12-01' }), penggunaId))
      .rejects.toThrow(/sebelum aset diperoleh/)
  })

  it('menolak masa manfaat nol', async () => {
    await expect(buatAset(mobil({ masaManfaatBulan: 0 }), penggunaId))
      .rejects.toThrow(/minimal satu bulan/)
  })

  it('draft dapat diubah dan dihapus', async () => {
    const aset = await buatAset(mobil(), penggunaId)
    const diubah = await ubahAset(aset.id, mobil({ nama: 'Mobil Boks Cadangan' }))
    expect(diubah.nama).toBe('Mobil Boks Cadangan')
    await hapusAset(aset.id)
    expect(await ambilAset(aset.id)).toBeNull()
  })
})

// ── Menjalankan aset ─────────────────────────────────────────────────────────

describe('menjalankan aset', () => {
  it('menyusun seluruh jadwal sekaligus', async () => {
    const aset = await buatAset(mobil(), penggunaId)
    const berjalan = await jalankanAset(aset.id, penggunaId)

    expect(berjalan.status).toBe('berjalan')
    expect(berjalan.baris).toHaveLength(48)
    expect(Number(berjalan.baris[0].nilai)).toBe(5_000_000)
    expect(berjalan.baris[0].tanggal).toBe('2026-01-31')
    expect(Number(berjalan.baris[47].nilaiBuku)).toBe(0)
    expect(berjalan.baris.every((b) => b.status === 'draft')).toBe(true)
  })

  it('jadwal belum menyentuh buku besar', async () => {
    const aset = await buatAset(mobil(), penggunaId)
    await jalankanAset(aset.id, penggunaId)
    expect(await db.select().from(journalEntries)).toHaveLength(0)
  })

  it('aset yang sudah dijalankan tidak dapat diubah maupun dijalankan lagi', async () => {
    const aset = await buatAset(mobil(), penggunaId)
    await jalankanAset(aset.id, penggunaId)
    await expect(ubahAset(aset.id, mobil())).rejects.toThrow(/tidak dapat diubah/)
    await expect(jalankanAset(aset.id, penggunaId)).rejects.toThrow(/sudah dijalankan/)
    await expect(hapusAset(aset.id)).rejects.toThrow(/berstatus draft/)
  })

  it('kategori yang tidak disusutkan berjalan tanpa jadwal', async () => {
    const tanah = await buatAset(mobil({
      kode: 'AST-TNH', nama: 'Tanah Pabrik', kategoriId: kategoriTanah,
      nilaiPerolehan: '1000000000', masaManfaatBulan: 12,
    }), penggunaId)
    const berjalan = await jalankanAset(tanah.id, penggunaId)

    expect(berjalan.status).toBe('berjalan')
    expect(berjalan.baris).toHaveLength(0)
  })
})

// ── Posting depresiasi ───────────────────────────────────────────────────────

describe('posting depresiasi', () => {
  async function asetBerjalan(ubah: Record<string, unknown> = {}) {
    const aset = await buatAset(mobil(ubah), penggunaId)
    return jalankanAset(aset.id, penggunaId)
  }

  it('mendebit beban dan mengkredit akumulasi', async () => {
    const aset = await asetBerjalan()
    await postingBaris(aset.baris[0].id, penggunaId)

    expect(await saldoAkun('6154')).toBe(5_000_000)
    expect(await saldoAkun('1214')).toBe(-5_000_000)
    expect(await bukuBesarSeimbang()).toBe(true)
  })

  it('baris terposting menyimpan tautan jurnalnya', async () => {
    const aset = await asetBerjalan()
    await postingBaris(aset.baris[0].id, penggunaId)

    const [baris] = await db.select().from(depreciationLines)
      .where(eq(depreciationLines.id, aset.baris[0].id))
    expect(baris.status).toBe('diposting')
    expect(baris.jurnalEntryId).not.toBeNull()
  })

  it('baris yang sama tidak dapat diposting dua kali', async () => {
    const aset = await asetBerjalan()
    await postingBaris(aset.baris[0].id, penggunaId)
    await expect(postingBaris(aset.baris[0].id, penggunaId))
      .rejects.toThrow(/sudah diposting/)
  })

  it('menolak posting yang melompati bulan sebelumnya', async () => {
    const aset = await asetBerjalan()
    await expect(postingBaris(aset.baris[2].id, penggunaId))
      .rejects.toThrow(/harus diposting berurutan/)
  })

  it('nilai buku hanya menghitung baris yang sudah diposting', async () => {
    const aset = await asetBerjalan()
    await postingBaris(aset.baris[0].id, penggunaId)
    await postingBaris(aset.baris[1].id, penggunaId)

    const ringkasan = (await ringkasanAset(aset.id))!
    expect(Number(ringkasan.akumulasi)).toBe(10_000_000)
    expect(Number(ringkasan.nilaiBuku)).toBe(230_000_000)
    expect(ringkasan.sudahDiposting).toBe(2)
    expect(ringkasan.totalBaris).toBe(48)
  })

  it('aset menjadi selesai setelah baris terakhir diposting', async () => {
    const aset = await asetBerjalan({ masaManfaatBulan: 3, nilaiPerolehan: '3000000' })
    for (const b of aset.baris) await postingBaris(b.id, penggunaId)

    const selesai = (await ambilAset(aset.id))!
    expect(selesai.status).toBe('selesai')
    expect(await saldoAkun('1214')).toBe(-3_000_000)
  })
})

// ── Posting berkala ──────────────────────────────────────────────────────────

describe('posting depresiasi berkala', () => {
  it('memposting seluruh aset yang jatuh tempo sekaligus', async () => {
    const a = await jalankanAset((await buatAset(mobil(), penggunaId)).id, penggunaId)
    const b = await jalankanAset((await buatAset(mobil({
      kode: 'AST-002', nama: 'Mobil Boks Kedua', nilaiPerolehan: '120000000',
    }), penggunaId)).id, penggunaId)

    const hasil = await postingDepresiasiSampai('2026-03-31', penggunaId)

    // Tiga bulan untuk dua aset.
    expect(hasil.jumlahBaris).toBe(6)
    expect(hasil.jumlahAset).toBe(2)
    expect(Number(hasil.total)).toBe(3 * 5_000_000 + 3 * 2_500_000)
    expect(Number((await ringkasanAset(a.id))!.akumulasi)).toBe(15_000_000)
    expect(Number((await ringkasanAset(b.id))!.akumulasi)).toBe(7_500_000)
    expect(await bukuBesarSeimbang()).toBe(true)
  })

  it('tidak menyentuh baris yang belum jatuh tempo', async () => {
    const aset = await jalankanAset((await buatAset(mobil(), penggunaId)).id, penggunaId)
    await postingDepresiasiSampai('2026-02-28', penggunaId)

    const jadwal = await daftarJadwal({ status: 'draft' })
    expect(jadwal).toHaveLength(46)
    expect(Number((await ringkasanAset(aset.id))!.akumulasi)).toBe(10_000_000)
  })

  it('menolak bila tidak ada yang jatuh tempo', async () => {
    await jalankanAset((await buatAset(mobil(), penggunaId)).id, penggunaId)
    await expect(postingDepresiasiSampai('2025-12-31', penggunaId))
      .rejects.toThrow(/Tidak ada depresiasi yang jatuh tempo/)
  })

  it('aset draft tidak ikut terposting', async () => {
    await buatAset(mobil(), penggunaId)
    await expect(postingDepresiasiSampai('2026-12-31', penggunaId))
      .rejects.toThrow(/Tidak ada depresiasi yang jatuh tempo/)
  })
})

// ── Pelepasan ────────────────────────────────────────────────────────────────

describe('pelepasan aset', () => {
  async function asetSetelahSetahun() {
    const aset = await jalankanAset((await buatAset(mobil(), penggunaId)).id, penggunaId)
    await postingDepresiasiSampai('2026-12-31', penggunaId)
    return (await ambilAset(aset.id))!
  }

  it('mengeluarkan perolehan dan akumulasi dari neraca', async () => {
    const aset = await asetSetelahSetahun()
    // Dua belas bulan × 5.000.000 = 60.000.000 akumulasi; nilai buku 180.000.000.
    await lepaskanAset(aset.id, {
      tanggal: '2027-01-15', nilaiPelepasan: '180000000',
      akunPenerimaanId: akun['1101'], catatan: null,
    }, penggunaId)

    expect(await saldoAkun('1205')).toBe(-240_000_000)
    expect(await saldoAkun('1214')).toBe(0)
    expect(await saldoAkun('1101')).toBe(180_000_000)
    expect(await bukuBesarSeimbang()).toBe(true)
  })

  it('mencatat laba bila hasil melebihi nilai buku', async () => {
    const aset = await asetSetelahSetahun()
    await lepaskanAset(aset.id, {
      tanggal: '2027-01-15', nilaiPelepasan: '200000000',
      akunPenerimaanId: akun['1101'], catatan: null,
    }, penggunaId)

    expect(await saldoAkun('4203')).toBe(-20_000_000)
    expect(await bukuBesarSeimbang()).toBe(true)
  })

  it('mencatat rugi bila hasil di bawah nilai buku', async () => {
    const aset = await asetSetelahSetahun()
    await lepaskanAset(aset.id, {
      tanggal: '2027-01-15', nilaiPelepasan: '150000000',
      akunPenerimaanId: akun['1101'], catatan: null,
    }, penggunaId)

    expect(await saldoAkun('7103')).toBe(30_000_000)
    expect(await bukuBesarSeimbang()).toBe(true)
  })

  it('pelepasan tanpa hasil membebankan seluruh nilai buku sebagai rugi', async () => {
    const aset = await asetSetelahSetahun()
    await lepaskanAset(aset.id, {
      tanggal: '2027-01-15', nilaiPelepasan: '0', akunPenerimaanId: null, catatan: null,
    }, penggunaId)

    expect(await saldoAkun('7103')).toBe(180_000_000)
    expect(await bukuBesarSeimbang()).toBe(true)
  })

  it('membuang jadwal yang belum diposting dan menyisakan riwayatnya', async () => {
    const aset = await asetSetelahSetahun()
    const dilepas = await lepaskanAset(aset.id, {
      tanggal: '2027-01-15', nilaiPelepasan: '180000000',
      akunPenerimaanId: akun['1101'], catatan: null,
    }, penggunaId)

    expect(dilepas.status).toBe('dilepas')
    expect(dilepas.baris).toHaveLength(12)
    expect(dilepas.baris.every((b) => b.status === 'diposting')).toBe(true)
  })

  it('aset yang dilepas berhenti disusutkan', async () => {
    const aset = await asetSetelahSetahun()
    await lepaskanAset(aset.id, {
      tanggal: '2027-01-15', nilaiPelepasan: '180000000',
      akunPenerimaanId: akun['1101'], catatan: null,
    }, penggunaId)

    await expect(postingDepresiasiSampai('2027-12-31', penggunaId))
      .rejects.toThrow(/Tidak ada depresiasi yang jatuh tempo/)
    await expect(lepaskanAset(aset.id, {
      tanggal: '2027-02-01', nilaiPelepasan: '0', akunPenerimaanId: null, catatan: null,
    }, penggunaId)).rejects.toThrow(/sudah dilepas/)
  })

  it('menolak hasil pelepasan tanpa akun penerimaan', async () => {
    const aset = await asetSetelahSetahun()
    await expect(lepaskanAset(aset.id, {
      tanggal: '2027-01-15', nilaiPelepasan: '1000000',
      akunPenerimaanId: null, catatan: null,
    }, penggunaId)).rejects.toThrow(/Akun penerimaan wajib dipilih/)
  })

  it('menolak pelepasan aset yang masih draft', async () => {
    const aset = await buatAset(mobil(), penggunaId)
    await expect(lepaskanAset(aset.id, {
      tanggal: '2026-06-01', nilaiPelepasan: '0', akunPenerimaanId: null, catatan: null,
    }, penggunaId)).rejects.toThrow(/dihapus saja, tidak dilepas/)
  })
})

// ── Konsistensi register terhadap buku besar ────────────────────────────────

describe('register aset terhadap buku besar', () => {
  it('akumulasi register selalu sama dengan saldo akun akumulasinya', async () => {
    const a = await jalankanAset((await buatAset(mobil(), penggunaId)).id, penggunaId)
    const b = await jalankanAset((await buatAset(mobil({
      kode: 'AST-002', nama: 'Mobil Kedua', nilaiPerolehan: '99999999',
      masaManfaatBulan: 7, nilaiResidu: '1',
    }), penggunaId)).id, penggunaId)

    await postingDepresiasiSampai('2026-07-31', penggunaId)

    const register = [a, b].map(async (x) => Number((await ringkasanAset(x.id))!.akumulasi))
    const totalRegister = (await Promise.all(register)).reduce((t, n) => t + n, 0)

    expect(totalRegister).toBe(-(await saldoAkun('1214')))
    expect(await bukuBesarSeimbang()).toBe(true)
  })

  it('daftar aset menyaring menurut status', async () => {
    await buatAset(mobil(), penggunaId)
    await jalankanAset((await buatAset(mobil({ kode: 'AST-002' }), penggunaId)).id, penggunaId)

    expect(await daftarAset({ status: 'draft' })).toHaveLength(1)
    expect(await daftarAset({ status: 'berjalan' })).toHaveLength(1)
    expect(await daftarAset()).toHaveLength(2)
  })
})
