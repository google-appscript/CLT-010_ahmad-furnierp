import { describe, expect, it } from 'vitest'
import { uraikanParameterDaftar, serialisasiParameterDaftar } from '@/lib/daftar'

describe('uraikanParameterDaftar', () => {
  it('mem-parsing filter jamak per field sebagai OR, field berbeda sebagai entri terpisah', () => {
    const sp = new URLSearchParams('q=budi&filter=status:draft,posted&filter=pelanggan:xyz&group=pelanggan&sort=tanggal:desc&hal=2&ukuran=50')
    const hasil = uraikanParameterDaftar(sp)
    expect(hasil).toEqual({
      cari: 'budi',
      filter: { status: ['draft', 'posted'], pelanggan: ['xyz'] },
      kelompokkan: 'pelanggan',
      urutkan: { kolom: 'tanggal', arah: 'desc' },
      halaman: 2,
      ukuranHalaman: 50,
    })
  })

  it('memberi default halaman=1 dan ukuranHalaman=20 saat kosong', () => {
    const hasil = uraikanParameterDaftar(new URLSearchParams(''))
    expect(hasil.halaman).toBe(1)
    expect(hasil.ukuranHalaman).toBe(20)
  })
})

describe('serialisasiParameterDaftar', () => {
  it('mempertahankan parameter lain saat hanya mengubah halaman', () => {
    const base = new URLSearchParams('q=budi&filter=status:draft&hal=1')
    const hasil = serialisasiParameterDaftar({ halaman: 3 }, base)
    expect(hasil.get('hal')).toBe('3')
    expect(hasil.get('q')).toBe('budi')
    expect(hasil.get('filter')).toBe('status:draft')
  })
})
