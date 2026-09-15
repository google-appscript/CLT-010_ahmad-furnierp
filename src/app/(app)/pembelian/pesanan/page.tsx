
import { wajibIzin } from '@/lib/sesi'
import { uraikanParameterDaftar, type ParameterDaftar } from '@/lib/daftar'
import { daftarFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { LABEL_STATUS_PEMBELIAN } from '@/modules/pembelian/validasi/pesanan'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelPencarian } from '@/components/data/panel-pencarian'
import { TombolBuat } from '@/components/data/tombol-aksi'
import { DaftarPesanan } from '../daftar-pesanan'

export const metadata = { title: 'Pesanan Pembelian' }

const KUNCI_DAFTAR = 'pembelian.pesanan'

export default async function HalamanPesanan({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesi = await wajibIzin('pembelian.pesanan.lihat')

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
        judul="Pesanan Pembelian"
        deskripsi="Seluruh dokumen pembelian beserta tahapannya."
        aksi={
          <TombolBuat href="/pembelian/pesanan/baru">Buat Permintaan</TombolBuat>
        }
      />
      <PanelPencarian
        kunciDaftar={KUNCI_DAFTAR}
        kolomFilter={[
          {
            kunci: 'status',
            label: 'Status',
            opsi: Object.entries(LABEL_STATUS_PEMBELIAN).map(([nilai, label]) => ({ nilai, label })),
          },
        ]}
        kolomGroupBy={[
          { kunci: 'status', label: 'Status' },
          { kunci: 'partnerId', label: 'Pemasok' },
        ]}
        favorit={favorit.map((f) => ({ ...f, kriteria: f.kriteria as ParameterDaftar }))}
      />
      <DaftarPesanan param={param} />
    </>
  )
}
