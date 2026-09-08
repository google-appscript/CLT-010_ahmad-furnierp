import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import { users, roles, userRoles } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { hashKataSandi, PANJANG_MINIMAL } from './kata-sandi'
import {
  skemaPengguna, skemaPenggunaBaru,
  type MasukanPengguna, type MasukanPenggunaBaru,
} from '../validasi/pengguna'

export type BarisPengguna = {
  id: string
  email: string
  nama: string
  isActive: boolean
  lastLoginAt: Date | null
  peran: string[]
}

function kumpulkan(baris: {
  id: string; email: string; nama: string; isActive: boolean
  lastLoginAt: Date | null; namaPeran: string | null
}[]): BarisPengguna[] {
  const terkumpul = new Map<string, BarisPengguna>()
  for (const b of baris) {
    const sudahAda = terkumpul.get(b.id) ?? {
      id: b.id, email: b.email, nama: b.nama,
      isActive: b.isActive, lastLoginAt: b.lastLoginAt, peran: [],
    }
    if (b.namaPeran) sudahAda.peran.push(b.namaPeran)
    terkumpul.set(b.id, sudahAda)
  }
  return [...terkumpul.values()]
}

const KOLOM = {
  id: users.id, email: users.email, nama: users.nama,
  isActive: users.isActive, lastLoginAt: users.lastLoginAt, namaPeran: roles.nama,
}

async function ambilBaris(id: string): Promise<BarisPengguna> {
  const baris = await db.select(KOLOM).from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(users.id, id))
  if (baris.length === 0) throw new ValidasiError('Pengguna tidak ditemukan')
  return kumpulkan(baris)[0]
}

async function emailTerpakai(email: string, kecualiId?: string): Promise<boolean> {
  const cocok = sql`lower(${users.email}) = lower(${email})`
  const syarat = kecualiId ? and(cocok, ne(users.id, kecualiId)) : cocok
  const [ada] = await db.select({ id: users.id }).from(users).where(syarat).limit(1)
  return Boolean(ada)
}

async function peranAda(peranId: string): Promise<boolean> {
  const [ada] = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, peranId)).limit(1)
  return Boolean(ada)
}

export async function daftarPengguna(): Promise<BarisPengguna[]> {
  const baris = await db.select(KOLOM).from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .orderBy(asc(users.nama))
  return kumpulkan(baris)
}

export async function buatPengguna(masukan: MasukanPenggunaBaru): Promise<BarisPengguna> {
  const hasil = skemaPenggunaBaru.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  if (await emailTerpakai(data.email)) {
    throw new ValidasiError(`Email ${data.email} sudah terdaftar`)
  }
  if (!(await peranAda(data.peranId))) throw new ValidasiError('Peran tidak ditemukan')

  const passwordHash = await hashKataSandi(data.kataSandi)

  const id = await db.transaction(async (tx) => {
    const [pengguna] = await tx.insert(users)
      .values({ email: data.email, nama: data.nama, passwordHash })
      .returning({ id: users.id })
    await tx.insert(userRoles).values({ userId: pengguna.id, roleId: data.peranId })
    return pengguna.id
  })

  return ambilBaris(id)
}

export async function ubahPengguna(id: string, masukan: MasukanPengguna): Promise<BarisPengguna> {
  const hasil = skemaPengguna.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  if (await emailTerpakai(data.email, id)) {
    throw new ValidasiError(`Email ${data.email} sudah terdaftar`)
  }
  if (!(await peranAda(data.peranId))) throw new ValidasiError('Peran tidak ditemukan')

  await db.transaction(async (tx) => {
    await tx.update(users)
      .set({ email: data.email, nama: data.nama, diubahPada: new Date() })
      .where(eq(users.id, id))
    // Peran diganti, bukan ditambahkan — satu pengguna memegang satu peran.
    await tx.delete(userRoles).where(eq(userRoles.userId, id))
    await tx.insert(userRoles).values({ userId: id, roleId: data.peranId })
  })

  return ambilBaris(id)
}

export async function aturKataSandi(id: string, kataSandi: string): Promise<void> {
  if (kataSandi.length < PANJANG_MINIMAL) {
    throw new ValidasiError(`Kata sandi minimal ${PANJANG_MINIMAL} karakter`)
  }
  const passwordHash = await hashKataSandi(kataSandi)
  await db.update(users).set({ passwordHash, diubahPada: new Date() }).where(eq(users.id, id))
}

/**
 * Menonaktifkan pengguna aktif terakhir akan mengunci semua orang di luar
 * sistem tanpa jalan masuk, sehingga ditolak.
 */
export async function ubahStatusPengguna(id: string, aktif: boolean): Promise<void> {
  if (!aktif) {
    const [{ jumlah }] = await db
      .select({ jumlah: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.isActive, true), ne(users.id, id)))
    if (jumlah === 0) {
      throw new ValidasiError('Tidak dapat menonaktifkan pengguna aktif terakhir')
    }
  }
  await db.update(users).set({ isActive: aktif, diubahPada: new Date() }).where(eq(users.id, id))
}
