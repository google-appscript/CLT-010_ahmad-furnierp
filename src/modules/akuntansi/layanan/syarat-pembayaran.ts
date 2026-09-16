import { eq } from 'drizzle-orm'
import type { Transaksi } from '@/db/klien'
import { paymentTerms, partners } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { skemaSyaratPembayaran, type MasukanSyaratPembayaran } from '../validasi/pajak'
import * as repo from '../repositori/pajak'
import type { SyaratPembayaran, SyaratPembayaranBaru } from '../repositori/pajak'

export type { SyaratPembayaran }

export function hitungJatuhTempo(tanggalFaktur: Date, jumlahHari: number): Date {
  const jatuhTempo = new Date(tanggalFaktur)
  jatuhTempo.setUTCDate(jatuhTempo.getUTCDate() + jumlahHari)
  return jatuhTempo
}

export type TempoDokumen = {
  syaratPembayaranId: string | null
  tanggalJatuhTempo: string | null
}

/**
 * Menentukan syarat pembayaran dan tanggal jatuh tempo sebuah dokumen.
 *
 * Syaratnya dicari berjenjang: yang dipilih pada dokumen, lalu yang tertulis
 * pada pesanan asalnya, lalu bawaan mitranya. Tanggal jatuh tempo diturunkan
 * darinya lalu ikut disimpan, bukan dihitung ulang setiap laporan dibuka —
 * syarat boleh berubah kapan saja, sedangkan tempo yang sudah dijanjikan pada
 * sebuah faktur tidak boleh ikut bergeser. Tempo yang diketik manual selalu
 * menang, karena kesepakatan khusus dengan satu pelanggan adalah hal biasa.
 */
export async function tempoDokumenDalamTx(
  tx: Transaksi,
  masukan: {
    tanggal: string
    partnerId: string
    syaratPembayaranId?: string | null
    syaratPesananId?: string | null
    tanggalJatuhTempo?: string | null
  },
): Promise<TempoDokumen> {
  if (masukan.tanggalJatuhTempo) {
    return {
      syaratPembayaranId: masukan.syaratPembayaranId ?? masukan.syaratPesananId ?? null,
      tanggalJatuhTempo: masukan.tanggalJatuhTempo,
    }
  }

  let syaratId = masukan.syaratPembayaranId ?? masukan.syaratPesananId ?? null
  if (!syaratId) {
    const [mitra] = await tx.select({ syaratPembayaranId: partners.syaratPembayaranId })
      .from(partners).where(eq(partners.id, masukan.partnerId)).limit(1)
    syaratId = mitra?.syaratPembayaranId ?? null
  }
  if (!syaratId) return { syaratPembayaranId: null, tanggalJatuhTempo: null }

  const [syarat] = await tx.select().from(paymentTerms)
    .where(eq(paymentTerms.id, syaratId)).limit(1)
  if (!syarat) return { syaratPembayaranId: null, tanggalJatuhTempo: null }

  const jatuhTempo = hitungJatuhTempo(
    new Date(`${masukan.tanggal}T00:00:00Z`), syarat.jumlahHari,
  )
  return {
    syaratPembayaranId: syaratId,
    tanggalJatuhTempo: jatuhTempo.toISOString().slice(0, 10),
  }
}

function urai(masukan: MasukanSyaratPembayaran) {
  const hasil = skemaSyaratPembayaran.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

export async function daftarSyaratPembayaran(): Promise<SyaratPembayaran[]> {
  return repo.ambilSemuaSyarat()
}

export async function buatSyaratPembayaran(
  masukan: MasukanSyaratPembayaran,
): Promise<SyaratPembayaran> {
  const data = urai(masukan)
  if (await repo.namaSyaratTerpakai(data.nama)) {
    throw new ValidasiError(`Syarat pembayaran ${data.nama} sudah ada`)
  }
  return repo.sisipkanSyarat(data as SyaratPembayaranBaru)
}

export async function ubahSyaratPembayaran(
  id: string, masukan: MasukanSyaratPembayaran,
): Promise<SyaratPembayaran> {
  const data = urai(masukan)
  if (!(await repo.ambilSyaratLewatId(id))) {
    throw new ValidasiError('Syarat pembayaran tidak ditemukan')
  }
  if (await repo.namaSyaratTerpakai(data.nama, id)) {
    throw new ValidasiError(`Syarat pembayaran ${data.nama} sudah ada`)
  }
  return repo.perbaruiSyarat(id, data as Partial<SyaratPembayaranBaru>)
}
