import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { users } from '@/db/schema'
import { cariPenggunaLewatEmail, type PenggunaDenganIzin } from '../repositori/pengguna'
import { cocokKataSandi } from './kata-sandi'

export class GagalMasukError extends Error {
  constructor(pesan = 'Email atau kata sandi salah') {
    super(pesan)
    this.name = 'GagalMasukError'
  }
}

/**
 * Pesan galat untuk email tidak terdaftar dan kata sandi salah sengaja
 * disamakan agar penyerang tidak dapat menebak email mana yang terdaftar.
 */
export async function verifikasiKredensial(
  email: string,
  kataSandi: string,
): Promise<PenggunaDenganIzin> {
  const pengguna = await cariPenggunaLewatEmail(email)
  if (!pengguna) throw new GagalMasukError()

  const cocok = await cocokKataSandi(kataSandi, pengguna.passwordHash)
  if (!cocok) throw new GagalMasukError()

  if (!pengguna.isActive) {
    throw new GagalMasukError('Akun Anda telah dinonaktifkan. Hubungi administrator.')
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, pengguna.id))
  return pengguna
}
