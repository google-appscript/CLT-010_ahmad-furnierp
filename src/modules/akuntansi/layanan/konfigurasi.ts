import { ValidasiError } from '@/lib/galat'
import {
  skemaKurs, skemaTahunBuku, skemaPerusahaan,
  type MasukanKurs, type MasukanTahunBuku, type MasukanPerusahaan,
} from '../validasi/konfigurasi'
import * as repo from '../repositori/konfigurasi'
import type { MataUang, TahunBuku, Pengaturan, BarisKurs } from '../repositori/konfigurasi'
import { MATA_UANG_FUNGSIONAL } from './kurs'

export type { MataUang, TahunBuku, Pengaturan, BarisKurs }

export async function daftarMataUang(): Promise<MataUang[]> {
  return repo.ambilSemuaMataUang()
}

export async function daftarKurs(kodeMataUang?: string): Promise<BarisKurs[]> {
  return repo.ambilSemuaKurs(kodeMataUang)
}

export async function catatKurs(masukan: MasukanKurs): Promise<void> {
  const hasil = skemaKurs.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  if (data.kodeMataUang === MATA_UANG_FUNGSIONAL) {
    throw new ValidasiError('Mata uang fungsional tidak memerlukan kurs')
  }
  if (!(await repo.mataUangAda(data.kodeMataUang))) {
    throw new ValidasiError(`Mata uang ${data.kodeMataUang} tidak terdaftar`)
  }

  await repo.simpanKurs(data.kodeMataUang, data.tanggal, data.kurs)
}

export async function daftarTahunBuku(): Promise<TahunBuku[]> {
  return repo.ambilSemuaTahunBuku()
}

export async function buatTahunBuku(masukan: MasukanTahunBuku): Promise<TahunBuku> {
  const hasil = skemaTahunBuku.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  if (await repo.namaTahunBukuTerpakai(data.nama)) {
    throw new ValidasiError(`Tahun buku ${data.nama} sudah ada`)
  }
  if (await repo.adaTahunBukuBertumpangTindih(data.tanggalMulai, data.tanggalSelesai)) {
    throw new ValidasiError('Rentang tanggal bertumpang tindih dengan tahun buku yang sudah ada')
  }

  return repo.sisipkanTahunBuku(data)
}

export async function ambilPengaturan(): Promise<Pengaturan | null> {
  return repo.ambilPengaturanPerusahaan()
}

export async function simpanProfilPerusahaan(masukan: MasukanPerusahaan): Promise<void> {
  const hasil = skemaPerusahaan.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)

  const pengaturan = await repo.ambilPengaturanPerusahaan()
  if (!pengaturan) throw new ValidasiError('Pengaturan perusahaan belum dibuat')

  await repo.perbaruiPengaturanPerusahaan(pengaturan.id, hasil.data)
}

/**
 * Tanggal kunci hanya boleh dimajukan atau dikosongkan sepenuhnya.
 * Memundurkannya akan membuka kembali periode yang laporannya mungkin sudah
 * dilaporkan ke pihak luar.
 */
export async function aturTanggalKunciBuku(tanggal: string | null): Promise<void> {
  const pengaturan = await repo.ambilPengaturanPerusahaan()
  if (!pengaturan) throw new ValidasiError('Pengaturan perusahaan belum dibuat')

  if (tanggal !== null && pengaturan.tanggalKunciBuku && tanggal < pengaturan.tanggalKunciBuku) {
    throw new ValidasiError(
      'Tanggal kunci tidak boleh dimundurkan. Kosongkan terlebih dahulu bila benar-benar perlu membuka periode.',
    )
  }

  await repo.perbaruiPengaturanPerusahaan(pengaturan.id, { tanggalKunciBuku: tanggal })
}
