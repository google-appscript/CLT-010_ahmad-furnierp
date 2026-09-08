import { describe, it, expect } from 'vitest'
import * as ikon from 'lucide-react'
import { NAVIGASI, daftarKodeIzin, navigasiTerlihat, type ItemMenu } from '@/lib/navigasi'

function ratakan(item: ItemMenu[]): ItemMenu[] {
  return item.flatMap((i) => [i, ...(i.anak ? ratakan(i.anak) : [])])
}

describe('navigasi — struktur', () => {
  it('memuat sembilan grup utama', () => {
    expect(NAVIGASI).toHaveLength(9)
  })

  it('menyusun grup sesuai alur bisnis', () => {
    expect(NAVIGASI.map((g) => g.label)).toEqual([
      'Dasbor', 'Kontak', 'Penjualan', 'Pembelian', 'Gudang',
      'Manufaktur', 'Akuntansi', 'Proyek', 'Pengaturan',
    ])
  })

  it('memberi setiap item berujung sebuah rute dan kode izin', () => {
    for (const item of ratakan(NAVIGASI).filter((i) => !i.anak)) {
      expect(item.rute, `rute hilang pada "${item.label}"`).toBeTruthy()
      expect(item.izin, `izin hilang pada "${item.label}"`).toBeTruthy()
    }
  })

  it('memberi setiap item nomor fase yang sah', () => {
    for (const item of ratakan(NAVIGASI)) {
      expect(item.fase).toBeGreaterThanOrEqual(1)
      expect(item.fase).toBeLessThanOrEqual(7)
    }
  })

  it('menggunakan rute yang unik', () => {
    const rute = ratakan(NAVIGASI).filter((i) => i.rute).map((i) => i.rute!)
    expect(new Set(rute).size).toBe(rute.length)
  })

  it('menggunakan kode izin bergaya modul.entitas.aksi', () => {
    for (const item of ratakan(NAVIGASI).filter((i) => i.izin)) {
      expect(item.izin, `format salah pada "${item.label}"`).toMatch(/^[a-z]+(\.[a-z-]+){1,3}$/)
    }
  })
})

describe('navigasi — ikon', () => {
  it('memberi setiap grup utama sebuah nama ikon', () => {
    for (const grup of NAVIGASI) {
      expect(grup.ikon, `ikon hilang pada grup "${grup.label}"`).toBeTruthy()
    }
  })

  it('memakai nama ikon yang benar-benar tersedia di lucide-react', () => {
    for (const grup of NAVIGASI) {
      expect(
        Object.prototype.hasOwnProperty.call(ikon, grup.ikon!),
        `ikon "${grup.ikon}" pada grup "${grup.label}" tidak ada di lucide-react`,
      ).toBe(true)
    }
  })
})

describe('navigasi — daftar kode izin untuk seed', () => {
  it('mengumpulkan kode dari seluruh fase, bukan hanya yang aktif', () => {
    const kode = daftarKodeIzin()
    expect(kode).toContain('akuntansi.coa.kelola')
    expect(kode).toContain('gudang.opname.kelola')
    expect(kode).toContain('proyek.proyek.kelola')
  })

  it('tidak memuat duplikat', () => {
    const kode = daftarKodeIzin()
    expect(new Set(kode).size).toBe(kode.length)
  })
})

describe('navigasi — penyaringan tampilan', () => {
  it('menyembunyikan menu dari fase yang belum dibangun', () => {
    const terlihat = ratakan(navigasiTerlihat(['*'], 1))
    expect(terlihat.every((i) => i.fase <= 1)).toBe(true)
    expect(terlihat.some((i) => i.rute === '/akuntansi/konfigurasi/bagan-akun')).toBe(true)
  })

  it('menyembunyikan menu yang izinnya tidak dimiliki', () => {
    const terlihat = ratakan(navigasiTerlihat(['akuntansi.*'], 1))
    expect(terlihat.some((i) => i.rute === '/akuntansi/konfigurasi/bagan-akun')).toBe(true)
    expect(terlihat.some((i) => i.rute === '/pengaturan/pengguna')).toBe(false)
  })

  it('membuang grup yang seluruh anaknya tersembunyi', () => {
    const terlihat = navigasiTerlihat(['akuntansi.*'], 1)
    expect(terlihat.some((g) => g.label === 'Pengaturan')).toBe(false)
    expect(terlihat.some((g) => g.label === 'Akuntansi')).toBe(true)
  })

  it('mempertahankan seluruh menu bagi pemegang wildcard pada fase penuh', () => {
    const terlihat = ratakan(navigasiTerlihat(['*'], 7))
    expect(terlihat.length).toBe(ratakan(NAVIGASI).length)
  })
})
