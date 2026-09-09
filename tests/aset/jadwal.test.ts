import { describe, it, expect } from 'vitest'
import { susunJadwal, akhirBulanSetelah, type MetodeDepresiasi } from '@/modules/aset/layanan/jadwal'
import { bulatkan, kurang, tambah } from '@/lib/uang'

describe('akhirBulanSetelah', () => {
  it('mengembalikan hari terakhir bulan yang dimaksud', () => {
    expect(akhirBulanSetelah('2026-01-15', 0)).toBe('2026-01-31')
    expect(akhirBulanSetelah('2026-01-15', 1)).toBe('2026-02-28')
    expect(akhirBulanSetelah('2026-01-15', 11)).toBe('2026-12-31')
    expect(akhirBulanSetelah('2026-01-15', 12)).toBe('2027-01-31')
  })

  it('mengenali Februari tahun kabisat', () => {
    expect(akhirBulanSetelah('2028-02-01', 0)).toBe('2028-02-29')
  })
})

describe('susunJadwal garis lurus', () => {
  it('membagi rata dan berhenti di nilai residu', () => {
    const jadwal = susunJadwal({
      nilaiPerolehan: '120000000', nilaiResidu: '0',
      masaManfaatBulan: 12, metode: 'garis_lurus', tanggalMulai: '2026-01-01',
    })

    expect(jadwal).toHaveLength(12)
    expect(Number(jadwal[0].nilai)).toBe(10_000_000)
    expect(jadwal[0].tanggal).toBe('2026-01-31')
    expect(jadwal[11].tanggal).toBe('2026-12-31')
    expect(Number(jadwal[11].nilaiBuku)).toBe(0)
  })

  it('menyisakan nilai residu di akhir masa manfaat', () => {
    const jadwal = susunJadwal({
      nilaiPerolehan: '100000000', nilaiResidu: '10000000',
      masaManfaatBulan: 36, metode: 'garis_lurus', tanggalMulai: '2026-03-20',
    })

    expect(jadwal).toHaveLength(36)
    expect(jadwal[0].tanggal).toBe('2026-03-31')
    expect(Number(jadwal[35].nilaiBuku)).toBe(10_000_000)
  })

  it('baris terakhir menyerap sisa pembulatan', () => {
    // 100 dibagi 3 tidak habis; totalnya tetap harus persis 100.
    const jadwal = susunJadwal({
      nilaiPerolehan: '100', nilaiResidu: '0',
      masaManfaatBulan: 3, metode: 'garis_lurus', tanggalMulai: '2026-01-01',
    })

    const total = jadwal.reduce((t, b) => t + Number(b.nilai), 0)
    expect(total).toBeCloseTo(100, 10)
    expect(Number(jadwal[2].nilaiBuku)).toBe(0)
  })

  it('melewati bulan yang bebannya membulat ke nol', () => {
    // Lima sen atas enam puluh bulan tidak dapat dibagi rata dalam rupiah:
    // bulan-bulan awal tidak dibebani apa pun, dan sisanya baru terbebankan
    // begitu bagiannya mencapai satu sen.
    const jadwal = susunJadwal({
      nilaiPerolehan: '100.05', nilaiResidu: '100',
      masaManfaatBulan: 60, metode: 'garis_lurus', tanggalMulai: '2026-01-01',
    })

    expect(jadwal.length).toBeLessThan(60)
    expect(jadwal.every((b) => Number(b.nilai) > 0)).toBe(true)
    expect(tambah(...jadwal.map((b) => b.nilai))).toBe('0.05')
    expect(Number(jadwal[jadwal.length - 1].nilaiBuku)).toBe(100)
  })
})

