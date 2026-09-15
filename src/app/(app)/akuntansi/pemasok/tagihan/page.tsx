
import { wajibIzin } from '@/lib/sesi'
import { uraikanParameterDaftar, type ParameterDaftar } from '@/lib/daftar'
import { daftarFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { LABEL_STATUS_TAGIHAN } from '@/modules/pembelian/validasi/pesanan'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelPencarian } from '@/components/data/panel-pencarian'
import { TombolBuat } from '@/components/data/tombol-aksi'
import { DaftarTagihan } from '../daftar-tagihan'

export const metadata = { title: 'Tagihan Pembelian' }

const KUNCI_DAFTAR = 'akuntansi.pemasok.tagihan'

export default async function HalamanTagihan({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesi = await wajibIzin('akuntansi.tagihan.lihat')

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
        judul="Tagihan Pembelian"
        deskripsi="Memposting tagihan mendebit akun Penerimaan Barang Belum Ditagih, sehingga penampung yang dikredit saat barang diterima tertutup."
        aksi={
          <TombolBuat href="/akuntansi/pemasok/tagihan/baru">Buat Tagihan</TombolBuat>
        }
      />
      <PanelPencarian
        kunciDaftar={KUNCI_DAFTAR}
        kolomFilter={[
          {
            kunci: 'status',
            label: 'Status',
            opsi: Object.entries(LABEL_STATUS_TAGIHAN).map(([nilai, label]) => ({ nilai, label })),
          },
        ]}
        kolomGroupBy={[
          { kunci: 'status', label: 'Status' },
          { kunci: 'partnerId', label: 'Pemasok' },
        ]}
        favorit={favorit.map((f) => ({ ...f, kriteria: f.kriteria as ParameterDaftar }))}
      />
      <DaftarTagihan tipe="tagihan" param={param} />
    </>
  )
}
