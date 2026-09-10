import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  users, accounts, journals, sequences, companySettings, currencies,
  journalEntries, journalItems, profitPeriods,
} from '@/db/schema'
import {
  buatPemilik, ubahPemilik, ubahStatusPemilik, daftarPemilik,
  buatSusunan, ubahSusunan, hapusSusunan, daftarSusunan,
} from '@/modules/kepemilikan/layanan/pemilik'
import {
  periodeSetahun, hitungLabaBersih, bagiLaba,
  kunciBagiHasil, bukaKunciBagiHasil, daftarPeriodeBagiHasil, ringkasanPemilik,
} from '@/modules/kepemilikan/layanan/bagi-hasil'
import { postingJurnal } from '@/modules/akuntansi/layanan/entri'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'
import { seedPemetaanJurnal } from '../bantuan/pemetaan'

const TABEL = [
  'profit_shares', 'profit_periods', 'ownership_shares', 'ownership_periods', 'owners',
  'journal_item_cost_allocations', 'cost_centers',
  'journal_items', 'journal_entries', 'journal_mappings', 'journals', 'sequences',
  'company_settings', 'accounts', 'currency_rates', 'currencies',
  'audit_logs', 'user_roles', 'users', 'partners', 'payment_terms', 'taxes',
]

let penggunaId: string
let jurnalId: string
const akun: Record<string, string> = {}
let pemilikA: string
let pemilikB: string

async function siapkanPengaturan(periode: 'bulanan' | 'kuartalan' | 'tahunan') {
  await db.update(companySettings).set({ periodeBagiHasil: periode })
}

beforeEach(async () => {
  await bersihkanTabel(TABEL)
  await db.insert(currencies).values({ kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 })

  const dibuatAkun = await db.insert(accounts).values([
    { kode: '1101', nama: 'Kas', tipeAkun: 'aset_kas' },
    { kode: '3101', nama: 'Modal Budi', tipeAkun: 'ekuitas' },
    { kode: '3102', nama: 'Modal Sari', tipeAkun: 'ekuitas' },
    { kode: '3202', nama: 'Laba Tahun Berjalan', tipeAkun: 'ekuitas_laba_berjalan' },
    { kode: '3301', nama: 'Prive Budi', tipeAkun: 'ekuitas' },
    { kode: '4101', nama: 'Penjualan Furnitur', tipeAkun: 'pendapatan' },
    { kode: '6111', nama: 'Beban Listrik', tipeAkun: 'beban_operasional' },
  ]).returning()
  for (const a of dibuatAkun) akun[a.kode] = a.id

  await db.insert(companySettings).values({
    nama: 'PT Uji',
    akunLabaBerjalanId: akun['3202'],
    periodeBagiHasil: 'tahunan',
  })

  const [pengguna] = await db.insert(users).values({
    email: 'pemilik@uji.id', nama: 'Administrator', passwordHash: 'x',
  }).returning()
  penggunaId = pengguna.id

  const [urutan] = await db.insert(sequences).values({
    kode: 'jurnal:JU', prefix: 'JU', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan',
  }).returning()
  const [jurnal] = await db.insert(journals).values({
    kode: 'JU', nama: 'Jurnal Umum', tipe: 'umum', sequenceId: urutan.id,
  }).returning()
  await seedPemetaanJurnal()
  jurnalId = jurnal.id

  pemilikA = (await buatPemilik({
    kode: 'OWN-1', nama: 'Budi', akunModalId: akun['3101'],
    akunPriveId: akun['3301'], catatan: null,
  })).id
  pemilikB = (await buatPemilik({
    kode: 'OWN-2', nama: 'Sari', akunModalId: akun['3102'],
    akunPriveId: null, catatan: null,
  })).id
})

afterAll(async () => { await tutupKoneksi() })

// ── Pembantu ─────────────────────────────────────────────────────────────────

/** Mencatat laba: pendapatan tunai sebesar `nilai` pada tanggal tertentu. */
async function catatLaba(nilai: string, tanggal: string) {
  await postingJurnal({
    journalId: jurnalId, tanggal, referensi: null,
    keterangan: 'Penjualan tunai', mataUangId: 'IDR', partnerId: null,
    sumberTipe: 'uji', sumberId: crypto.randomUUID(),
    item: [
      {
        accountId: akun['1101'], partnerId: null, label: 'Kas',
        debit: nilai, kredit: '0', nilaiMataUang: null, taxId: null, projectId: null,
      },
      {
        accountId: akun['4101'], partnerId: null, label: 'Penjualan',
        debit: '0', kredit: nilai, nilaiMataUang: null, taxId: null, projectId: null,
      },
    ],
  } as never, penggunaId)
}

