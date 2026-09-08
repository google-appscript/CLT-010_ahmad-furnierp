import { sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import { users, userRoles, rolePermissions, permissions } from '@/db/schema'

export type PenggunaDenganIzin = {
  id: string
  email: string
  nama: string
  passwordHash: string
  isActive: boolean
  izin: string[]
}

/**
 * Sengaja mengembalikan pengguna nonaktif alih-alih menyaringnya. Keputusan
 * menolak login adalah aturan bisnis milik lapisan layanan, bukan lapisan
 * akses data.
 */
export async function cariPenggunaLewatEmail(email: string): Promise<PenggunaDenganIzin | null> {
  const baris = await db
    .select({
      id: users.id,
      email: users.email,
      nama: users.nama,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
      kodeIzin: permissions.kode,
    })
    .from(users)
    .leftJoin(userRoles, sql`${userRoles.userId} = ${users.id}`)
    .leftJoin(rolePermissions, sql`${rolePermissions.roleId} = ${userRoles.roleId}`)
    .leftJoin(permissions, sql`${permissions.id} = ${rolePermissions.permissionId}`)
    .where(sql`lower(${users.email}) = lower(${email})`)

  if (baris.length === 0) return null

  const { id, nama, passwordHash, isActive, email: emailTersimpan } = baris[0]
  const izin = [...new Set(baris.map((b) => b.kodeIzin).filter((k): k is string => Boolean(k)))]
  return { id, email: emailTersimpan, nama, passwordHash, isActive, izin }
}
