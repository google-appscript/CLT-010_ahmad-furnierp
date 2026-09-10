import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/klien'
import {
  users, accounts, journals, sequences, companySettings, currencies,
} from '@/db/schema'
import { buatEntri, postingEntri } from '@/modules/akuntansi/layanan/entri'
import {
  laporanLabaRugi, laporanNeraca, laporanArusKas, laporanNeracaSaldo, itemPerAkun,
} from '@/modules/akuntansi/layanan/laporan'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'
import { seedPemetaanJurnal } from '../bantuan/pemetaan'

const TABEL = [
  'journal_items', 'journal_entries', 'journal_mappings', 'journals', 'sequences',
  'company_settings', 'accounts', 'currency_rates', 'currencies',
  'audit_logs', 'user_roles', 'users', 'partners', 'payment_terms', 'taxes',
]

let penggunaId: string
let jurnalId: string
const akun: Record<string, string> = {}

/** Satu akun per tipe agar setiap baris laporan dapat diuji. */
const DAFTAR_AKUN = [
  { kunci: 'kas', kode: '1101', nama: 'Kas', tipeAkun: 'aset_kas' },
  { kunci: 'bank', kode: '1111', nama: 'Bank', tipeAkun: 'aset_bank' },
  { kunci: 'piutang', kode: '1121', nama: 'Piutang Usaha', tipeAkun: 'aset_piutang' },
  { kunci: 'persediaan', kode: '1131', nama: 'Persediaan', tipeAkun: 'aset_persediaan' },
  { kunci: 'lancarLain', kode: '1141', nama: 'PPN Masukan', tipeAkun: 'aset_lancar_lain' },
  { kunci: 'asetTetap', kode: '1203', nama: 'Mesin', tipeAkun: 'aset_tetap' },
  { kunci: 'akumDep', kode: '1212', nama: 'Akumulasi Depresiasi Mesin', tipeAkun: 'aset_akumulasi_depresiasi' },
  { kunci: 'utangUsaha', kode: '2101', nama: 'Utang Usaha', tipeAkun: 'liabilitas_utang_usaha' },
  { kunci: 'utangPajak', kode: '2111', nama: 'PPN Keluaran', tipeAkun: 'liabilitas_pajak' },
  { kunci: 'utangPanjang', kode: '2201', nama: 'Utang Bank Jangka Panjang', tipeAkun: 'liabilitas_jangka_panjang' },
  { kunci: 'modal', kode: '3101', nama: 'Modal Disetor', tipeAkun: 'ekuitas' },
  { kunci: 'labaDitahan', kode: '3201', nama: 'Laba Ditahan', tipeAkun: 'ekuitas_laba_ditahan' },
  { kunci: 'pendapatan', kode: '4101', nama: 'Penjualan', tipeAkun: 'pendapatan' },
  { kunci: 'pendapatanLain', kode: '4201', nama: 'Pendapatan Bunga', tipeAkun: 'pendapatan_lain' },
  { kunci: 'hpp', kode: '5101', nama: 'HPP', tipeAkun: 'beban_hpp' },
  { kunci: 'bebanOps', kode: '6101', nama: 'Beban Gaji', tipeAkun: 'beban_operasional' },
  { kunci: 'bebanDep', kode: '6152', nama: 'Beban Depresiasi Mesin', tipeAkun: 'beban_depresiasi' },
  { kunci: 'bebanLain', kode: '7101', nama: 'Beban Bunga', tipeAkun: 'beban_lain' },
  { kunci: 'bebanPajak', kode: '8101', nama: 'Beban Pajak Penghasilan', tipeAkun: 'beban_pajak' },
] as const

