import { describe, it, expect } from 'vitest'
import { hitungBaris, hitungTotal, sisaKuantitas } from '@/modules/pembelian/layanan/hitung'

const PPN = { tarif: '11', hargaTermasukPajak: false, isPemotongan: false }
const PPN_TERMASUK = { tarif: '11', hargaTermasukPajak: true, isPemotongan: false }
const PPH23 = { tarif: '2', hargaTermasukPajak: false, isPemotongan: true }

describe('hitungBaris — tanpa pajak', () => {
  it('menghitung dasar sebagai kuantitas dikali harga', () => {
    expect(hitungBaris({ kuantitas: '10', hargaSatuan: '50000', pajak: null })).toEqual({
      dpp: '500000.00', ppn: '0.00', pemotongan: '0.00', totalBaris: '500000.00',
    })
  })

  it('memperlakukan tarif nol sama dengan tanpa pajak', () => {
    const hasil = hitungBaris({
      kuantitas: '10', hargaSatuan: '50000',
      pajak: { tarif: '0', hargaTermasukPajak: false, isPemotongan: false },
    })
    expect(hasil.ppn).toBe('0.00')
    expect(hasil.totalBaris).toBe('500000.00')
  })

  it('menangani kuantitas berdesimal', () => {
    expect(hitungBaris({ kuantitas: '2.5', hargaSatuan: '40000', pajak: null }).dpp)
      .toBe('100000.00')
  })
})

describe('hitungBaris — PPN Masukan', () => {
  it('menambahkan PPN di atas dasar pengenaan', () => {
    expect(hitungBaris({ kuantitas: '10', hargaSatuan: '100000', pajak: PPN })).toEqual({
      dpp: '1000000.00', ppn: '110000.00', pemotongan: '0.00', totalBaris: '1110000.00',
    })
  })

  it('memisahkan PPN dari harga bila harga sudah termasuk pajak', () => {
    expect(hitungBaris({ kuantitas: '1', hargaSatuan: '1110000', pajak: PPN_TERMASUK })).toEqual({
      dpp: '1000000.00', ppn: '110000.00', pemotongan: '0.00', totalBaris: '1110000.00',
    })
  })

  it('menjaga dasar ditambah pajak tetap sama dengan nilai bruto', () => {
    for (const harga of ['999999.99', '333333.33', '1', '7777777.77']) {
      const h = hitungBaris({ kuantitas: '1', hargaSatuan: harga, pajak: PPN_TERMASUK })
      expect((Number(h.dpp) + Number(h.ppn)).toFixed(2), `harga ${harga}`)
        .toBe(Number(harga).toFixed(2))
    }
  })
})

describe('hitungBaris — PPh sebagai pemotongan', () => {
  it('tidak menambah nilai tagihan', () => {
    expect(hitungBaris({ kuantitas: '1', hargaSatuan: '1000000', pajak: PPH23 })).toEqual({
      dpp: '1000000.00', ppn: '0.00', pemotongan: '20000.00', totalBaris: '1000000.00',
    })
  })

  it('menghitung pemotongan dari dasar pengenaan yang sama', () => {
    const h = hitungBaris({ kuantitas: '5', hargaSatuan: '400000', pajak: PPH23 })
    expect(h.dpp).toBe('2000000.00')
    expect(h.pemotongan).toBe('40000.00')
  })
})

describe('hitungTotal', () => {
  it('menjumlahkan beberapa baris tanpa pajak', () => {
    const t = hitungTotal([
      { kuantitas: '10', hargaSatuan: '50000', pajak: null },
      { kuantitas: '5', hargaSatuan: '20000', pajak: null },
    ])
    expect(t.totalDpp).toBe('600000.00')
    expect(t.totalTagihan).toBe('600000.00')
    expect(t.totalDibayar).toBe('600000.00')
  })

  it('menjumlahkan PPN dari seluruh baris', () => {
    const t = hitungTotal([
      { kuantitas: '10', hargaSatuan: '100000', pajak: PPN },
      { kuantitas: '5', hargaSatuan: '200000', pajak: PPN },
    ])
    expect(t.totalDpp).toBe('2000000.00')
    expect(t.totalPpn).toBe('220000.00')
    expect(t.totalTagihan).toBe('2220000.00')
    expect(t.totalDibayar).toBe('2220000.00')
  })

  it('mengurangi pemotongan dari jumlah yang dibayar, bukan dari tagihan', () => {
    const t = hitungTotal([
      { kuantitas: '1', hargaSatuan: '1000000', pajak: PPH23 },
    ])
    expect(t.totalTagihan).toBe('1000000.00')
    expect(t.totalPemotongan).toBe('20000.00')
    expect(t.totalDibayar).toBe('980000.00')
  })

  it('menangani campuran PPN dan PPh dalam satu dokumen', () => {
    const t = hitungTotal([
      { kuantitas: '1', hargaSatuan: '1000000', pajak: PPN },
      { kuantitas: '1', hargaSatuan: '500000', pajak: PPH23 },
    ])
    expect(t.totalDpp).toBe('1500000.00')
    expect(t.totalPpn).toBe('110000.00')
    expect(t.totalPemotongan).toBe('10000.00')
    expect(t.totalTagihan).toBe('1610000.00')
    expect(t.totalDibayar).toBe('1600000.00')
  })

  it('mengembalikan nol untuk dokumen tanpa baris', () => {
    const t = hitungTotal([])
    expect(t.totalDpp).toBe('0.00')
    expect(t.totalTagihan).toBe('0.00')
  })

  it('menjaga total tetap sama dengan jumlah baris pada nilai yang sulit dibulatkan', () => {
    const baris = Array.from({ length: 20 }, (_, i) => ({
      kuantitas: '3', hargaSatuan: String(33333.33 + i), pajak: PPN,
    }))
    const t = hitungTotal(baris)
    const jumlahDpp = t.baris.reduce((s, b) => s + Number(b.dpp), 0)
    const jumlahPpn = t.baris.reduce((s, b) => s + Number(b.ppn), 0)
    expect(Number(t.totalDpp)).toBeCloseTo(jumlahDpp, 2)
    expect(Number(t.totalPpn)).toBeCloseTo(jumlahPpn, 2)
    expect(Number(t.totalTagihan)).toBeCloseTo(jumlahDpp + jumlahPpn, 2)
  })
})

describe('sisaKuantitas', () => {
  it('mengurangi yang sudah dari yang dipesan', () => {
    expect(sisaKuantitas('100', '30')).toBe('70.000000')
  })

  it('mengembalikan nol saat sudah terpenuhi seluruhnya', () => {
    expect(sisaKuantitas('100', '100')).toBe('0.000000')
  })

  it('tidak pernah negatif meski penerimaan melebihi pesanan', () => {
    expect(sisaKuantitas('100', '120')).toBe('0')
  })
})
