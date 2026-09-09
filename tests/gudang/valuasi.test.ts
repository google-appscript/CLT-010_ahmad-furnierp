import { describe, it, expect } from 'vitest'
import {
  hitungRataRataBaru, hitungNilaiPergerakan, konversiSatuan, hitungDampakValuasi,
} from '@/modules/gudang/layanan/valuasi'

describe('hitungRataRataBaru', () => {
  it('memakai harga masuk sebagai rata-rata saat persediaan masih kosong', () => {
    expect(hitungRataRataBaru('0', '0', '100', '50000')).toBe('50000.000000')
  })

  it('mengabaikan rata-rata lama yang tersisa saat kuantitas nol', () => {
    // Rata-rata lama tanpa kuantitas tidak punya arti ekonomis.
    expect(hitungRataRataBaru('0', '99999', '10', '50000')).toBe('50000.000000')
  })

  it('menghitung rata-rata tertimbang dari dua penerimaan', () => {
    // 100 unit @ 50.000 lalu 100 unit @ 70.000 → 60.000
    expect(hitungRataRataBaru('100', '50000', '100', '70000')).toBe('60000.000000')
  })

  it('menimbang sesuai kuantitas, bukan rata-rata sederhana', () => {
    // 300 @ 10.000 lalu 100 @ 20.000 → (3jt + 2jt) / 400 = 12.500
    expect(hitungRataRataBaru('300', '10000', '100', '20000')).toBe('12500.000000')
  })

  it('mempertahankan rata-rata saat harga masuk sama', () => {
    expect(hitungRataRataBaru('100', '50000', '50', '50000')).toBe('50000.000000')
  })

  it('menangani harga masuk nol, misalnya barang hibah', () => {
    // 100 @ 50.000 lalu 100 @ 0 → 25.000
    expect(hitungRataRataBaru('100', '50000', '100', '0')).toBe('25000.000000')
  })

  it('mempertahankan presisi pada pembagian yang tidak bulat', () => {
    // (10 × 100 + 5 × 200) / 15 = 2000/15 = 133,333333…
    expect(hitungRataRataBaru('10', '100', '5', '200')).toBe('133.333333')
  })

  it('menangani kuantitas berdesimal', () => {
    expect(hitungRataRataBaru('2.5', '40000', '2.5', '60000')).toBe('50000.000000')
  })

  it('mereset rata-rata ke harga beli terbaru saat stok sedang minus', () => {
    // Rata-rata atas kuantitas minus akan menyeret nilai persediaan ke arah
    // yang keliru, jadi harga beli nyata yang dipakai.
    expect(hitungRataRataBaru('-10', '50000', '10', '70000')).toBe('70000.000000')
  })

  it('menolak kuantitas masuk nol atau negatif', () => {
    expect(() => hitungRataRataBaru('100', '50000', '0', '70000'))
      .toThrow('harus lebih besar dari nol')
    expect(() => hitungRataRataBaru('100', '50000', '-5', '70000'))
      .toThrow('harus lebih besar dari nol')
  })

  it('menolak harga masuk negatif', () => {
    expect(() => hitungRataRataBaru('100', '50000', '10', '-1'))
      .toThrow('tidak boleh negatif')
  })
})

describe('hitungNilaiPergerakan', () => {
  it('mengalikan kuantitas dengan harga satuan', () => {
    expect(hitungNilaiPergerakan('10', '50000')).toBe('500000.00')
  })

  it('membulatkan ke dua desimal', () => {
    expect(hitungNilaiPergerakan('3', '133.333333')).toBe('400.00')
  })

  it('menangani kuantitas berdesimal', () => {
    expect(hitungNilaiPergerakan('2.5', '40000')).toBe('100000.00')
  })

  it('mempertahankan presisi pada nilai besar', () => {
    expect(hitungNilaiPergerakan('1000000', '12345.678901')).toBe('12345678901.00')
  })
})

describe('konversiSatuan', () => {
  it('mengembalikan nilai sama untuk satuan yang setara', () => {
    expect(konversiSatuan('10', '1', '1')).toBe('10.000000')
  })

  it('mengubah lusin menjadi unit', () => {
    expect(konversiSatuan('5', '12', '1')).toBe('60.000000')
  })

  it('mengubah unit menjadi lusin', () => {
    expect(konversiSatuan('60', '1', '12')).toBe('5.000000')
  })

  it('mengubah ton menjadi kilogram', () => {
    expect(konversiSatuan('2', '1000', '1')).toBe('2000.000000')
  })

  it('menangani hasil yang tidak bulat', () => {
    expect(konversiSatuan('10', '1', '3')).toBe('3.333333')
  })

  it('menolak faktor nol atau negatif', () => {
    expect(() => konversiSatuan('10', '0', '1')).toThrow('lebih besar dari nol')
    expect(() => konversiSatuan('10', '1', '-1')).toThrow('lebih besar dari nol')
  })
})

