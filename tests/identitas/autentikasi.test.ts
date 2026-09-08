import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { users, roles, permissions, rolePermissions, userRoles } from '@/db/schema'
import { hashKataSandi } from '@/modules/identitas/layanan/kata-sandi'
import { verifikasiKredensial, GagalMasukError } from '@/modules/identitas/layanan/autentikasi'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const TABEL = ['audit_logs', 'user_roles', 'role_permissions', 'permissions', 'roles', 'users']

async function buatSuperuser() {
  const [pengguna] = await db.insert(users).values({
    email: 'admin@furni.local', nama: 'Administrator',
    passwordHash: await hashKataSandi('rahasia123'),
  }).returning()
  const [peran] = await db.insert(roles).values({
    kode: 'superuser', nama: 'Superuser', isSystem: true,
  }).returning()
  const [izin] = await db.insert(permissions).values({
    kode: '*', modul: 'sistem', deskripsi: 'Akses penuh',
  }).returning()
  await db.insert(userRoles).values({ userId: pengguna.id, roleId: peran.id })
  await db.insert(rolePermissions).values({ roleId: peran.id, permissionId: izin.id })
  return pengguna
}

beforeEach(async () => { await bersihkanTabel(TABEL) })
afterAll(async () => { await tutupKoneksi() })

describe('verifikasiKredensial', () => {
  it('mengembalikan pengguna beserta izin bila kredensial benar', async () => {
    await buatSuperuser()
    const hasil = await verifikasiKredensial('admin@furni.local', 'rahasia123')
    expect(hasil.nama).toBe('Administrator')
    expect(hasil.izin).toEqual(['*'])
  })

  it('menolak kata sandi yang salah', async () => {
    await buatSuperuser()
    await expect(verifikasiKredensial('admin@furni.local', 'salah123'))
      .rejects.toBeInstanceOf(GagalMasukError)
  })

  it('menolak email yang tidak terdaftar', async () => {
    await expect(verifikasiKredensial('hantu@furni.local', 'rahasia123'))
      .rejects.toBeInstanceOf(GagalMasukError)
  })

  it('memberi pesan galat yang sama untuk email salah maupun kata sandi salah', async () => {
    await buatSuperuser()
    const galatEmail = await verifikasiKredensial('hantu@furni.local', 'rahasia123').catch((e) => e)
    const galatSandi = await verifikasiKredensial('admin@furni.local', 'salah123').catch((e) => e)
    expect(galatEmail.message).toBe(galatSandi.message)
  })

  it('menolak pengguna nonaktif dengan pesan berbeda', async () => {
    const pengguna = await buatSuperuser()
    await db.update(users).set({ isActive: false }).where(eq(users.id, pengguna.id))
    await expect(verifikasiKredensial('admin@furni.local', 'rahasia123'))
      .rejects.toThrow('dinonaktifkan')
  })

  it('memperbarui waktu masuk terakhir', async () => {
    await buatSuperuser()
    await verifikasiKredensial('admin@furni.local', 'rahasia123')
    const [pengguna] = await db.select().from(users).where(eq(users.email, 'admin@furni.local'))
    expect(pengguna.lastLoginAt).not.toBeNull()
  })
})
