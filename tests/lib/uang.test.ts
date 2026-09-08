import { describe, it, expect } from 'vitest'
import {
  tambah, kurang, kali, bagi, negasi, bulatkan, bandingkan,
  samaDengan, nol, adalahNol, formatRupiah, formatAngka, uraiInput,
} from '@/lib/uang'

describe('uang — aritmatika bebas galat pembulatan biner', () => {
  it('menjumlahkan 0,1 dan 0,2 menjadi tepat 0,3', () => {
    expect(tambah('0.1', '0.2')).toBe('0.3')
  })

  it('menjumlahkan banyak nilai sekaligus', () => {
    expect(tambah('1000.05', '2000.10', '3000.85')).toBe('6001')
  })

  it('menjumlahkan daftar kosong menjadi nol', () => {
    expect(tambah()).toBe('0')
  })

  it('mengurangkan dengan presisi penuh', () => {
    expect(kurang('1000000000000.03', '0.01')).toBe('1000000000000.02')
  })

  it('mengalikan tanpa kehilangan presisi', () => {
    expect(kali('1234567.89', '0.11')).toBe('135802.4679')
  })

  it('menerima pengali berupa angka', () => {
    expect(kali('100', 3)).toBe('300')
  })

  it('membagi dan mempertahankan presisi tinggi', () => {
    expect(bulatkan(bagi('100', 3), 6)).toBe('33.333333')
  })

  it('menolak pembagian dengan nol', () => {
    expect(() => bagi('100', 0)).toThrow('Pembagian dengan nol')
  })

  it('menegasikan nilai', () => {
    expect(negasi('1500.50')).toBe('-1500.5')
    expect(negasi('-1500.50')).toBe('1500.5')
  })
})

describe('uang — pembulatan setengah ke atas', () => {
  it('membulatkan 0,5 ke atas', () => {
    expect(bulatkan('1234.565', 2)).toBe('1234.57')
  })

  it('membulatkan nilai negatif setengah menjauhi nol', () => {
    expect(bulatkan('-1234.565', 2)).toBe('-1234.57')
  })

  it('membulatkan ke nol desimal', () => {
    expect(bulatkan('1234.5', 0)).toBe('1235')
  })

  it('menambahkan desimal bila nilai lebih pendek', () => {
    expect(bulatkan('10', 2)).toBe('10.00')
  })
})

describe('uang — perbandingan', () => {
  it('membandingkan nilai yang tekstual berbeda tapi sama nilainya', () => {
    expect(samaDengan('10.00', '10')).toBe(true)
    expect(bandingkan('10.00', '10')).toBe(0)
  })

  it('mengurutkan dengan benar', () => {
    expect(bandingkan('9.99', '10')).toBe(-1)
    expect(bandingkan('10.01', '10')).toBe(1)
  })

  it('mengenali nol dalam berbagai bentuk', () => {
    expect(adalahNol('0')).toBe(true)
    expect(adalahNol('0.00')).toBe(true)
    expect(adalahNol('-0.00')).toBe(true)
    expect(adalahNol('0.01')).toBe(false)
  })

  it('menghasilkan nol dengan jumlah desimal tertentu', () => {
    expect(nol()).toBe('0')
    expect(nol(2)).toBe('0.00')
  })
})

describe('uang — format Indonesia', () => {
  it('memformat rupiah dengan pemisah ribuan titik dan desimal koma', () => {
    expect(formatRupiah('1234567.89')).toBe('Rp 1.234.567,89')
  })

  it('memformat nilai negatif dengan tanda di depan simbol', () => {
    expect(formatRupiah('-1234567.89')).toBe('-Rp 1.234.567,89')
  })

  it('memformat nilai kecil', () => {
    expect(formatRupiah('0')).toBe('Rp 0,00')
    expect(formatRupiah('999')).toBe('Rp 999,00')
    expect(formatRupiah('1000')).toBe('Rp 1.000,00')
  })

  it('memformat nilai sangat besar tanpa notasi ilmiah', () => {
    expect(formatRupiah('999999999999999.99')).toBe('Rp 999.999.999.999.999,99')
  })

  it('memformat angka tanpa simbol mata uang', () => {
    expect(formatAngka('1234567.891', 3)).toBe('1.234.567,891')
  })
})

describe('uang — penguraian input pengguna', () => {
  it('mengurai format Indonesia lengkap', () => {
    expect(uraiInput('1.234.567,89')).toBe('1234567.89')
  })

  it('mengurai angka polos', () => {
    expect(uraiInput('1000')).toBe('1000')
  })

  it('mengurai nilai negatif dan mengabaikan spasi', () => {
    expect(uraiInput(' -1.500,25 ')).toBe('-1500.25')
  })

  it('mengabaikan simbol Rp', () => {
    expect(uraiInput('Rp 2.500,00')).toBe('2500')
  })

  it('mengembalikan nol untuk teks kosong', () => {
    expect(uraiInput('')).toBe('0')
  })

  it('menolak teks yang bukan angka', () => {
    expect(() => uraiInput('abc')).toThrow('Nilai tidak valid')
  })
})
