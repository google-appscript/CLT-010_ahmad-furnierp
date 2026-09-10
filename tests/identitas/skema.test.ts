import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db, koneksi } from '@/db/klien'
import { users, roles, permissions, rolePermissions, userRoles } from '@/db/schema'
import { hashKataSandi, cocokKataSandi } from '@/modules/identitas/layanan/kata-sandi'
import { cariPenggunaLewatEmail } from '@/modules/identitas/repositori/pengguna'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const TABEL = ['audit_logs', 'user_roles', 'role_permissions', 'permissions', 'roles', 'users']

async function buatPenggunaBerizin(email: string, kodeIzin: string[]) {
  const [pengguna] = await db.insert(users).values({
    email, nama: 'Uji Coba', passwordHash: await hashKataSandi('rahasia123'),
  }).returning()
  const [peran] = await db.insert(roles).values({ kode: 'uji', nama: 'Uji' }).returning()
  await db.insert(userRoles).values({ userId: pengguna.id, roleId: peran.id })
  for (const kode of kodeIzin) {
    const [izin] = await db.insert(permissions).values({ kode, modul: kode.split('.')[0] }).returning()
    await db.insert(rolePermissions).values({ roleId: peran.id, permissionId: izin.id })
  }
  return pengguna
}

beforeEach(async () => { await bersihkanTabel(TABEL) })
afterAll(async () => { await tutupKoneksi() })

describe('koneksi basis data', () => {
  it('menunjuk basis data pengujian, bukan pengembangan', async () => {
    const hasil = await koneksi`SELECT current_database() AS nama`
    const nama = hasil[0].nama as string

    // Namanya tidak dipatok persis agar tiap sesi kerja dapat memakai basis
    // data ujinya sendiri; dua sesi yang berbagi satu basis akan saling
    // menghapus data di tengah jalan. Yang dijaga tetap sama: pengujian tidak
    // boleh menyentuh basis data pengembangan.
    expect(nama).toMatch(/test/)
    expect(nama).not.toBe('furnierp_dev')
  })
})

describe('kata sandi', () => {
  it('menghasilkan hash yang berbeda dari teks aslinya', async () => {
    const hash = await hashKataSandi('rahasia123')
    expect(hash).not.toBe('rahasia123')
    expect(hash.length).toBeGreaterThan(20)
  })

  it('menghasilkan hash berbeda untuk kata sandi yang sama', async () => {
    expect(await hashKataSandi('rahasia123')).not.toBe(await hashKataSandi('rahasia123'))
  })

  it('mencocokkan kata sandi yang benar', async () => {
    expect(await cocokKataSandi('rahasia123', await hashKataSandi('rahasia123'))).toBe(true)
  })

  it('menolak kata sandi yang salah', async () => {
    expect(await cocokKataSandi('rahasia124', await hashKataSandi('rahasia123'))).toBe(false)
  })

  it('menolak kata sandi lebih pendek dari delapan karakter', async () => {
    await expect(hashKataSandi('pendek')).rejects.toThrow('minimal 8 karakter')
  })
})

describe('skema identitas', () => {
  it('menolak email ganda', async () => {
    await db.insert(users).values({ email: 'a@b.c', nama: 'A', passwordHash: 'x' })
    await expect(
      db.insert(users).values({ email: 'a@b.c', nama: 'B', passwordHash: 'y' }),
    ).rejects.toThrow()
  })

  it('menolak kode peran ganda', async () => {
    await db.insert(roles).values({ kode: 'superuser', nama: 'Superuser' })
    await expect(db.insert(roles).values({ kode: 'superuser', nama: 'Lain' })).rejects.toThrow()
  })

  it('menghapus penugasan peran saat pengguna dihapus', async () => {
    const pengguna = await buatPenggunaBerizin('hapus@uji.id', ['akuntansi.coa.kelola'])
    await db.delete(users).where(eq(users.id, pengguna.id))
    expect(await db.select().from(userRoles)).toHaveLength(0)
  })
})

describe('cariPenggunaLewatEmail', () => {
  it('mengembalikan null bila email tidak terdaftar', async () => {
    expect(await cariPenggunaLewatEmail('tidak-ada@uji.id')).toBeNull()
  })

  it('mengumpulkan izin dari peran yang dimiliki', async () => {
    await buatPenggunaBerizin('akuntan@uji.id', ['akuntansi.coa.kelola', 'akuntansi.jurnal.lihat'])
    const hasil = await cariPenggunaLewatEmail('akuntan@uji.id')
    expect(hasil).not.toBeNull()
    expect(hasil!.izin.sort()).toEqual(['akuntansi.coa.kelola', 'akuntansi.jurnal.lihat'])
  })

  it('mengembalikan daftar izin kosong bila peran tidak punya izin', async () => {
    await buatPenggunaBerizin('kosong@uji.id', [])
    expect((await cariPenggunaLewatEmail('kosong@uji.id'))!.izin).toEqual([])
  })

  it('mencari tanpa membedakan huruf besar-kecil', async () => {
    await buatPenggunaBerizin('Kapital@Uji.ID', [])
    expect(await cariPenggunaLewatEmail('kapital@uji.id')).not.toBeNull()
  })

  it('tetap mengembalikan pengguna nonaktif agar lapisan atas yang memutuskan', async () => {
    const pengguna = await buatPenggunaBerizin('nonaktif@uji.id', [])
    await db.update(users).set({ isActive: false }).where(eq(users.id, pengguna.id))
    expect((await cariPenggunaLewatEmail('nonaktif@uji.id'))!.isActive).toBe(false)
  })
})
