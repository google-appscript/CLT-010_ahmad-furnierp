import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  sequences, sequencePeriods, companySettings, currencies, currencyRates,
} from '@/db/schema'
import { ambilNomorBerikut } from '@/modules/akuntansi/layanan/urutan'
import {
  periodeTerkunci, wajibPeriodeTerbuka, PeriodeTerkunciError,
} from '@/modules/akuntansi/layanan/penguncian'
import {
  ambilKurs, konversiKeIdr, MATA_UANG_FUNGSIONAL, KursTidakDitemukanError,
} from '@/modules/akuntansi/layanan/kurs'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

afterAll(async () => { await tutupKoneksi() })

// ── Penomoran ────────────────────────────────────────────────────────────────

async function buatUrutan(ubah: Partial<typeof sequences.$inferInsert> = {}) {
  await db.insert(sequences).values({
    kode: 'jurnal_umum', prefix: 'JU', panjangDigit: 4, nomorBerikut: 1, reset: 'tahunan',
    ...ubah,
  })
}

const tgl = (iso: string) => new Date(`${iso}T00:00:00Z`)

describe('ambilNomorBerikut — pembentukan format', () => {
  beforeEach(async () => { await bersihkanTabel(['sequence_periods', 'sequences']) })

  it('menyusun nomor tahunan sebagai PREFIX/TAHUN/NOMOR', async () => {
    await buatUrutan()
    const nomor = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-09-08')))
    expect(nomor).toBe('JU/2026/0001')
  })

  it('menyusun nomor bulanan sebagai PREFIX/TAHUN/BULAN/NOMOR', async () => {
    await buatUrutan({ reset: 'bulanan' })
    const nomor = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-09-08')))
    expect(nomor).toBe('JU/2026/09/0001')
  })

  it('menyusun nomor tanpa reset sebagai PREFIX/NOMOR', async () => {
    await buatUrutan({ reset: 'tidak_pernah' })
    const nomor = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-09-08')))
    expect(nomor).toBe('JU/0001')
  })

  it('menghormati panjang digit yang ditetapkan', async () => {
    await buatUrutan({ panjangDigit: 6, nomorBerikut: 42 })
    const nomor = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-09-08')))
    expect(nomor).toBe('JU/2026/000042')
  })

  it('tidak memotong nomor yang melampaui panjang digit', async () => {
    await buatUrutan({ panjangDigit: 2, nomorBerikut: 12345 })
    const nomor = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-09-08')))
    expect(nomor).toBe('JU/2026/12345')
  })

  it('menolak kode urutan yang tidak terdaftar', async () => {
    await expect(
      db.transaction((tx) => ambilNomorBerikut(tx, 'tidak_ada', tgl('2026-09-08'))),
    ).rejects.toThrow('tidak ditemukan')
  })
})