async function catatBeban(nilai: string, tanggal: string) {
  await postingJurnal({
    journalId: jurnalId, tanggal, referensi: null,
    keterangan: 'Beban listrik', mataUangId: 'IDR', partnerId: null,
    sumberTipe: 'uji', sumberId: crypto.randomUUID(),
    item: [
      {
        accountId: akun['6111'], partnerId: null, label: 'Listrik',
        debit: nilai, kredit: '0', nilaiMataUang: null, taxId: null, projectId: null,
      },
      {
        accountId: akun['1101'], partnerId: null, label: 'Listrik',
        debit: '0', kredit: nilai, nilaiMataUang: null, taxId: null, projectId: null,
      },
    ],
  } as never, penggunaId)
}

async function susunanSetara() {
  return buatSusunan({
    nama: 'Susunan Awal', tanggalMulai: '2026-01-01', tanggalSelesai: null, catatan: null,
    porsi: [
      { ownerId: pemilikA, persentase: '60' },
      { ownerId: pemilikB, persentase: '40' },
    ],
  })
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
  return Number(hasil[0].kredit) - Number(hasil[0].debit)
}

// ── Pemilik ──────────────────────────────────────────────────────────────────

describe('pemilik', () => {
  it('setiap pemilik wajib punya akun modalnya sendiri', async () => {
    await expect(buatPemilik({
      kode: 'OWN-3', nama: 'Cakra', akunModalId: akun['3101'],
      akunPriveId: null, catatan: null,
    })).rejects.toThrow(/sudah dipakai pemilik Budi/)
  })

  it('menolak akun modal yang bukan ekuitas', async () => {
    await expect(buatPemilik({
      kode: 'OWN-3', nama: 'Cakra', akunModalId: akun['1101'],
      akunPriveId: null, catatan: null,
    })).rejects.toThrow(/harus bertipe Ekuitas/)
  })

  it('menolak kode yang sudah dipakai', async () => {
    await expect(buatPemilik({
      kode: 'OWN-1', nama: 'Lain', akunModalId: akun['3202'],
      akunPriveId: null, catatan: null,
    })).rejects.toThrow(/sudah dipakai/)
  })

  it('pemilik dinonaktifkan, bukan dihapus', async () => {
    await ubahStatusPemilik(pemilikB, false)
    expect(await daftarPemilik()).toHaveLength(2)
    expect(await daftarPemilik({ hanyaAktif: true })).toHaveLength(1)
  })

  it('mengubah nama pemilik tidak mengganggu akun modalnya', async () => {
    const diubah = await ubahPemilik(pemilikA, {
      kode: 'OWN-1', nama: 'Budi Santoso', akunModalId: akun['3101'],
      akunPriveId: akun['3301'], catatan: null,
    })
    expect(diubah.nama).toBe('Budi Santoso')
  })
})

// ── Susunan kepemilikan ─────────────────────────────────────────────────────

describe('susunan kepemilikan', () => {
  it('total persentase wajib tepat seratus', async () => {
    await expect(buatSusunan({
      nama: 'Timpang', tanggalMulai: '2026-01-01', tanggalSelesai: null, catatan: null,
      porsi: [
        { ownerId: pemilikA, persentase: '60' },
        { ownerId: pemilikB, persentase: '30' },
      ],
    })).rejects.toThrow(/harus berjumlah tepat 100%/)
  })

  it('satu pemilik tidak boleh muncul dua kali', async () => {
    await expect(buatSusunan({
      nama: 'Ganda', tanggalMulai: '2026-01-01', tanggalSelesai: null, catatan: null,
      porsi: [
        { ownerId: pemilikA, persentase: '50' },
        { ownerId: pemilikA, persentase: '50' },
      ],
    })).rejects.toThrow(/hanya boleh muncul sekali/)
  })

  it('menyimpan susunan beserta porsinya', async () => {
    await susunanSetara()
    const daftar = await daftarSusunan()
    expect(daftar).toHaveLength(1)
    expect(daftar[0].porsi).toHaveLength(2)
    expect(Number(daftar[0].totalPersentase)).toBe(100)
  })
})

