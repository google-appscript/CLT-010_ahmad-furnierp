import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  accounts, journals, sequences, companySettings, journalMappings,
} from '@/db/schema'
import {
  jurnalUntukDalamTx, jurnalPembayaranDalamTx, akunOtomatisDalamTx,
  daftarPemetaanJurnal, ubahPemetaanJurnal, simpanAkunOtomatis,
  PEMETAAN_JURNAL,
} from '@/modules/akuntansi/layanan/pemetaan'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'
import { seedPemetaanJurnal } from '../bantuan/pemetaan'

const TABEL = [
  'journal_items', 'journal_entries', 'journal_mappings', 'journals', 'sequences',
  'company_settings', 'accounts', 'currency_rates', 'currencies',
  'audit_logs', 'user_roles', 'users', 'partners', 'payment_terms', 'taxes',
]

const akun: Record<string, string> = {}
let jurnalUmumId: string
let jurnalKasId: string

beforeEach(async () => {
  await bersihkanTabel(TABEL)

  const dibuatAkun = await db.insert(accounts).values([
    { kode: '1101', nama: 'Kas', tipeAkun: 'aset_kas' },
    { kode: '1111', nama: 'Bank BCA', tipeAkun: 'aset_bank' },
    { kode: '5102', nama: 'HPP Tenaga Kerja Langsung', tipeAkun: 'beban_hpp' },
  ]).returning()
  for (const a of dibuatAkun) akun[a.kode] = a.id

  await db.insert(companySettings).values({ nama: 'PT Uji' })

  const dibuatUrutan = await db.insert(sequences).values([
    { kode: 'jurnal:JU', prefix: 'JU', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'jurnal:KAS', prefix: 'BK', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'jurnal:BNK', prefix: 'BB', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
  ]).returning()
  const urutan = new Map(dibuatUrutan.map((u) => [u.kode, u.id]))

  const dibuatJurnal = await db.insert(journals).values([
    { kode: 'JU', nama: 'Jurnal Umum', tipe: 'umum', sequenceId: urutan.get('jurnal:JU')! },
    { kode: 'KAS', nama: 'Jurnal Kas', tipe: 'kas', sequenceId: urutan.get('jurnal:KAS')! },
    { kode: 'BNK', nama: 'Jurnal Bank', tipe: 'bank', sequenceId: urutan.get('jurnal:BNK')! },
  ]).returning()
  jurnalUmumId = dibuatJurnal[0].id
  jurnalKasId = dibuatJurnal[1].id

  await seedPemetaanJurnal()
})

afterAll(async () => { await tutupKoneksi() })

describe('pemetaan jurnal', () => {
  it('mengembalikan jurnal yang dipetakan, bukan kode di dalam program', async () => {
    const id = await db.transaction(
      (tx) => jurnalUntukDalamTx(tx, PEMETAAN_JURNAL.DEPRESIASI),
    )
    expect(id).toBe(jurnalUmumId)
  })

  it('memindahkan sebuah jenis posting ke jurnal lain cukup mengubah data', async () => {
    const daftar = await daftarPemetaanJurnal()
    const depresiasi = daftar.find((m) => m.kode === PEMETAAN_JURNAL.DEPRESIASI)!
    await ubahPemetaanJurnal(depresiasi.id, jurnalKasId)

    const id = await db.transaction(
      (tx) => jurnalUntukDalamTx(tx, PEMETAAN_JURNAL.DEPRESIASI),
    )
    expect(id).toBe(jurnalKasId)
  })

  it('menolak pemetaan yang belum diatur dengan pesan yang menuntun', async () => {
    await db.delete(journalMappings)
      .where(eq(journalMappings.kode, PEMETAAN_JURNAL.STOK))

    await expect(
      db.transaction((tx) => jurnalUntukDalamTx(tx, PEMETAAN_JURNAL.STOK)),
    ).rejects.toThrow(/Pemetaan jurnal "gudang:stok" belum diatur/)
  })

  it('menolak jurnal yang sudah dinonaktifkan', async () => {
    await db.update(journals).set({ isActive: false }).where(eq(journals.id, jurnalUmumId))

    await expect(
      db.transaction((tx) => jurnalUntukDalamTx(tx, PEMETAAN_JURNAL.DEPRESIASI)),
    ).rejects.toThrow(/sudah nonaktif, padahal masih dipakai/)
  })

  it('menolak memetakan ke jurnal nonaktif', async () => {
    await db.update(journals).set({ isActive: false }).where(eq(journals.id, jurnalKasId))
    const daftar = await daftarPemetaanJurnal()
    const depresiasi = daftar.find((m) => m.kode === PEMETAAN_JURNAL.DEPRESIASI)!

    await expect(ubahPemetaanJurnal(depresiasi.id, jurnalKasId))
      .rejects.toThrow(/nonaktif dan tidak dapat dipilih/)
  })

  it('memilih jurnal kas atau bank mengikuti tipe akun pembayaran', async () => {
    const lewatKas = await db.transaction(
      (tx) => jurnalPembayaranDalamTx(tx, akun['1101']),
    )
    const lewatBank = await db.transaction(
      (tx) => jurnalPembayaranDalamTx(tx, akun['1111']),
    )

    expect(lewatKas).toBe(jurnalKasId)
    expect(lewatBank).not.toBe(jurnalKasId)
  })
})

describe('akun otomatis', () => {
  it('menolak akun yang belum diatur dengan nama yang dikenal pengguna', async () => {
    await expect(
      db.transaction((tx) => akunOtomatisDalamTx(tx, 'akunTenagaKerjaLangsungId')),
    ).rejects.toThrow(/Akun Tenaga Kerja Langsung belum diatur/)
  })

  it('mengembalikan akun setelah diatur', async () => {
    await simpanAkunOtomatis({ akunTenagaKerjaLangsungId: akun['5102'] })

    const id = await db.transaction(
      (tx) => akunOtomatisDalamTx(tx, 'akunTenagaKerjaLangsungId'),
    )
    expect(id).toBe(akun['5102'])
  })

  it('menolak akun yang tidak terdaftar di bagan akun', async () => {
    await expect(simpanAkunOtomatis({
      akunOverheadPabrikId: '00000000-0000-0000-0000-000000000000',
    })).rejects.toThrow(/Akun untuk Overhead Pabrik tidak ditemukan/)
  })

  it('nilai kosong mengosongkan pengaturannya kembali', async () => {
    await simpanAkunOtomatis({ akunTenagaKerjaLangsungId: akun['5102'] })
    await simpanAkunOtomatis({ akunTenagaKerjaLangsungId: null })

    const [pengaturan] = await db.select().from(companySettings)
    expect(pengaturan.akunTenagaKerjaLangsungId).toBeNull()
  })
})
