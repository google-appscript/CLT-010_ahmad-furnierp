import { asc, sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import { roles, rolePermissions, permissions, userRoles } from '@/db/schema'

export type PeranDenganIzin = {
  id: string
  kode: string
  nama: string
  isSystem: boolean
  izin: string[]
  jumlahPengguna: number
}

export async function daftarPeranDenganIzin(): Promise<PeranDenganIzin[]> {
  const baris = await db
    .select({
      id: roles.id,
      kode: roles.kode,
      nama: roles.nama,
      isSystem: roles.isSystem,
      kodeIzin: permissions.kode,
    })
    .from(roles)
    .leftJoin(rolePermissions, sql`${rolePermissions.roleId} = ${roles.id}`)
    .leftJoin(permissions, sql`${permissions.id} = ${rolePermissions.permissionId}`)
    .orderBy(asc(roles.kode))

  const hitungan = await db
    .select({ roleId: userRoles.roleId, jumlah: sql<number>`count(*)::int` })
    .from(userRoles)
    .groupBy(userRoles.roleId)

  const jumlahLewatPeran = new Map(hitungan.map((h) => [h.roleId, h.jumlah]))
  const terkumpul = new Map<string, PeranDenganIzin>()

  for (const b of baris) {
    const sudahAda = terkumpul.get(b.id) ?? {
      id: b.id, kode: b.kode, nama: b.nama, isSystem: b.isSystem,
      izin: [], jumlahPengguna: jumlahLewatPeran.get(b.id) ?? 0,
    }
    if (b.kodeIzin) sudahAda.izin.push(b.kodeIzin)
    terkumpul.set(b.id, sudahAda)
  }

  return [...terkumpul.values()]
}