// ── Perhitungan periode ─────────────────────────────────────────────────────

describe('periode bagi hasil', () => {
  it('tahunan menghasilkan satu periode', () => {
    const p = periodeSetahun(2026, 'tahunan')
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({
      kode: '2026', tanggalMulai: '2026-01-01', tanggalSelesai: '2026-12-31',
    })
  })

  it('kuartalan menghasilkan empat periode yang bersambung', () => {
    const p = periodeSetahun(2026, 'kuartalan')
    expect(p.map((x) => x.kode)).toEqual(['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4'])
    expect(p[0].tanggalSelesai).toBe('2026-03-31')
    expect(p[3].tanggalSelesai).toBe('2026-12-31')
  })

  it('bulanan menghormati panjang tiap bulan termasuk tahun kabisat', () => {
    expect(periodeSetahun(2026, 'bulanan')[1].tanggalSelesai).toBe('2026-02-28')
    expect(periodeSetahun(2028, 'bulanan')[1].tanggalSelesai).toBe('2028-02-29')
  })
})

describe('hitungLabaBersih', () => {
  it('pendapatan dikurangi beban dalam rentangnya saja', async () => {
    await catatLaba('10000000', '2026-03-10')
    await catatBeban('2000000', '2026-03-15')
    await catatLaba('5000000', '2027-01-05')

    expect(Number(await hitungLabaBersih('2026-01-01', '2026-12-31'))).toBe(8_000_000)
  })

  it('rugi menghasilkan angka negatif', async () => {
    await catatBeban('3000000', '2026-04-01')
    expect(Number(await hitungLabaBersih('2026-01-01', '2026-12-31'))).toBe(-3_000_000)
  })
})

describe('bagiLaba', () => {
  it('membagi menurut persentase', () => {
    const hasil = bagiLaba('10000000', [
      { ownerId: 'a', persentase: '60' },
      { ownerId: 'b', persentase: '40' },
    ])
    expect(hasil.map((h) => Number(h.jumlah))).toEqual([6_000_000, 4_000_000])
  })

  it('baris terakhir menyerap sisa pembulatan', () => {
    const hasil = bagiLaba('100', [
      { ownerId: 'a', persentase: '33.3333' },
      { ownerId: 'b', persentase: '33.3333' },
      { ownerId: 'c', persentase: '33.3334' },
    ])
    expect(hasil.reduce((t, h) => t + Number(h.jumlah), 0)).toBeCloseTo(100, 10)
  })

  it('menolak susunan yang tidak berjumlah seratus', () => {
    expect(() => bagiLaba('1000', [{ ownerId: 'a', persentase: '90' }]))
      .toThrow(/tepat 100%/)
  })
})

// ── Penguncian dan distribusi ───────────────────────────────────────────────

