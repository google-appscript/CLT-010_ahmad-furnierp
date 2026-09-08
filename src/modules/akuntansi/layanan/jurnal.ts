import { db } from '@/db/klien'
import { journals, sequences } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { skemaJurnal, labelTipeJurnal, type MasukanJurnal } from '../validasi/jurnal'
import * as repo from '../repositori/jurnal'
import type { Jurnal, TipeJurnal } from '../repositori/jurnal'

export type { Jurnal, TipeJurnal }
export { labelTipeJurnal }

export function kodeUrutanJurnal(kodeJurnal: string): string {
  return `jurnal:${kodeJurnal}`
}

function urai(masukan: MasukanJurnal) {
  const hasil = skemaJurnal.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

export async function daftarJurnal(tipe?: TipeJurnal): Promise<Jurnal[]> {
  return repo.ambilSemuaJurnal(tipe)
}

/**
 * Membuat jurnal beserta urutan penomorannya dalam satu transaksi. Bila salah
 * satu gagal, keduanya dibatalkan — tidak pernah ada jurnal tanpa urutan
 * maupun urutan tanpa jurnal.
 */
export async function buatJurnal(masukan: MasukanJurnal): Promise<Jurnal> {
  const data = urai(masukan)
  if (await repo.kodeJurnalTerpakai(data.kode)) {
    throw new ValidasiError(`Kode jurnal ${data.kode} sudah digunakan`)
  }

  return db.transaction(async (tx) => {
    const [urutan] = await tx.insert(sequences).values({
      kode: kodeUrutanJurnal(data.kode),
      prefix: data.prefixNomor,
      panjangDigit: 4,
      nomorBerikut: 1,
      reset: data.resetNomor,
    }).returning()

    const [jurnal] = await tx.insert(journals).values({
      kode: data.kode,
      nama: data.nama,
      tipe: data.tipe,
      sequenceId: urutan.id,
      akunDefaultDebitId: data.akunDefaultDebitId,
      akunDefaultKreditId: data.akunDefaultKreditId,
      mataUangId: data.mataUangId,
    }).returning()

    return jurnal
  })
}

/**
 * Mengubah jurnal tidak menyentuh urutan penomorannya. Mengganti kode jurnal
 * tidak boleh menomori ulang dokumen yang sudah terbit.
 */
export async function ubahJurnal(id: string, masukan: MasukanJurnal): Promise<Jurnal> {
  const data = urai(masukan)
  if (!(await repo.ambilJurnalLewatId(id))) throw new ValidasiError('Jurnal tidak ditemukan')
  if (await repo.kodeJurnalTerpakai(data.kode, id)) {
    throw new ValidasiError(`Kode jurnal ${data.kode} sudah digunakan`)
  }
  return repo.perbaruiJurnal(id, {
    kode: data.kode,
    nama: data.nama,
    tipe: data.tipe,
    akunDefaultDebitId: data.akunDefaultDebitId,
    akunDefaultKreditId: data.akunDefaultKreditId,
    mataUangId: data.mataUangId,
  })
}

export async function nonaktifkanJurnal(id: string): Promise<void> {
  if (!(await repo.ambilJurnalLewatId(id))) throw new ValidasiError('Jurnal tidak ditemukan')
  await repo.perbaruiJurnal(id, { isActive: false })
}

export async function aktifkanJurnal(id: string): Promise<void> {
  if (!(await repo.ambilJurnalLewatId(id))) throw new ValidasiError('Jurnal tidak ditemukan')
  await repo.perbaruiJurnal(id, { isActive: true })
}
