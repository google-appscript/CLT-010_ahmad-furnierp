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
