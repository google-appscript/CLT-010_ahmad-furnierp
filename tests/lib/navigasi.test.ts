import { describe, it, expect } from 'vitest'
import * as ikon from 'lucide-react'
import {
  NAVIGASI, daftarKodeIzin, daftarHalaman, navigasiTerlihat,
  halamanPertama, temukanJalurAktif, ratakan,
} from '@/lib/navigasi'

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

  it('tidak melebihi tiga tingkat', () => {
    for (const grup of NAVIGASI) {
      for (const anak of grup.anak ?? []) {
        for (const cucu of anak.anak ?? []) {
          expect(cucu.anak, `"${cucu.label}" berada di tingkat keempat`).toBeUndefined()
        }
      }
    }
  })

  it('memberi setiap halaman sebuah rute dan kode izin', () => {
    for (const halaman of daftarHalaman()) {
      expect(halaman.rute, `rute hilang pada "${halaman.label}"`).toBeTruthy()
      expect(halaman.izin, `izin hilang pada "${halaman.label}"`).toBeTruthy()
    }
  })

  it('tidak memberi rute maupun izin pada seksi, karena seksi hanya wadah', () => {
    const seksi = NAVIGASI.flatMap((g) => g.anak ?? []).filter((a) => a.anak)
    expect(seksi.length).toBeGreaterThan(0)
    for (const s of seksi) {
      expect(s.rute, `seksi "${s.label}" tidak boleh punya rute`).toBeUndefined()
      expect(s.izin, `seksi "${s.label}" tidak boleh punya izin`).toBeUndefined()
    }
  })

  it('memberi setiap item nomor fase yang sah', () => {
    for (const item of ratakan(NAVIGASI)) {
      expect(item.fase).toBeGreaterThanOrEqual(1)
      expect(item.fase).toBeLessThanOrEqual(7)
    }
  })

  it('tidak menempatkan seksi pada fase lebih awal daripada halamannya', () => {
    for (const grup of NAVIGASI) {
      for (const seksi of (grup.anak ?? []).filter((a) => a.anak)) {
        const faseTerawal = Math.min(...seksi.anak!.map((h) => h.fase))
        expect(
          seksi.fase,
          `seksi "${seksi.label}" berfase ${seksi.fase} tapi halaman terawalnya fase ${faseTerawal}`,
        ).toBeLessThanOrEqual(faseTerawal)
      }
    }
  })

  it('menggunakan rute yang unik', () => {
    const rute = daftarHalaman().map((i) => i.rute!)
    expect(new Set(rute).size).toBe(rute.length)
  })

  it('menggunakan kode izin bergaya modul.entitas.aksi', () => {
    for (const halaman of daftarHalaman()) {
      expect(halaman.izin, `format salah pada "${halaman.label}"`)
        .toMatch(/^[a-z]+(\.[a-z-]+){1,3}$/)
    }
  })

  it('menjaga sidebar tetap pendek — tak ada grup melebihi delapan baris', () => {
    for (const grup of NAVIGASI) {
      expect(
        (grup.anak ?? []).length,
        `grup "${grup.label}" memuat ${grup.anak?.length} baris di sidebar`,
      ).toBeLessThanOrEqual(8)
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

  it('membuang seksi yang seluruh halamannya berfase belum aktif', () => {
    const akuntansi = navigasiTerlihat(['*'], 1).find((g) => g.label === 'Akuntansi')!
    const seksi = akuntansi.anak!.map((a) => a.label)
    expect(seksi).toContain('Laporan')
    expect(seksi).toContain('Konfigurasi')
    expect(seksi).not.toContain('Aset Tetap')
    expect(seksi).not.toContain('Pelanggan')
  })

  it('menyembunyikan halaman yang izinnya tidak dimiliki', () => {
    const terlihat = ratakan(navigasiTerlihat(['akuntansi.*'], 1))
    expect(terlihat.some((i) => i.rute === '/akuntansi/konfigurasi/bagan-akun')).toBe(true)
    expect(terlihat.some((i) => i.rute === '/pengaturan/pengguna')).toBe(false)
  })

  it('membuang grup yang seluruh isinya tersembunyi', () => {
    const terlihat = navigasiTerlihat(['akuntansi.*'], 1)
    expect(terlihat.some((g) => g.label === 'Pengaturan')).toBe(false)
    expect(terlihat.some((g) => g.label === 'Akuntansi')).toBe(true)
  })

  it('mempertahankan seluruh menu bagi pemegang wildcard pada fase penuh', () => {
    expect(daftarHalaman(navigasiTerlihat(['*'], 7))).toHaveLength(daftarHalaman().length)
  })
})

describe('halamanPertama', () => {
  it('mengembalikan rute halaman itu sendiri bila bukan wadah', () => {
    const dasbor = NAVIGASI.find((g) => g.label === 'Dasbor')!
    expect(halamanPertama(dasbor)).toBe('/dasbor')
  })

  it('mengembalikan halaman pertama dari sebuah seksi', () => {
    const akuntansi = NAVIGASI.find((g) => g.label === 'Akuntansi')!
    const laporan = akuntansi.anak!.find((a) => a.label === 'Laporan')!
    expect(halamanPertama(laporan)).toBe('/akuntansi/laporan/laba-rugi')
  })

  it('menembus dua tingkat untuk sebuah grup', () => {
    const gudang = NAVIGASI.find((g) => g.label === 'Gudang')!
    expect(halamanPertama(gudang)).toBe('/gudang/operasi/penerimaan')
  })
})

describe('temukanJalurAktif', () => {
  const menu = navigasiTerlihat(['*'], 7)

  it('menemukan grup, seksi, dan halaman untuk jalur bersarang', () => {
    const aktif = temukanJalurAktif(menu, '/akuntansi/laporan/neraca')
    expect(aktif.grup?.label).toBe('Akuntansi')
    expect(aktif.seksi?.label).toBe('Laporan')
    expect(aktif.halaman?.label).toBe('Neraca')
  })

  it('menemukan halaman yang berada langsung di bawah grup', () => {
    const aktif = temukanJalurAktif(menu, '/kontak/pelanggan')
    expect(aktif.grup?.label).toBe('Kontak')
    expect(aktif.seksi).toBeUndefined()
    expect(aktif.halaman?.label).toBe('Pelanggan')
  })

  it('memilih rute terpanjang, bukan yang pertama cocok', () => {
    // '/akuntansi' berawalan sama dengan seluruh halaman akuntansi lain;
    // tanpa pemilihan terpanjang ia akan mengklaim semuanya.
    const aktif = temukanJalurAktif(menu, '/akuntansi/konfigurasi/pajak')
    expect(aktif.halaman?.label).toBe('Pajak')
    expect(aktif.seksi?.label).toBe('Konfigurasi')
  })

  it('tetap mengenali Dasbor Akuntansi pada jalur persisnya', () => {
    const aktif = temukanJalurAktif(menu, '/akuntansi')
    expect(aktif.halaman?.label).toBe('Dasbor Akuntansi')
    expect(aktif.seksi).toBeUndefined()
  })

  it('menyorot menu induk pada halaman rincian', () => {
    const aktif = temukanJalurAktif(menu, '/akuntansi/jurnal/entri/abc-123')
    expect(aktif.seksi?.label).toBe('Jurnal')
    expect(aktif.halaman?.label).toBe('Entri Jurnal')
  })

  it('menyorot Entri Jurnal, bukan Item Jurnal, pada halaman entri baru', () => {
    const aktif = temukanJalurAktif(menu, '/akuntansi/jurnal/entri/baru')
    expect(aktif.halaman?.label).toBe('Entri Jurnal')
  })

  it('mengembalikan hasil kosong untuk jalur yang tidak dikenal', () => {
    expect(temukanJalurAktif(menu, '/tidak-ada')).toEqual({})
  })
})