describe('ambilNomorBerikut — pencacahan dan reset', () => {
  beforeEach(async () => { await bersihkanTabel(['sequence_periods', 'sequences']) })

  it('menaikkan nomor pada pemanggilan berikutnya', async () => {
    await buatUrutan()
    const a = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-09-08')))
    const b = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-09-09')))
    expect([a, b]).toEqual(['JU/2026/0001', 'JU/2026/0002'])
  })

  it('mengulang dari satu saat tahun berganti', async () => {
    await buatUrutan()
    await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-12-31')))
    const baru = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2027-01-01')))
    expect(baru).toBe('JU/2027/0001')
  })

  it('mengulang dari satu saat bulan berganti pada reset bulanan', async () => {
    await buatUrutan({ reset: 'bulanan' })
    await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-09-30')))
    const baru = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-10-01')))
    expect(baru).toBe('JU/2026/10/0001')
  })

  it('tidak mengulang saat tahun berganti bila reset tidak pernah', async () => {
    await buatUrutan({ reset: 'tidak_pernah' })
    await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-12-31')))
    const baru = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2027-01-01')))
    expect(baru).toBe('JU/0002')
  })

  it('menyimpan pencacah per periode ke basis data', async () => {
    await buatUrutan({ reset: 'bulanan' })
    await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-09-08')))

    const [urutan] = await db.select().from(sequences).where(eq(sequences.kode, 'jurnal_umum'))
    const periode = await db.select().from(sequencePeriods)
      .where(eq(sequencePeriods.sequenceId, urutan.id))

    expect(periode).toHaveLength(1)
    expect(periode[0]).toMatchObject({ tahun: 2026, bulan: 9, nomorBerikut: 2 })
    // Definisi urutan tetap menyimpan nomor awal periode, bukan pencacahnya.
    expect(urutan.nomorBerikut).toBe(1)
  })

  it('nomor bertanggal mundur tidak menabrak nomor bulan berjalan', async () => {
    // Inilah yang terjadi saat depresiasi beberapa bulan diposting sekaligus:
    // bulan berjalan sudah punya nomor, lalu bulan-bulan lama menyusul.
    await buatUrutan({ reset: 'bulanan' })
    const september = await db.transaction(
      (tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-09-30')),
    )
    const januari = await db.transaction(
      (tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-01-31')),
    )
    const septemberLagi = await db.transaction(
      (tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-09-30')),
    )

    expect(september).toBe('JU/2026/09/0001')
    expect(januari).toBe('JU/2026/01/0001')
    expect(septemberLagi).toBe('JU/2026/09/0002')
  })

  it('pencacah tiap periode berdiri sendiri', async () => {
    await buatUrutan({ reset: 'bulanan' })
    const nomor: string[] = []
    for (const iso of ['2026-03-31', '2026-01-31', '2026-03-15', '2026-02-28', '2026-01-01']) {
      nomor.push(await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl(iso))))
    }

    expect(nomor).toEqual([
      'JU/2026/03/0001', 'JU/2026/01/0001', 'JU/2026/03/0002',
      'JU/2026/02/0001', 'JU/2026/01/0002',
    ])
    // Tidak ada nomor kembar, apa pun urutan pemanggilannya.
    expect(new Set(nomor).size).toBe(nomor.length)
  })
})

describe('ambilNomorBerikut — keserempakan', () => {
  beforeEach(async () => { await bersihkanTabel(['sequence_periods', 'sequences']) })

  it('tidak menghasilkan nomor kembar saat dua puluh transaksi berjalan bersamaan', async () => {
    await buatUrutan()
    const hasil = await Promise.all(
      Array.from({ length: 20 }, () =>
        db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tgl('2026-09-08'))),
      ),
    )
    expect(new Set(hasil).size).toBe(20)
    expect(hasil).toContain('JU/2026/0020')
  })
})

// ── Penguncian periode ───────────────────────────────────────────────────────

async function aturKunci(tanggalKunci: string | null) {
  await db.insert(companySettings).values({
    nama: 'PT Furni Nusantara', tanggalKunciBuku: tanggalKunci,
  })
}

describe('penguncian periode', () => {
  beforeEach(async () => { await bersihkanTabel(['company_settings']) })

  it('menganggap periode terbuka bila tanggal kunci belum diatur', async () => {
    await aturKunci(null)
    expect(await periodeTerkunci(tgl('2020-01-01'))).toBe(false)
  })

  it('menganggap periode terbuka bila pengaturan perusahaan belum ada', async () => {
    expect(await periodeTerkunci(tgl('2020-01-01'))).toBe(false)
  })

  it('mengunci tanggal sebelum tanggal kunci', async () => {
    await aturKunci('2026-08-31')
    expect(await periodeTerkunci(tgl('2026-08-30'))).toBe(true)
  })

  it('mengunci tepat pada tanggal kunci', async () => {
    await aturKunci('2026-08-31')
    expect(await periodeTerkunci(tgl('2026-08-31'))).toBe(true)
  })

  it('mengunci transaksi tengah hari pada tanggal kunci', async () => {
    await aturKunci('2026-08-31')
    expect(await periodeTerkunci(new Date('2026-08-31T10:00:00Z'))).toBe(true)
  })

  it('membiarkan tanggal setelah tanggal kunci terbuka', async () => {
    await aturKunci('2026-08-31')
    expect(await periodeTerkunci(tgl('2026-09-01'))).toBe(false)
  })

  it('melempar galat bermakna saat periode terkunci', async () => {
    await aturKunci('2026-08-31')
    await expect(wajibPeriodeTerbuka(tgl('2026-08-15')))
      .rejects.toBeInstanceOf(PeriodeTerkunciError)
    await expect(wajibPeriodeTerbuka(tgl('2026-08-15')))
      .rejects.toThrow('31 Agustus 2026')
  })

  it('tidak melempar galat saat periode terbuka', async () => {
    await aturKunci('2026-08-31')
    await expect(wajibPeriodeTerbuka(tgl('2026-09-01'))).resolves.toBeUndefined()
  })
})

