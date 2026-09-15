
import { wajibIzin } from '@/lib/sesi'
import { uraikanParameterDaftar, type ParameterDaftar } from '@/lib/daftar'
import { daftarFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { LABEL_STATUS_PROYEK } from '@/modules/proyek/validasi/proyek'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelPencarian } from '@/components/data/panel-pencarian'
import { TombolBuat } from '@/components/data/tombol-aksi'
import { DaftarProyek } from './daftar-proyek'

export const metadata = { title: 'Daftar Proyek' }

const KUNCI_DAFTAR = 'proyek.daftar'

export default async function HalamanDaftarProyek({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesi = await wajibIzin('proyek.proyek.kelola')

  const sp = await searchParams
  const params = new URLSearchParams()
  for (const [kunci, nilai] of Object.entries(sp)) {
    if (nilai === undefined) continue
    for (const v of Array.isArray(nilai) ? nilai : [nilai]) params.append(kunci, v)
  }
  const param = uraikanParameterDaftar(params)

  const favorit = await daftarFilter(sesi.penggunaId, KUNCI_DAFTAR)

  return (
    <>
      <KepalaHalaman
        judul="Daftar Proyek"
        deskripsi="Satu proyek memegang tepat satu pesanan penjualan, sehingga pendapatannya dapat dihitung tanpa alokasi."
        aksi={
          <TombolBuat href="/proyek/baru">Buat Proyek</TombolBuat>
        }
      />
      <PanelPencarian
        kunciDaftar={KUNCI_DAFTAR}
        kolomFilter={[
          {
            kunci: 'status',
            label: 'Status',
            opsi: Object.entries(LABEL_STATUS_PROYEK).map(([nilai, label]) => ({ nilai, label })),
          },
        ]}
        kolomGroupBy={[{ kunci: 'status', label: 'Status' }]}
        favorit={favorit.map((f) => ({ ...f, kriteria: f.kriteria as ParameterDaftar }))}
      />
      <DaftarProyek param={param} />
    </>
  )
}