describe('penguncian bagi hasil', () => {
  it('memposting laba ke akun modal tiap pemilik menurut porsinya', async () => {
    await susunanSetara()
    await catatLaba('10000000', '2026-06-10')

    const { labaBersih } = await kunciBagiHasil('2026', penggunaId)
    expect(Number(labaBersih)).toBe(10_000_000)

    // Laba Tahun Berjalan didebit, modal masing-masing dikredit.
    expect(await saldoAkun('3202')).toBe(-10_000_000)
    expect(await saldoAkun('3101')).toBe(6_000_000)
    expect(await saldoAkun('3102')).toBe(4_000_000)
  })

  it('tidak menutup akun laba rugi, sehingga laporannya tetap utuh', async () => {
    await susunanSetara()
    await catatLaba('10000000', '2026-06-10')
    await kunciBagiHasil('2026', penggunaId)

    // Pendapatan tetap bersaldo penuh setelah distribusi.
    expect(await saldoAkun('4101')).toBe(10_000_000)
    expect(Number(await hitungLabaBersih('2026-01-01', '2026-12-31'))).toBe(10_000_000)
  })

  it('jurnal distribusinya seimbang', async () => {
    await susunanSetara()
    await catatLaba('10000000', '2026-06-10')
    await kunciBagiHasil('2026', penggunaId)

    const hasil = await db
      .select({
        debit: sql<string>`COALESCE(SUM(${journalItems.debit}), 0)::text`,
        kredit: sql<string>`COALESCE(SUM(${journalItems.kredit}), 0)::text`,
      })
      .from(journalItems)
      .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
      .where(eq(journalEntries.status, 'diposting'))
    expect(Number(hasil[0].debit)).toBe(Number(hasil[0].kredit))
  })

  it('rugi membalik arah: modal pemilik berkurang', async () => {
    await susunanSetara()
    await catatBeban('5000000', '2026-06-10')
    await kunciBagiHasil('2026', penggunaId)

    expect(await saldoAkun('3101')).toBe(-3_000_000)
    expect(await saldoAkun('3102')).toBe(-2_000_000)
    expect(await saldoAkun('3202')).toBe(5_000_000)
  })

  it('menolak periode yang sudah dikunci', async () => {
    await susunanSetara()
    await catatLaba('10000000', '2026-06-10')
    await kunciBagiHasil('2026', penggunaId)

    await expect(kunciBagiHasil('2026', penggunaId)).rejects.toThrow(/sudah dikunci/)
  })

  it('menolak bila belum ada susunan kepemilikan yang berlaku', async () => {
    await catatLaba('10000000', '2026-06-10')
    await expect(kunciBagiHasil('2026', penggunaId))
      .rejects.toThrow(/Belum ada susunan kepemilikan yang berlaku/)
  })

  it('menolak periode yang labanya nol', async () => {
    await susunanSetara()
    await expect(kunciBagiHasil('2026', penggunaId))
      .rejects.toThrow(/nol, tidak ada yang dapat dibagikan/)
  })

  it('menolak kode periode yang tidak sesuai panjang periode berlaku', async () => {
    await susunanSetara()
    await catatLaba('10000000', '2026-06-10')
    // Pengaturan masih tahunan, jadi kode kuartalan tidak dikenali.
    await expect(kunciBagiHasil('2026-Q2', penggunaId))
      .rejects.toThrow(/tidak sesuai dengan panjang periode/)
  })

  it('periode kuartalan harus dikunci berurutan', async () => {
    await siapkanPengaturan('kuartalan')
    await susunanSetara()
    await catatLaba('4000000', '2026-02-10')
    await catatLaba('6000000', '2026-05-10')

    await expect(kunciBagiHasil('2026-Q2', penggunaId))
      .rejects.toThrow(/2026-Q1 belum dikunci/)

    await kunciBagiHasil('2026-Q1', penggunaId)
    const q2 = await kunciBagiHasil('2026-Q2', penggunaId)
    expect(Number(q2.labaBersih)).toBe(6_000_000)
  })

  it('mengubah panjang periode tidak mengusik yang sudah terkunci', async () => {
    await siapkanPengaturan('kuartalan')
    await susunanSetara()
    await catatLaba('4000000', '2026-02-10')
    await kunciBagiHasil('2026-Q1', penggunaId)

    await siapkanPengaturan('tahunan')
    const [terkunci] = await db.select().from(profitPeriods)
    expect(terkunci.kode).toBe('2026-Q1')
    expect(terkunci.tipe).toBe('kuartalan')
  })

  it('susunan yang sudah dipakai membagi laba tidak dapat diubah', async () => {
    const susunan = await susunanSetara()
    await catatLaba('10000000', '2026-06-10')
    await kunciBagiHasil('2026', penggunaId)

    await expect(ubahSusunan(susunan.id, {
      nama: 'Diubah', tanggalMulai: '2026-01-01', tanggalSelesai: null, catatan: null,
      porsi: [
        { ownerId: pemilikA, persentase: '50' },
        { ownerId: pemilikB, persentase: '50' },
      ],
    })).rejects.toThrow(/sudah dipakai membagi laba periode 2026/)

    await expect(hapusSusunan(susunan.id)).rejects.toThrow(/sudah dipakai membagi laba/)
  })
})

// ── Membuka kunci ───────────────────────────────────────────────────────────

