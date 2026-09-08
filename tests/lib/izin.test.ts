import { describe, it, expect } from 'vitest'
import { punyaIzin, punyaSalahSatuIzin } from '@/lib/izin'

describe('izin — pencocokan tepat', () => {
  it('mengizinkan bila kode persis sama', () => {
    expect(punyaIzin(['akuntansi.jurnal.lihat'], 'akuntansi.jurnal.lihat')).toBe(true)
  })

  it('menolak bila kode tidak ada', () => {
    expect(punyaIzin(['akuntansi.jurnal.lihat'], 'akuntansi.jurnal.posting')).toBe(false)
  })

  it('menolak bila daftar izin kosong', () => {
    expect(punyaIzin([], 'akuntansi.jurnal.lihat')).toBe(false)
  })
})

describe('izin — wildcard global', () => {
  it('mengizinkan apa pun bagi pemegang bintang', () => {
    expect(punyaIzin(['*'], 'akuntansi.jurnal.posting')).toBe(true)
    expect(punyaIzin(['*'], 'gudang.opname.kelola')).toBe(true)
  })
})

describe('izin — wildcard bersegmen', () => {
  it('mengizinkan seluruh kode di bawah prefiks', () => {
    expect(punyaIzin(['akuntansi.*'], 'akuntansi.jurnal.posting')).toBe(true)
    expect(punyaIzin(['akuntansi.jurnal.*'], 'akuntansi.jurnal.posting')).toBe(true)
  })

  it('tidak bocor ke modul lain yang berawalan mirip', () => {
    expect(punyaIzin(['akuntansi.*'], 'akuntansiX.jurnal.lihat')).toBe(false)
    expect(punyaIzin(['gudang.*'], 'akuntansi.jurnal.lihat')).toBe(false)
  })

  it('tidak mengizinkan prefiks itu sendiri tanpa segmen lanjutan', () => {
    expect(punyaIzin(['akuntansi.*'], 'akuntansi')).toBe(false)
  })
})

describe('izin — salah satu dari beberapa', () => {
  it('mengizinkan bila satu saja cocok', () => {
    expect(punyaSalahSatuIzin(['gudang.*'], ['akuntansi.coa.kelola', 'gudang.produk.lihat'])).toBe(true)
  })

  it('menolak bila tidak satu pun cocok', () => {
    expect(punyaSalahSatuIzin(['proyek.*'], ['akuntansi.coa.kelola', 'gudang.produk.lihat'])).toBe(false)
  })

  it('menolak bila daftar yang diperlukan kosong', () => {
    expect(punyaSalahSatuIzin(['*'], [])).toBe(false)
  })
})
