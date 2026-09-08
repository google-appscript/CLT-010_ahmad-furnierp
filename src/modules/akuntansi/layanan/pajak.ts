import { ValidasiError } from '@/lib/galat'
import { bagi, bulatkan, kali, kurang, tambah, type Uang } from '@/lib/uang'
import { skemaPajak, type MasukanPajak } from '../validasi/pajak'
import * as repo from '../repositori/pajak'
import type { Pajak, PajakBaru } from '../repositori/pajak'

export type { Pajak }

const DESIMAL_IDR = 2

/**
 * Memisahkan dasar pengenaan pajak dari nilai pajaknya.
 *
 * Bila hargaTermasukPajak bernilai benar, `nilai` dianggap bruto dan dasar
 * dihitung mundur. Pajak lalu diperoleh dengan mengurangkan dasar dari bruto,
 * bukan dengan mengalikan dasar dengan tarif — cara ini menjamin dasar dan
 * pajak selalu berjumlah tepat sama dengan bruto, tanpa selisih satu sen
 * akibat dua kali pembulatan.
 */
export function hitungPajak(
  nilai: Uang,
  tarif: Uang,
  hargaTermasukPajak: boolean,
): { dasar: Uang; pajak: Uang } {
  const pengali = bagi(tarif, 100)

  if (!hargaTermasukPajak) {
    return {
      dasar: bulatkan(nilai, DESIMAL_IDR),
      pajak: bulatkan(kali(nilai, pengali), DESIMAL_IDR),
    }
  }

  const dasar = bulatkan(bagi(nilai, tambah('1', pengali)), DESIMAL_IDR)
  return { dasar, pajak: bulatkan(kurang(bulatkan(nilai, DESIMAL_IDR), dasar), DESIMAL_IDR) }
}

function urai(masukan: MasukanPajak) {
  const hasil = skemaPajak.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

export async function daftarPajak(ruangLingkup?: 'penjualan' | 'pembelian'): Promise<Pajak[]> {
  return repo.ambilSemuaPajak(ruangLingkup)
}

export async function buatPajak(masukan: MasukanPajak): Promise<Pajak> {
  const data = urai(masukan)
  if (await repo.kodePajakTerpakai(data.kode)) {
    throw new ValidasiError(`Kode pajak ${data.kode} sudah digunakan`)
  }
  return repo.sisipkanPajak(data as PajakBaru)
}

export async function ubahPajak(id: string, masukan: MasukanPajak): Promise<Pajak> {
  const data = urai(masukan)
  if (!(await repo.ambilPajakLewatId(id))) throw new ValidasiError('Pajak tidak ditemukan')
  if (await repo.kodePajakTerpakai(data.kode, id)) {
    throw new ValidasiError(`Kode pajak ${data.kode} sudah digunakan`)
  }
  return repo.perbaruiPajak(id, data as Partial<PajakBaru>)
}

export async function nonaktifkanPajak(id: string): Promise<void> {
  if (!(await repo.ambilPajakLewatId(id))) throw new ValidasiError('Pajak tidak ditemukan')
  await repo.perbaruiPajak(id, { isActive: false })
}

export async function aktifkanPajak(id: string): Promise<void> {
  if (!(await repo.ambilPajakLewatId(id))) throw new ValidasiError('Pajak tidak ditemukan')
  await repo.perbaruiPajak(id, { isActive: true })
}
