
import { wajibIzin } from '@/lib/sesi'
import { uraikanParameterDaftar, type ParameterDaftar } from '@/lib/daftar'
import { daftarFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { LABEL_STATUS_PENJUALAN } from '@/modules/penjualan/validasi/pesanan'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelPencarian } from '@/components/data/panel-pencarian'
import { TombolBuat } from '@/components/data/tombol-aksi'
import { DaftarPesanan } from '../daftar-pesanan'

export const metadata = { title: 'Pesanan Penjualan' }

const KUNCI_DAFTAR = 'penjualan.pesanan'

/** Penawaran punya layarnya sendiri dan tidak ikut muncul di sini. */
const CAKUPAN = ['dikonfirmasi', 'selesai', 'dibatalkan'] as const

export default async function HalamanPesanan({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesi = await wajibIzin('penjualan.pesanan.lihat')

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
        judul="Pesanan Penjualan"
        deskripsi="Komitmen yang sudah disepakati pelanggan, baik berasal dari penawaran maupun dibuat langsung."
        aksi={
          <TombolBuat href="/penjualan/pesanan/baru">Buat Pesanan</TombolBuat>
        }
      />
      <PanelPencarian
        kunciDaftar={KUNCI_DAFTAR}
        kolomFilter={[
          {
            kunci: 'status',
            label: 'Status',
            opsi: CAKUPAN.map((nilai) => ({ nilai, label: LABEL_STATUS_PENJUALAN[nilai] })),
          },
        ]}
        kolomGroupBy={[
          { kunci: 'status', label: 'Status' },
          { kunci: 'partnerId', label: 'Pelanggan' },
        ]}
        favorit={favorit.map((f) => ({ ...f, kriteria: f.kriteria as ParameterDaftar }))}
      />
      <DaftarPesanan param={{ ...param, statusTermasuk: [...CAKUPAN], bernomor: true }} />
    </>
  )
}