beforeEach(async () => {
  await bersihkanTabel(TABEL)

  await db.insert(currencies).values({ kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 })
  await db.insert(companySettings).values({ nama: 'PT Uji', bulanAwalTahunBuku: 1 })

  const [pengguna] = await db.insert(users).values({
    email: 'akuntan@uji.id', nama: 'Akuntan', passwordHash: 'x',
  }).returning()
  penggunaId = pengguna.id

  const [urutan] = await db.insert(sequences).values({
    kode: 'jurnal:JU', prefix: 'JU', panjangDigit: 5, nomorBerikut: 1, reset: 'tidak_pernah',
  }).returning()
  const [jurnal] = await db.insert(journals).values({
    kode: 'JU', nama: 'Jurnal Umum', tipe: 'umum', sequenceId: urutan.id,
  }).returning()
  await seedPemetaanJurnal()
  jurnalId = jurnal.id

  const dibuat = await db.insert(accounts).values(
    DAFTAR_AKUN.map((a) => ({ kode: a.kode, nama: a.nama, tipeAkun: a.tipeAkun as never })),
  ).returning()
  DAFTAR_AKUN.forEach((a, i) => { akun[a.kunci] = dibuat[i].id })
})

afterAll(async () => { await tutupKoneksi() })

/** Memposting satu entri dua baris: debit ke akun A, kredit ke akun B. */
async function posting(
  debitKunci: string, kreditKunci: string, nilai: string, tanggal = '2026-06-15',
) {
  const draft = await buatEntri({
    journalId: jurnalId, tanggal, referensi: null, keterangan: 'Uji',
    mataUangId: 'IDR', partnerId: null,
    item: [
      { accountId: akun[debitKunci], partnerId: null, label: 'D', debit: nilai, kredit: '0', nilaiMataUang: null, taxId: null, projectId: null },
      { accountId: akun[kreditKunci], partnerId: null, label: 'K', debit: '0', kredit: nilai, nilaiMataUang: null, taxId: null, projectId: null },
    ],
  }, penggunaId)
  return postingEntri(draft.id, penggunaId)
}

// ── Draft tidak masuk laporan ────────────────────────────────────────────────

