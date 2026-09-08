import { desc, eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { auditLogs, users } from '@/db/schema'

export type AksiAudit = 'buat' | 'ubah' | 'hapus' | 'posting' | 'balik' | 'masuk'

export type MasukanAudit = {
  penggunaId: string | null
  entitas: string
  entitasId: string | null
  aksi: AksiAudit
  dataLama?: unknown
  dataBaru?: unknown
  alamatIp?: string | null
}

export type BarisAudit = {
  id: string
  entitas: string
  entitasId: string | null
  aksi: AksiAudit
  namaPengguna: string | null
  waktu: Date
  dataLama: unknown
  dataBaru: unknown
}

/**
 * Mencatat jejak perubahan. Kegagalan pencatatan sengaja ditelan dan hanya
 * dicetak ke konsol: log yang gagal tidak boleh membatalkan transaksi bisnis
 * yang sudah berhasil.
 */
export async function catatAudit(masukan: MasukanAudit): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: masukan.penggunaId,
      entitas: masukan.entitas,
      entitasId: masukan.entitasId,
      aksi: masukan.aksi,
      dataLama: masukan.dataLama ?? null,
      dataBaru: masukan.dataBaru ?? null,
      alamatIp: masukan.alamatIp ?? null,
    })
  } catch (galat) {
    console.error('Gagal mencatat log aktivitas:', galat)
  }
}

export async function daftarAudit(batas = 200): Promise<BarisAudit[]> {
  const baris = await db
    .select({
      id: auditLogs.id,
      entitas: auditLogs.entitas,
      entitasId: auditLogs.entitasId,
      aksi: auditLogs.aksi,
      namaPengguna: users.nama,
      waktu: auditLogs.waktu,
      dataLama: auditLogs.dataLama,
      dataBaru: auditLogs.dataBaru,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .orderBy(desc(auditLogs.waktu), desc(auditLogs.id))
    .limit(batas)

  return baris as BarisAudit[]
}
