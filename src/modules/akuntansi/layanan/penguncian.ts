import { db } from '@/db/klien'
import { companySettings } from '@/db/schema'

const BULAN_INDONESIA = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function formatTanggalIndonesia(tanggal: Date): string {
  return `${tanggal.getUTCDate()} ${BULAN_INDONESIA[tanggal.getUTCMonth()]} ${tanggal.getUTCFullYear()}`
}

export class PeriodeTerkunciError extends Error {
  constructor(tanggalKunci: Date) {
    super(
      `Periode akuntansi terkunci sampai ${formatTanggalIndonesia(tanggalKunci)}. ` +
      'Transaksi pada tanggal tersebut atau sebelumnya tidak dapat dibuat, diubah, maupun dihapus.',
    )
    this.name = 'PeriodeTerkunciError'
  }
}

async function ambilTanggalKunci(): Promise<Date | null> {
  const [pengaturan] = await db.select().from(companySettings).limit(1)
  if (!pengaturan?.tanggalKunciBuku) return null
  return new Date(`${pengaturan.tanggalKunciBuku}T00:00:00Z`)
}

// Perbandingan pada tingkat hari UTC. Tanpa normalisasi ini, transaksi pukul
// 10.00 pada tanggal kunci akan lolos padahal seharusnya ditolak.
function keHariUtc(tanggal: Date): number {
  return Date.UTC(tanggal.getUTCFullYear(), tanggal.getUTCMonth(), tanggal.getUTCDate())
}

export async function periodeTerkunci(tanggal: Date): Promise<boolean> {
  const kunci = await ambilTanggalKunci()
  if (!kunci) return false
  return keHariUtc(tanggal) <= keHariUtc(kunci)
}

export async function wajibPeriodeTerbuka(tanggal: Date): Promise<void> {
  const kunci = await ambilTanggalKunci()
  if (!kunci) return
  if (keHariUtc(tanggal) <= keHariUtc(kunci)) throw new PeriodeTerkunciError(kunci)
}