describe('hitungDampakValuasi — barang masuk', () => {
  it('memperbarui rata-rata dan menambah kuantitas', () => {
    const d = hitungDampakValuasi({
      arah: 'masuk', kuantitas: '100',
      kuantitasSaatIni: '100', rataRataSaatIni: '50000',
      hargaMasuk: '70000',
    })
    expect(d).toEqual({
      hargaPokokSatuan: '70000.000000',
      nilaiTotal: '7000000.00',
      rataRataBaru: '60000.000000',
      kuantitasBaru: '200.000000',
    })
  })

  it('memakai rata-rata berjalan bila harga masuk tidak disebutkan', () => {
    // Terjadi pada transfer masuk dan pembatalan pengeluaran.
    const d = hitungDampakValuasi({
      arah: 'masuk', kuantitas: '10',
      kuantitasSaatIni: '100', rataRataSaatIni: '50000',
    })
    expect(d.hargaPokokSatuan).toBe('50000.000000')
    expect(d.rataRataBaru).toBe('50000.000000')
  })

  it('menetapkan rata-rata dari nol saat penerimaan pertama', () => {
    const d = hitungDampakValuasi({
      arah: 'masuk', kuantitas: '50',
      kuantitasSaatIni: '0', rataRataSaatIni: '0',
      hargaMasuk: '125000',
    })
    expect(d.rataRataBaru).toBe('125000.000000')
    expect(d.nilaiTotal).toBe('6250000.00')
  })
})

describe('hitungDampakValuasi — barang keluar', () => {
  it('memakai rata-rata berjalan tanpa mengubahnya', () => {
    const d = hitungDampakValuasi({
      arah: 'keluar', kuantitas: '30',
      kuantitasSaatIni: '100', rataRataSaatIni: '60000',
    })
    expect(d).toEqual({
      hargaPokokSatuan: '60000.000000',
      nilaiTotal: '1800000.00',
      rataRataBaru: '60000.000000',
      kuantitasBaru: '70.000000',
    })
  })

  it('tidak mengubah rata-rata meski seluruh stok dikeluarkan', () => {
    const d = hitungDampakValuasi({
      arah: 'keluar', kuantitas: '100',
      kuantitasSaatIni: '100', rataRataSaatIni: '60000',
    })
    expect(d.rataRataBaru).toBe('60000.000000')
    expect(d.kuantitasBaru).toBe('0.000000')
  })

  it('menolak kuantitas nol atau negatif', () => {
    expect(() => hitungDampakValuasi({
      arah: 'keluar', kuantitas: '0',
      kuantitasSaatIni: '100', rataRataSaatIni: '60000',
    })).toThrow('harus lebih besar dari nol')
  })
})

describe('valuasi — sifat yang harus selalu terpenuhi', () => {
  /**
   * Nilai persediaan yang dihitung dari rata-rata bergerak harus selalu sama
   * dengan jumlah nilai seluruh barang masuk dikurangi nilai barang keluar.
   * Bila tidak, neraca akan menyimpang dari kartu stok.
   */
  it('nilai persediaan tetap konsisten setelah seratus pergerakan acak', () => {
    let kuantitas = '0'
    let rataRata = '0'
    let nilaiMasukKumulatif = 0
    let nilaiKeluarKumulatif = 0

    // Deret deterministik agar kegagalan dapat diulang persis.
    let benih = 20260909
    const rnd = () => {
      benih = (benih * 1664525 + 1013904223) % 4294967296
      return benih / 4294967296
    }

    for (let i = 0; i < 100; i++) {
      const masuk = Number(kuantitas) <= 0 || rnd() < 0.55
      const kuantitasGerak = (Math.floor(rnd() * 50) + 1).toString()

      if (masuk) {
        const harga = (Math.floor(rnd() * 200_000) + 1000).toString()
        const d = hitungDampakValuasi({
          arah: 'masuk', kuantitas: kuantitasGerak,
          kuantitasSaatIni: kuantitas, rataRataSaatIni: rataRata,
          hargaMasuk: harga,
        })
        nilaiMasukKumulatif += Number(d.nilaiTotal)
        kuantitas = d.kuantitasBaru
        rataRata = d.rataRataBaru
      } else {
        // Tidak pernah mengeluarkan lebih dari yang tersedia.
        const tersedia = Math.floor(Number(kuantitas))
        if (tersedia <= 0) continue
        const keluar = Math.min(Number(kuantitasGerak), tersedia).toString()
        const d = hitungDampakValuasi({
          arah: 'keluar', kuantitas: keluar,
          kuantitasSaatIni: kuantitas, rataRataSaatIni: rataRata,
        })
        nilaiKeluarKumulatif += Number(d.nilaiTotal)
        kuantitas = d.kuantitasBaru
        rataRata = d.rataRataBaru
      }
    }

    const nilaiDariRataRata = Number(kuantitas) * Number(rataRata)
    const nilaiDariPergerakan = nilaiMasukKumulatif - nilaiKeluarKumulatif

    // Toleransi mengikuti pembulatan enam desimal pada rata-rata, dikalikan
    // kuantitas yang tersisa.
    const toleransi = Math.max(1, Number(kuantitas) * 0.01)
    expect(
      Math.abs(nilaiDariRataRata - nilaiDariPergerakan),
      `nilai dari rata-rata ${nilaiDariRataRata} menyimpang dari nilai pergerakan ${nilaiDariPergerakan}`,
    ).toBeLessThan(toleransi)
  })

  it('kuantitas tidak pernah negatif bila pengeluaran dibatasi stok tersedia', () => {
    let kuantitas = '100'
    const rataRata = '50000'
    for (const keluar of ['30', '30', '30', '10']) {
      const d = hitungDampakValuasi({
        arah: 'keluar', kuantitas: keluar,
        kuantitasSaatIni: kuantitas, rataRataSaatIni: rataRata,
      })
      kuantitas = d.kuantitasBaru
      expect(Number(kuantitas)).toBeGreaterThanOrEqual(0)
    }
    expect(kuantitas).toBe('0.000000')
  })
})
