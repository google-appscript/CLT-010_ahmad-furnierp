import { sql } from 'drizzle-orm'
import type { Transaksi } from '@/db/klien'
import { sequences } from '@/db/schema'

type BarisUrutan = {
  id: string
  prefix: string
  panjang_digit: number
  nomor_berikut: number
  reset: 'tidak_pernah' | 'tahunan' | 'bulanan'
  tahun_terakhir: number | null
  bulan_terakhir: number | null
}

/**
 * Mengambil nomor dokumen berikutnya dan menaikkannya dalam satu transaksi.
 * Baris urutan dikunci dengan FOR UPDATE sehingga transaksi lain menunggu —
 * tanpa itu, posting serempak akan menghasilkan nomor kembar.
 */
export async function ambilNomorBerikut(
  tx: Transaksi,
  kodeUrutan: string,
  tanggal: Date,
): Promise<string> {
  const hasil = await tx.execute<BarisUrutan>(sql`
    SELECT id, prefix, panjang_digit, nomor_berikut, reset, tahun_terakhir, bulan_terakhir
    FROM ${sequences}
    WHERE kode = ${kodeUrutan}
    FOR UPDATE
  `)

  const baris = (hasil as unknown as BarisUrutan[])[0]
  if (!baris) throw new Error(`Urutan penomoran "${kodeUrutan}" tidak ditemukan`)

  const tahun = tanggal.getUTCFullYear()
  const bulan = tanggal.getUTCMonth() + 1

  const perluReset =
    (baris.reset === 'tahunan' && baris.tahun_terakhir !== null && baris.tahun_terakhir !== tahun) ||
    (baris.reset === 'bulanan' &&
      ((baris.tahun_terakhir !== null && baris.tahun_terakhir !== tahun) ||
        (baris.bulan_terakhir !== null && baris.bulan_terakhir !== bulan)))

  const nomor = perluReset ? 1 : baris.nomor_berikut

  await tx.execute(sql`
    UPDATE ${sequences}
    SET nomor_berikut = ${nomor + 1}, tahun_terakhir = ${tahun}, bulan_terakhir = ${bulan}
    WHERE id = ${baris.id}
  `)

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