// ── Kurs ─────────────────────────────────────────────────────────────────────

describe('ambilKurs', () => {
  beforeEach(async () => {
    await bersihkanTabel(['currency_rates', 'currencies'])
    await db.insert(currencies).values([
      { kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 },
      { kode: 'USD', nama: 'Dolar Amerika Serikat', simbol: '$', desimal: 2 },
      { kode: 'EUR', nama: 'Euro', simbol: '€', desimal: 2 },
    ])
  })

  it('mengembalikan satu untuk mata uang fungsional', async () => {
    expect(await ambilKurs(MATA_UANG_FUNGSIONAL, tgl('2026-09-08'))).toBe('1')
  })

  it('mengembalikan kurs pada tanggal yang tepat', async () => {
    await db.insert(currencyRates).values({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '16250' })
    expect(await ambilKurs('USD', tgl('2026-09-08'))).toBe('16250')
  })

  it('memakai kurs terakhir sebelum tanggal transaksi bila tanggal persisnya tidak ada', async () => {
    await db.insert(currencyRates).values([
      { kodeMataUang: 'USD', tanggal: '2026-09-01', kurs: '16000' },
      { kodeMataUang: 'USD', tanggal: '2026-09-05', kurs: '16250' },
    ])
    expect(await ambilKurs('USD', tgl('2026-09-08'))).toBe('16250')
  })

  it('tidak memakai kurs yang tanggalnya melampaui tanggal transaksi', async () => {
    await db.insert(currencyRates).values([
      { kodeMataUang: 'USD', tanggal: '2026-09-01', kurs: '16000' },
      { kodeMataUang: 'USD', tanggal: '2026-09-30', kurs: '17000' },
    ])
    expect(await ambilKurs('USD', tgl('2026-09-08'))).toBe('16000')
  })

  it('memisahkan kurs antar mata uang', async () => {
    await db.insert(currencyRates).values([
      { kodeMataUang: 'USD', tanggal: '2026-09-01', kurs: '16000' },
      { kodeMataUang: 'EUR', tanggal: '2026-09-01', kurs: '17500' },
    ])
    expect(await ambilKurs('EUR', tgl('2026-09-08'))).toBe('17500')
  })

  it('melempar galat bila tidak ada kurs pada atau sebelum tanggal transaksi', async () => {
    await db.insert(currencyRates).values({ kodeMataUang: 'USD', tanggal: '2026-09-30', kurs: '17000' })
    await expect(ambilKurs('USD', tgl('2026-09-08')))
      .rejects.toBeInstanceOf(KursTidakDitemukanError)
  })

  it('menyebutkan mata uang dan tanggal dalam pesan galat', async () => {
    await expect(ambilKurs('USD', tgl('2026-09-08')))
      .rejects.toThrow(/USD.*8 September 2026/)
  })
})

describe('konversiKeIdr', () => {
  beforeEach(async () => {
    await bersihkanTabel(['currency_rates', 'currencies'])
    await db.insert(currencies).values([
      { kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 },
      { kode: 'USD', nama: 'Dolar Amerika Serikat', simbol: '$', desimal: 2 },
    ])
  })

  it('mengembalikan nilai apa adanya untuk mata uang fungsional', async () => {
    expect(await konversiKeIdr('1500.55', 'IDR', tgl('2026-09-08'))).toBe('1500.55')
  })

  it('mengalikan nilai asing dengan kurs lalu membulatkan ke dua desimal', async () => {
    await db.insert(currencyRates).values({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '16250' })
    expect(await konversiKeIdr('100.50', 'USD', tgl('2026-09-08'))).toBe('1633125.00')
  })

  it('membulatkan setengah ke atas pada hasil konversi', async () => {
    await db.insert(currencyRates).values({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '15000.005' })
    expect(await konversiKeIdr('0.01', 'USD', tgl('2026-09-08'))).toBe('150.00')
  })

  it('mempertahankan presisi pada nilai besar', async () => {
    await db.insert(currencyRates).values({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '16250' })
    expect(await konversiKeIdr('1000000.01', 'USD', tgl('2026-09-08'))).toBe('16250000162.50')
  })
})
