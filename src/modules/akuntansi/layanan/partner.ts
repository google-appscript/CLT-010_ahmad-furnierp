import { ValidasiError } from '@/lib/galat'
import { skemaPartner, type MasukanPartner } from '../validasi/partner'
import * as repo from '../repositori/partner'
import type { Partner, SaringPartner, PartnerBaru } from '../repositori/partner'

export type { Partner, SaringPartner }

function urai(masukan: MasukanPartner) {
  const hasil = skemaPartner.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

export async function daftarPartner(saring: SaringPartner = {}): Promise<Partner[]> {
  return repo.ambilSemuaPartner(saring)
}

export async function buatPartner(masukan: MasukanPartner): Promise<Partner> {
  const data = urai(masukan)
  if (await repo.kodePartnerTerpakai(data.kode)) {
    throw new ValidasiError(`Kode mitra ${data.kode} sudah digunakan`)
  }
  return repo.sisipkanPartner(data as PartnerBaru)
}

export async function ubahPartner(id: string, masukan: MasukanPartner): Promise<Partner> {
  const data = urai(masukan)
  if (!(await repo.ambilPartnerLewatId(id))) throw new ValidasiError('Mitra tidak ditemukan')
  if (await repo.kodePartnerTerpakai(data.kode, id)) {
    throw new ValidasiError(`Kode mitra ${data.kode} sudah digunakan`)
  }
  return repo.perbaruiPartner(id, data as Partial<PartnerBaru>)
}

export async function nonaktifkanPartner(id: string): Promise<void> {
  if (!(await repo.ambilPartnerLewatId(id))) throw new ValidasiError('Mitra tidak ditemukan')
  await repo.perbaruiPartner(id, { isActive: false })
}

export async function aktifkanPartner(id: string): Promise<void> {
  if (!(await repo.ambilPartnerLewatId(id))) throw new ValidasiError('Mitra tidak ditemukan')
  await repo.perbaruiPartner(id, { isActive: true })
}