describe('hanya entri terposting yang masuk laporan', () => {
  it('mengabaikan entri berstatus draft', async () => {
    await buatEntri({
      journalId: jurnalId, tanggal: '2026-06-15', referensi: null, keterangan: 'Draft',
      mataUangId: 'IDR', partnerId: null,
      item: [
        { accountId: akun.kas, partnerId: null, label: 'D', debit: '5000000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null },
        { accountId: akun.pendapatan, partnerId: null, label: 'K', debit: '0', kredit: '5000000', nilaiMataUang: null, taxId: null, projectId: null },
      ],
    }, penggunaId)

    const lr = await laporanLabaRugi('2026-01-01', '2026-12-31')
    expect(lr.labaBersih).toBe('0.00')
  })

  it('memasukkan entri setelah diposting', async () => {
    await posting('kas', 'pendapatan', '5000000')
    const lr = await laporanLabaRugi('2026-01-01', '2026-12-31')
    expect(lr.labaBersih).toBe('5000000.00')
  })
})

// ── Laba Rugi ────────────────────────────────────────────────────────────────

describe('Laba Rugi', () => {
  beforeEach(async () => {
    await posting('kas', 'pendapatan', '10000000')       // Pendapatan
    await posting('hpp', 'persediaan', '4000000')        // HPP
    await posting('bebanOps', 'kas', '2000000')          // Beban operasional
    await posting('bebanDep', 'akumDep', '500000')       // Depresiasi
    await posting('kas', 'pendapatanLain', '300000')     // Pendapatan lain
    await posting('bebanLain', 'kas', '100000')          // Beban lain
    await posting('bebanPajak', 'utangPajak', '400000')  // Pajak penghasilan
  })

  it('menyusun laporan bertingkat dengan urutan yang benar', async () => {
    const lr = await laporanLabaRugi('2026-01-01', '2026-12-31')
    expect(lr.baris.map((b) => b.label)).toEqual([
      'Pendapatan', 'Harga Pokok Penjualan', 'Laba Kotor',
      'Beban Operasional', 'Laba Usaha',
      'Pendapatan Lain-lain', 'Beban Lain-lain', 'Laba Sebelum Pajak',
      'Beban Pajak Penghasilan', 'Laba Bersih',
    ])
  })

  it('menghitung laba kotor sebagai pendapatan dikurangi HPP', async () => {
    const lr = await laporanLabaRugi('2026-01-01', '2026-12-31')
    const nilai = Object.fromEntries(lr.baris.map((b) => [b.label, b.nilai]))
    expect(nilai['Pendapatan']).toBe('10000000.00')
    expect(nilai['Harga Pokok Penjualan']).toBe('4000000.00')
    expect(nilai['Laba Kotor']).toBe('6000000.00')
  })

  it('memasukkan depresiasi ke beban operasional', async () => {
    const lr = await laporanLabaRugi('2026-01-01', '2026-12-31')
    const nilai = Object.fromEntries(lr.baris.map((b) => [b.label, b.nilai]))
    expect(nilai['Beban Operasional']).toBe('2500000.00')
    expect(nilai['Laba Usaha']).toBe('3500000.00')
  })

  it('menghitung laba bersih sampai setelah pajak', async () => {
    const lr = await laporanLabaRugi('2026-01-01', '2026-12-31')
    const nilai = Object.fromEntries(lr.baris.map((b) => [b.label, b.nilai]))
    expect(nilai['Laba Sebelum Pajak']).toBe('3700000.00')
    expect(nilai['Laba Bersih']).toBe('3300000.00')
    expect(lr.labaBersih).toBe('3300000.00')
  })

  it('menghormati batas rentang tanggal', async () => {
    const kosong = await laporanLabaRugi('2026-01-01', '2026-05-31')
    expect(kosong.labaBersih).toBe('0.00')
  })
})

// ── Neraca ───────────────────────────────────────────────────────────────────

describe('Neraca', () => {
  it('seimbang untuk setoran modal sederhana', async () => {
    await posting('kas', 'modal', '50000000')
    const n = await laporanNeraca('2026-12-31')
    expect(n.totalAset).toBe('50000000.00')
    expect(n.totalEkuitas).toBe('50000000.00')
    expect(n.seimbang).toBe(true)
    expect(n.selisih).toBe('0.00')
  })

  it('memasukkan laba tahun berjalan tanpa memerlukan tutup buku', async () => {
    await posting('kas', 'modal', '50000000')
    await posting('kas', 'pendapatan', '10000000')
    await posting('bebanOps', 'kas', '3000000')

    const n = await laporanNeraca('2026-12-31')
    expect(n.labaTahunBerjalan).toBe('7000000.00')
    expect(n.totalAset).toBe('57000000.00')
    expect(n.totalEkuitas).toBe('57000000.00')
    expect(n.seimbang).toBe(true)
  })

  it('mengurangi akumulasi depresiasi dari aset tetap', async () => {
    await posting('asetTetap', 'modal', '20000000')
    await posting('bebanDep', 'akumDep', '5000000')

    const n = await laporanNeraca('2026-12-31')
    const tidakLancar = n.aset.find((b) => b.label === 'Aset Tidak Lancar')!
    expect(tidakLancar.nilai).toBe('15000000.00')
    expect(n.seimbang).toBe(true)
  })

  it('tetap seimbang saat ada liabilitas', async () => {
    await posting('persediaan', 'utangUsaha', '8000000')
    await posting('kas', 'utangPanjang', '30000000')

    const n = await laporanNeraca('2026-12-31')
    expect(n.totalAset).toBe('38000000.00')
    expect(n.totalLiabilitas).toBe('38000000.00')
    expect(n.seimbang).toBe(true)
  })

  it('melaporkan neraca kosong sebagai seimbang', async () => {
    const n = await laporanNeraca('2026-12-31')
    expect(n.seimbang).toBe(true)
    expect(n.totalAset).toBe('0.00')
  })
})

// ── Neraca Saldo ─────────────────────────────────────────────────────────────

describe('Neraca Saldo', () => {
  it('menyamakan total debit dan total kredit', async () => {
    await posting('kas', 'modal', '50000000')
    await posting('bebanOps', 'kas', '3000000')

    const ns = await laporanNeracaSaldo('2026-01-01', '2026-12-31')
    expect(ns.totalDebit).toBe(ns.totalKredit)
    expect(ns.seimbang).toBe(true)
  })

  it('memisahkan saldo awal dari mutasi periode', async () => {
    await posting('kas', 'modal', '50000000', '2026-03-01')
    await posting('bebanOps', 'kas', '3000000', '2026-06-15')

    const ns = await laporanNeracaSaldo('2026-06-01', '2026-06-30')
    const kas = ns.baris.find((b) => b.kode === '1101')!
    expect(kas.saldoAwal).toBe('50000000.00')
    expect(kas.kredit).toBe('3000000.00')
    expect(kas.saldoAkhir).toBe('47000000.00')
  })

  it('menyembunyikan akun yang tidak bergerak dan tidak bersaldo', async () => {
    await posting('kas', 'modal', '50000000')
    const ns = await laporanNeracaSaldo('2026-01-01', '2026-12-31')
    expect(ns.baris.map((b) => b.kode).sort()).toEqual(['1101', '3101'])
  })
})

// ── Buku Besar ───────────────────────────────────────────────────────────────

describe('Buku Besar', () => {
  it('mengurutkan item berdasarkan tanggal', async () => {
    await posting('kas', 'modal', '50000000', '2026-03-01')
    await posting('bebanOps', 'kas', '3000000', '2026-01-15')

    const item = await itemPerAkun(akun.kas, '2026-01-01', '2026-12-31')
    expect(item.map((b) => b.tanggal)).toEqual(['2026-01-15', '2026-03-01'])
  })

  it('menyertakan nomor entri dan kode jurnal', async () => {
    const entri = await posting('kas', 'modal', '50000000')
    const [item] = await itemPerAkun(akun.kas, '2026-01-01', '2026-12-31')
    expect(item.nomor).toBe(entri.nomor)
    expect(item.jurnalKode).toBe('JU')
  })

  it('tidak menyertakan entri draft', async () => {
    await buatEntri({
      journalId: jurnalId, tanggal: '2026-06-15', referensi: null, keterangan: null,
      mataUangId: 'IDR', partnerId: null,
      item: [
        { accountId: akun.kas, partnerId: null, label: 'D', debit: '100', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null },
        { accountId: akun.modal, partnerId: null, label: 'K', debit: '0', kredit: '100', nilaiMataUang: null, taxId: null, projectId: null },
      ],
    }, penggunaId)
    expect(await itemPerAkun(akun.kas, '2026-01-01', '2026-12-31')).toHaveLength(0)
  })
})

// ── Arus Kas ─────────────────────────────────────────────────────────────────

describe('Arus Kas metode tidak langsung', () => {
  it('mencocokkan kas akhir dengan saldo kas aktual pada kasus sederhana', async () => {
    await posting('kas', 'modal', '50000000', '2026-06-01')
    await posting('kas', 'pendapatan', '10000000', '2026-06-10')
    await posting('bebanOps', 'kas', '3000000', '2026-06-20')

    const ak = await laporanArusKas('2026-06-01', '2026-06-30')
    expect(ak.kasAkhirAktual).toBe('57000000.00')
    expect(ak.kasAkhir).toBe(ak.kasAkhirAktual)
    expect(ak.cocok).toBe(true)
    expect(ak.selisihTakTeridentifikasi).toBe('0.00')
  })

  it('menambahkan kembali depresiasi sebagai item non-kas', async () => {
    await posting('kas', 'modal', '50000000', '2026-06-01')
    await posting('bebanDep', 'akumDep', '2000000', '2026-06-15')

    const ak = await laporanArusKas('2026-06-01', '2026-06-30')
    const operasi = Object.fromEntries(ak.operasi.map((b) => [b.label, b.nilai]))
    expect(operasi['Laba Bersih']).toBe('-2000000.00')
    expect(operasi['Depresiasi dan Amortisasi']).toBe('2000000.00')
    expect(ak.cocok).toBe(true)
  })

  it('memperlakukan kenaikan piutang sebagai pengurang kas operasi', async () => {
    await posting('kas', 'modal', '50000000', '2026-06-01')
    await posting('piutang', 'pendapatan', '8000000', '2026-06-10')

    const ak = await laporanArusKas('2026-06-01', '2026-06-30')
    const operasi = Object.fromEntries(ak.operasi.map((b) => [b.label, b.nilai]))
    expect(operasi['Perubahan Piutang Usaha']).toBe('-8000000.00')
    expect(ak.kasAkhirAktual).toBe('50000000.00')
    expect(ak.cocok).toBe(true)
  })

  it('memperlakukan kenaikan utang usaha sebagai penambah kas operasi', async () => {
    await posting('persediaan', 'utangUsaha', '6000000', '2026-06-10')

    const ak = await laporanArusKas('2026-06-01', '2026-06-30')
    const operasi = Object.fromEntries(ak.operasi.map((b) => [b.label, b.nilai]))
    expect(operasi['Perubahan Persediaan']).toBe('-6000000.00')
    expect(operasi['Perubahan Utang Usaha']).toBe('6000000.00')
    expect(ak.cocok).toBe(true)
  })

  it('memperhitungkan pembelian aset tetap sebagai arus investasi', async () => {
    await posting('kas', 'modal', '50000000', '2026-06-01')
    await posting('asetTetap', 'kas', '20000000', '2026-06-15')

    const ak = await laporanArusKas('2026-06-01', '2026-06-30')
    expect(ak.kasBersihInvestasi).toBe('-20000000.00')
    expect(ak.kasAkhirAktual).toBe('30000000.00')
    expect(ak.cocok).toBe(true)
  })

  it('memperhitungkan pinjaman jangka panjang sebagai arus pendanaan', async () => {
    await posting('kas', 'utangPanjang', '25000000', '2026-06-05')

    const ak = await laporanArusKas('2026-06-01', '2026-06-30')
    expect(ak.kasBersihPendanaan).toBe('25000000.00')
    expect(ak.cocok).toBe(true)
  })

  it('membawa kas awal dari periode sebelumnya', async () => {
    await posting('kas', 'modal', '50000000', '2026-05-20')
    await posting('kas', 'pendapatan', '5000000', '2026-06-10')

    const ak = await laporanArusKas('2026-06-01', '2026-06-30')
    expect(ak.kasAwal).toBe('50000000.00')
    expect(ak.kasAkhir).toBe('55000000.00')
    expect(ak.cocok).toBe(true)
  })
})

// ── Property test ────────────────────────────────────────────────────────────

/**
 * Pengujian berbasis contoh tunggal terlalu mudah lolos untuk logika
 * akuntansi. Bagian ini menghasilkan ratusan entri acak yang sah lalu
 * memastikan tiga sifat yang harus selalu benar apa pun datanya.
 */
describe('property test — sifat yang harus selalu terpenuhi', () => {
  const PASANGAN: [string, string][] = [
    ['kas', 'modal'], ['kas', 'pendapatan'], ['piutang', 'pendapatan'],
    ['bebanOps', 'kas'], ['bebanOps', 'utangUsaha'], ['hpp', 'persediaan'],
    ['persediaan', 'utangUsaha'], ['persediaan', 'kas'],
    ['asetTetap', 'kas'], ['asetTetap', 'utangPanjang'],
    ['bebanDep', 'akumDep'], ['kas', 'utangPanjang'],
    ['utangUsaha', 'kas'], ['kas', 'piutang'], ['bank', 'kas'],
    ['bebanLain', 'kas'], ['kas', 'pendapatanLain'],
    ['bebanPajak', 'utangPajak'], ['utangPajak', 'kas'],
    ['lancarLain', 'kas'], ['bebanOps', 'bank'], ['bank', 'pendapatan'],
  ]

  /** Deret deterministik agar kegagalan dapat diulang persis. */
  function acak(benih: number): () => number {
    let s = benih
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296
      return s / 4294967296
    }
  }

  async function hasilkanEntri(jumlah: number, benih: number) {
    const rnd = acak(benih)
    for (let i = 0; i < jumlah; i++) {
      const [d, k] = PASANGAN[Math.floor(rnd() * PASANGAN.length)]
      // Nilai dengan dua desimal agar pembulatan ikut teruji.
      const nilai = (Math.floor(rnd() * 9_000_000) + 1000 + Math.floor(rnd() * 100) / 100).toFixed(2)
      const hari = String(Math.floor(rnd() * 28) + 1).padStart(2, '0')
      const bulan = String(Math.floor(rnd() * 6) + 1).padStart(2, '0')
      await posting(d, k, nilai, `2026-${bulan}-${hari}`)
    }
  }

  it('Neraca selalu seimbang: Aset = Liabilitas + Ekuitas', async () => {
    await hasilkanEntri(120, 20260908)
    const n = await laporanNeraca('2026-12-31')
    expect(
      n.seimbang,
      `Aset ${n.totalAset} ≠ Liabilitas ${n.totalLiabilitas} + Ekuitas ${n.totalEkuitas}, selisih ${n.selisih}`,
    ).toBe(true)
  })

  it('Neraca Saldo selalu menyamakan total debit dan total kredit', async () => {
    await hasilkanEntri(120, 777)
    const ns = await laporanNeracaSaldo('2026-01-01', '2026-12-31')
    expect(ns.totalDebit).toBe(ns.totalKredit)
    expect(ns.seimbang).toBe(true)
  })

  it('Arus Kas: Kas Akhir sama dengan saldo kas dan bank yang sesungguhnya', async () => {
    await hasilkanEntri(120, 31415)
    const ak = await laporanArusKas('2026-01-01', '2026-12-31')
    expect(
      ak.cocok,
      `Kas Akhir hitungan ${ak.kasAkhir} ≠ saldo aktual ${ak.kasAkhirAktual}, ` +
      `selisih ${ak.selisihTakTeridentifikasi}`,
    ).toBe(true)
  })

  it('ketiga sifat bertahan pada beberapa benih berbeda', async () => {
    for (const benih of [1, 42, 99991]) {
      await bersihkanTabel(['journal_items', 'journal_entries'])
      await db.update(sequences).set({ nomorBerikut: 1 })
      await hasilkanEntri(40, benih)

      const n = await laporanNeraca('2026-12-31')
      const ns = await laporanNeracaSaldo('2026-01-01', '2026-12-31')
      const ak = await laporanArusKas('2026-01-01', '2026-12-31')

      expect(n.seimbang, `benih ${benih}: neraca selisih ${n.selisih}`).toBe(true)
      expect(ns.seimbang, `benih ${benih}: neraca saldo timpang`).toBe(true)
      expect(ak.cocok, `benih ${benih}: arus kas selisih ${ak.selisihTakTeridentifikasi}`).toBe(true)
    }
  })

  it('Arus Kas tetap cocok saat periode dimulai di tengah tahun', async () => {
    await hasilkanEntri(80, 2718)
    const ak = await laporanArusKas('2026-04-01', '2026-06-30')
    expect(
      ak.cocok,
      `Kas Akhir ${ak.kasAkhir} ≠ aktual ${ak.kasAkhirAktual}, selisih ${ak.selisihTakTeridentifikasi}`,
    ).toBe(true)
  })
})
