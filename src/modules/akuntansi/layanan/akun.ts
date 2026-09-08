import { ValidasiError } from '@/lib/galat'
import { skemaAkun, type MasukanAkun } from '../validasi/akun'
import * as repo from '../repositori/akun'
import type { Akun } from '../repositori/akun'

export type { Akun }

function urai(masukan: MasukanAkun) {
  const hasil = skemaAkun.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

export async function daftarAkun(): Promise<Akun[]> {
  return repo.ambilSemuaAkun()
}

export async function buatAkun(masukan: MasukanAkun): Promise<Akun> {
  const data = urai(masukan)
  if (await repo.kodeAkunTerpakai(data.kode)) {
    throw new ValidasiError(`Kode akun ${data.kode} sudah digunakan`)
  }
  return repo.sisipkanAkun(data as repo.AkunBaru)
}

export async function ubahAkun(id: string, masukan: MasukanAkun): Promise<Akun> {
  const data = urai(masukan)
  if (!(await repo.ambilAkunLewatId(id))) throw new ValidasiError('Akun tidak ditemukan')
  if (await repo.kodeAkunTerpakai(data.kode, id)) {
    throw new ValidasiError(`Kode akun ${data.kode} sudah digunakan`)
  }
  return repo.perbaruiAkun(id, data as Partial<repo.AkunBaru>)
}

/**
 * Akun tidak pernah dihapus karena dapat sudah dirujuk item jurnal.
 * Menonaktifkan menyembunyikannya dari pilihan tanpa merusak riwayat.
 */
export async function nonaktifkanAkun(id: string): Promise<void> {
  if (!(await repo.ambilAkunLewatId(id))) throw new ValidasiError('Akun tidak ditemukan')
  await repo.perbaruiAkun(id, { isActive: false })
}

export async function aktifkanAkun(id: string): Promise<void> {
  if (!(await repo.ambilAkunLewatId(id))) throw new ValidasiError('Akun tidak ditemukan')
  await repo.perbaruiAkun(id, { isActive: true })
}