describe('membuka kunci bagi hasil', () => {
  it('membalik jurnal distribusinya, bukan menghapusnya', async () => {
    await susunanSetara()
    await catatLaba('10000000', '2026-06-10')
    const { profitPeriodId } = await kunciBagiHasil('2026', penggunaId)

    await bukaKunciBagiHasil(profitPeriodId, penggunaId)

    // Saldo modal kembali nol karena distribusinya dibalik.
    expect(await saldoAkun('3101')).toBe(0)
    expect(await saldoAkun('3202')).toBe(0)
    // Entri aslinya tetap ada beserta pembaliknya.
    const entri = await db.select().from(journalEntries)
      .where(eq(journalEntries.status, 'diposting'))
    expect(entri.length).toBeGreaterThanOrEqual(3)
    expect(await db.select().from(profitPeriods)).toHaveLength(0)
  })

  it('hanya periode terakhir yang dapat dibuka', async () => {
    await siapkanPengaturan('kuartalan')
    await susunanSetara()
    await catatLaba('4000000', '2026-02-10')
    await catatLaba('6000000', '2026-05-10')
    const q1 = await kunciBagiHasil('2026-Q1', penggunaId)
    await kunciBagiHasil('2026-Q2', penggunaId)

    await expect(bukaKunciBagiHasil(q1.profitPeriodId, penggunaId))
      .rejects.toThrow(/Hanya periode terakhir \(2026-Q2\)/)
  })
})

// ── Daftar dan laporan ──────────────────────────────────────────────────────

describe('daftar periode dan transparansi', () => {
  it('periode terbuka memakai angka terkini, yang terkunci memakai angka bekunya', async () => {
    await siapkanPengaturan('kuartalan')
    await susunanSetara()
    await catatLaba('4000000', '2026-02-10')
    await kunciBagiHasil('2026-Q1', penggunaId)

    // Transaksi baru pada kuartal yang sudah terkunci tidak menggeser angkanya.
    await catatLaba('1000000', '2026-03-20')

    const daftar = await daftarPeriodeBagiHasil(2026)
    const q1 = daftar.find((p) => p.kode === '2026-Q1')!
    expect(q1.status).toBe('terkunci')
    expect(Number(q1.labaBersih)).toBe(4_000_000)
    expect(q1.porsi).toHaveLength(2)

    const q2 = daftar.find((p) => p.kode === '2026-Q2')!
    expect(q2.status).toBe('terbuka')
    expect(Number(q2.labaBersih)).toBe(0)
  })

  it('ringkasan memperlihatkan bagian, prive, dan sisa hak tiap pemilik', async () => {
    await susunanSetara()
    await catatLaba('10000000', '2026-06-10')
    await kunciBagiHasil('2026', penggunaId)

    // Budi menarik sebagian haknya.
    await postingJurnal({
      journalId: jurnalId, tanggal: '2026-07-01', referensi: null,
      keterangan: 'Prive Budi', mataUangId: 'IDR', partnerId: null,
      sumberTipe: 'uji', sumberId: crypto.randomUUID(),
      item: [
        {
          accountId: akun['3301'], partnerId: null, label: 'Prive',
          debit: '2000000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null,
        },
        {
          accountId: akun['1101'], partnerId: null, label: 'Prive',
          debit: '0', kredit: '2000000', nilaiMataUang: null, taxId: null, projectId: null,
        },
      ],
    } as never, penggunaId)

    const ringkasan = await ringkasanPemilik()
    const budi = ringkasan.find((r) => r.kode === 'OWN-1')!
    const sari = ringkasan.find((r) => r.kode === 'OWN-2')!

    expect(Number(budi.totalBagiHasil)).toBe(6_000_000)
    expect(Number(budi.saldoModal)).toBe(6_000_000)
    expect(Number(budi.totalPrive)).toBe(2_000_000)
    expect(Number(budi.sisaHak)).toBe(4_000_000)

    expect(Number(sari.totalBagiHasil)).toBe(4_000_000)
    expect(Number(sari.totalPrive)).toBe(0)
    expect(Number(sari.sisaHak)).toBe(4_000_000)
  })

  it('jumlah seluruh porsi sama dengan laba bersih periodenya', async () => {
    await susunanSetara()
    await catatLaba('10000000', '2026-06-10')
    await catatBeban('333333', '2026-06-11')
    await kunciBagiHasil('2026', penggunaId)

    const daftar = await daftarPeriodeBagiHasil(2026)
    const p = daftar.find((x) => x.kode === '2026')!
    const totalPorsi = p.porsi.reduce((t, x) => t + Number(x.jumlah), 0)
    expect(totalPorsi).toBe(Number(p.labaBersih))
  })
})
