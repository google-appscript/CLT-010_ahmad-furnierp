import { describe, expect, it, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/klien'
import { users } from '@/db/schema'
import { simpanFilter, daftarFilter, hapusFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

async function buatPengguna(email: string) {
  const [u] = await db.insert(users)
    .values({ email, nama: 'Pengguna Uji', passwordHash: 'x' })
    .returning()
  return u
}

describe('filter tersimpan', () => {
  beforeEach(async () => {
    await bersihkanTabel(['filter_tersimpan', 'users'])
  })
  afterAll(tutupKoneksi)

  it('menyimpan lalu memunculkan favorit di daftarFilter', async () => {
    const pengguna = await buatPengguna('a@uji.test')
    await simpanFilter({
      penggunaId: pengguna.id, kunciDaftar: 'penjualan.pesanan',
      nama: 'Draft Bulan Ini', kriteria: { filter: { status: ['penawaran'] } },
    })
    const daftar = await daftarFilter(pengguna.id, 'penjualan.pesanan')
    expect(daftar).toHaveLength(1)
    expect(daftar[0].nama).toBe('Draft Bulan Ini')
  })

  it('tidak menghapus favorit milik pengguna lain', async () => {
    const a = await buatPengguna('a@uji.test')
    const b = await buatPengguna('b@uji.test')
    const { id } = await simpanFilter({
      penggunaId: a.id, kunciDaftar: 'penjualan.pesanan', nama: 'X', kriteria: {},
    })
    await hapusFilter(id, b.id)
    const daftar = await daftarFilter(a.id, 'penjualan.pesanan')
    expect(daftar).toHaveLength(1) // masih ada, tidak terhapus oleh pengguna lain
  })
})
