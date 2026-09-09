import { sql } from 'drizzle-orm'
import type { Transaksi } from '@/db/klien'
import { sequences, sequencePeriods } from '@/db/schema'

type BarisUrutan = {
  id: string
  prefix: string
  panjang_digit: number
  nomor_berikut: number
  reset: 'tidak_pernah' | 'tahunan' | 'bulanan'
}

/** Periode pencacah untuk sebuah tanggal, sesuai aturan reset urutannya. */
function periode(reset: BarisUrutan['reset'], tanggal: Date): { tahun: number; bulan: number } {
  const tahun = tanggal.getUTCFullYear()
  const bulan = tanggal.getUTCMonth() + 1
  if (reset === 'bulanan') return { tahun, bulan }
  if (reset === 'tahunan') return { tahun, bulan: 0 }
  return { tahun: 0, bulan: 0 }
}

/**
 * Mengambil nomor dokumen berikutnya dan menaikkannya dalam satu transaksi.
 *
 * Baris definisi urutan dikunci dengan FOR UPDATE sehingga transaksi lain
 * menunggu — tanpa itu, posting serempak akan menghasilkan nomor kembar.
 * Pencacahnya sendiri disimpan per periode, sehingga dokumen yang dinomori
 * tidak berurutan menurut tanggal tetap mendapat nomor yang benar dan tidak
 * menabrak nomor yang sudah terbit di periode lain.
 */
export async function ambilNomorBerikut(
  tx: Transaksi,
  kodeUrutan: string,
  tanggal: Date,
): Promise<string> {
  const hasil = await tx.execute<BarisUrutan>(sql`
    SELECT id, prefix, panjang_digit, nomor_berikut, reset
    FROM ${sequences}
    WHERE kode = ${kodeUrutan}
    FOR UPDATE
  `)

  const baris = (hasil as unknown as BarisUrutan[])[0]
  if (!baris) throw new Error(`Urutan penomoran "${kodeUrutan}" tidak ditemukan`)

  const { tahun, bulan } = periode(baris.reset, tanggal)

  const alokasi = await tx.execute<{ nomor: number }>(sql`
    INSERT INTO ${sequencePeriods} (sequence_id, tahun, bulan, nomor_berikut)
    VALUES (${baris.id}, ${tahun}, ${bulan}, ${baris.nomor_berikut + 1})
    ON CONFLICT (sequence_id, tahun, bulan)
    DO UPDATE SET nomor_berikut = ${sequencePeriods}.nomor_berikut + 1
    RETURNING nomor_berikut - 1 AS nomor
  `)

  const nomor = (alokasi as unknown as { nomor: number }[])[0].nomor

  // padStart tidak memotong nilai yang lebih panjang dari target, sehingga
  // nomor ke-12345 pada urutan berpanjang dua digit tetap utuh.
  const berpadding = String(nomor).padStart(baris.panjang_digit, '0')

  switch (baris.reset) {
    case 'bulanan':
      return `${baris.prefix}/${tahun}/${String(bulan).padStart(2, '0')}/${berpadding}`
    case 'tahunan':
      return `${baris.prefix}/${tahun}/${berpadding}`
    default:
      return `${baris.prefix}/${berpadding}`
  }
}