describe('susunJadwal saldo menurun ganda', () => {
  it('membebankan lebih besar di awal daripada garis lurus', () => {
    const masukan = {
      nilaiPerolehan: '120000000', nilaiResidu: '0',
      masaManfaatBulan: 24, tanggalMulai: '2026-01-01',
    }
    const menurun = susunJadwal({ ...masukan, metode: 'saldo_menurun_ganda' })
    const lurus = susunJadwal({ ...masukan, metode: 'garis_lurus' })

    expect(Number(menurun[0].nilai)).toBeGreaterThan(Number(lurus[0].nilai))
  })

  it('beban tidak pernah naik dari bulan ke bulan', () => {
    const jadwal = susunJadwal({
      nilaiPerolehan: '250000000', nilaiResidu: '25000000',
      masaManfaatBulan: 48, metode: 'saldo_menurun_ganda', tanggalMulai: '2026-01-01',
    })

    for (let i = 1; i < jadwal.length; i += 1) {
      expect(Number(jadwal[i].nilai)).toBeLessThanOrEqual(Number(jadwal[i - 1].nilai) + 0.01)
    }
  })

  it('berhenti tepat di nilai residu tanpa lonjakan di bulan terakhir', () => {
    const jadwal = susunJadwal({
      nilaiPerolehan: '250000000', nilaiResidu: '25000000',
      masaManfaatBulan: 48, metode: 'saldo_menurun_ganda', tanggalMulai: '2026-01-01',
    })

    const terakhir = jadwal[jadwal.length - 1]
    expect(Number(terakhir.nilaiBuku)).toBe(25_000_000)
    // Peralihan ke garis lurus membuat bulan terakhir tidak lebih besar dari
    // bulan pertama; tanpa peralihan, sisanya akan menumpuk di sana.
    expect(Number(terakhir.nilai)).toBeLessThan(Number(jadwal[0].nilai))
  })
})

describe('susunJadwal menolak masukan yang mustahil', () => {
  const dasar = {
    nilaiPerolehan: '1000000', nilaiResidu: '0',
    masaManfaatBulan: 12, metode: 'garis_lurus' as MetodeDepresiasi,
    tanggalMulai: '2026-01-01',
  }

  it('masa manfaat nol', () => {
    expect(() => susunJadwal({ ...dasar, masaManfaatBulan: 0 }))
      .toThrow(/lebih besar dari nol bulan/)
  })

  it('nilai perolehan nol', () => {
    expect(() => susunJadwal({ ...dasar, nilaiPerolehan: '0' }))
      .toThrow(/perolehan harus lebih besar dari nol/)
  })

  it('residu negatif', () => {
    expect(() => susunJadwal({ ...dasar, nilaiResidu: '-1' }))
      .toThrow(/residu tidak boleh negatif/)
  })

  it('residu sama dengan atau melebihi perolehan', () => {
    expect(() => susunJadwal({ ...dasar, nilaiResidu: '1000000' }))
      .toThrow(/residu harus lebih kecil/)
  })
})

describe('invarian jadwal atas masukan acak', () => {
  it('total beban selalu persis sebesar nilai yang dapat disusutkan', () => {
    // Deret acak yang dapat diulang: benih tetap agar kegagalan reprodusibel.
    let benih = 20260910
    const acak = () => {
      benih = (benih * 1103515245 + 12345) % 2147483648
      return benih / 2147483648
    }

    const metode: MetodeDepresiasi[] = ['garis_lurus', 'saldo_menurun_ganda']

    for (let percobaan = 0; percobaan < 300; percobaan += 1) {
      const perolehan = (Math.floor(acak() * 5_000_000_00) + 100).toString()
      const residu = Math.floor(acak() * Number(perolehan) * 0.4).toString()
      const masa = Math.floor(acak() * 120) + 1
      const m = metode[Math.floor(acak() * metode.length)]

      const jadwal = susunJadwal({
        nilaiPerolehan: perolehan, nilaiResidu: residu,
        masaManfaatBulan: masa, metode: m, tanggalMulai: '2026-01-01',
      })

      // Dijumlahkan lewat aritmetika desimal, bukan float: menjumlahkan
      // ratusan nilai sebagai number sendirinya sudah menimbulkan galat.
      const dasar = bulatkan(kurang(perolehan, residu), 2)
      const total = bulatkan(tambah(...jadwal.map((b) => b.nilai)), 2)

      expect(total).toBe(dasar)
      // Setiap baris nyata membebani sesuatu.
      expect(jadwal.every((b) => Number(b.nilai) > 0)).toBe(true)
      // Akumulasi menaik dan nilai buku menurun, tanpa terkecuali.
      for (let i = 1; i < jadwal.length; i += 1) {
        expect(Number(jadwal[i].akumulasi)).toBeGreaterThan(Number(jadwal[i - 1].akumulasi))
        expect(Number(jadwal[i].nilaiBuku)).toBeLessThan(Number(jadwal[i - 1].nilaiBuku))
      }
      // Berhenti tepat di residu, bukan di sekitarnya.
      if (jadwal.length > 0) {
        expect(bulatkan(jadwal[jadwal.length - 1].nilaiBuku, 2)).toBe(bulatkan(residu, 2))
      }
      // Jadwal tidak pernah lebih panjang dari masa manfaatnya.
      expect(jadwal.length).toBeLessThanOrEqual(masa)
    }
  })
})
