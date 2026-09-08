import { and, desc, eq, lte } from 'drizzle-orm'
import { db } from '@/db/klien'
import { currencyRates } from '@/db/schema'
import { bulatkan, kali, type Uang } from '@/lib/uang'
import { formatTanggalIndonesia } from './penguncian'

export const MATA_UANG_FUNGSIONAL = 'IDR'
const DESIMAL_IDR = 2

export class KursTidakDitemukanError extends Error {
  constructor(kodeMataUang: string, tanggal: Date) {
    super(
      `Kurs ${kodeMataUang} untuk tanggal ${formatTanggalIndonesia(tanggal)} belum tersedia. ` +
      'Masukkan kurs melalui menu Mata Uang & Kurs terlebih dahulu.',
    )
    this.name = 'KursTidakDitemukanError'
  }
}

function keTanggalIso(tanggal: Date): string {
  return tanggal.toISOString().slice(0, 10)
}

/**
 * Kurs bermakna jumlah IDR per satu unit mata uang asing. Bila tanggal
 * persisnya tidak tercatat, dipakai kurs terakhir yang berlaku sebelum
 * tanggal transaksi — kurs bertanggal setelahnya tidak pernah dipakai.
 */
export async function ambilKurs(kodeMataUang: string, tanggal: Date): Promise<Uang> {
  if (kodeMataUang === MATA_UANG_FUNGSIONAL) return '1'

  const [baris] = await db
    .select({ kurs: currencyRates.kurs })
    .from(currencyRates)
    .where(and(
      eq(currencyRates.kodeMataUang, kodeMataUang),
      lte(currencyRates.tanggal, keTanggalIso(tanggal)),
    ))
    .orderBy(desc(currencyRates.tanggal))
    .limit(1)

  if (!baris) throw new KursTidakDitemukanError(kodeMataUang, tanggal)

  // PostgreSQL mengembalikan numeric berpadding nol ('16250.000000');
  // buang nol di belakang tanpa melewatkan nilai uang melalui Number.
  return baris.kurs.replace(/\.?0+$/, '') || '0'
}

export async function konversiKeIdr(
  nilai: Uang,
  kodeMataUang: string,
  tanggal: Date,
): Promise<Uang> {
  if (kodeMataUang === MATA_UANG_FUNGSIONAL) return nilai
  const kurs = await ambilKurs(kodeMataUang, tanggal)
  return bulatkan(kali(nilai, kurs), DESIMAL_IDR)
}
