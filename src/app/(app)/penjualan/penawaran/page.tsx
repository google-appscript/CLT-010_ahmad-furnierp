import { wajibIzin } from '@/lib/sesi'
import { uraikanParameterDaftar, type ParameterDaftar } from '@/lib/daftar'
import { daftarFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelPencarian } from '@/components/data/panel-pencarian'
import { TombolBuat } from '@/components/data/tombol-aksi'
import { DaftarPesanan } from '../daftar-pesanan'

export const metadata = { title: 'Penawaran' }

const KUNCI_DAFTAR = 'penjualan.penawaran'

/**
 * Penawaran yang sudah dikonfirmasi tetap tercatat di sini. Daftar ini adalah
 * riwayat penawaran, jadi menghilangkan yang berhasil justru menyembunyikan
 * kabar baiknya — statusnya yang menerangkan sudah sampai mana.
 */
const CAKUPAN = ['penawaran', 'dikonfirmasi', 'selesai', 'dibatalkan'] as const

export default async function HalamanPenawaran({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesi = await wajibIzin('penjualan.penawaran.lihat')

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
        judul="Penawaran"
        deskripsi="Riwayat tawaran harga kepada pelanggan. Yang disetujui dikonfirmasi menjadi pesanan penjualan dan tetap tercatat di sini, sisanya ditolak."
        aksi={<TombolBuat href="/penjualan/penawaran/baru">Buat Penawaran</TombolBuat>}
      />
      <PanelPencarian
        kunciDaftar={KUNCI_DAFTAR}
        kolomFilter={[
          {
            kunci: 'status',
            label: 'Status',
            opsi: [
              { nilai: 'penawaran', label: 'Menunggu Keputusan' },
              { nilai: 'dikonfirmasi', label: 'Jadi Pesanan' },
              { nilai: 'selesai', label: 'Jadi Pesanan (Selesai)' },
              { nilai: 'dibatalkan', label: 'Ditolak' },
            ],
          },
        ]}
        kolomGroupBy={[
          { kunci: 'status', label: 'Status' },
          { kunci: 'partnerId', label: 'Pelanggan' },
        ]}
        favorit={favorit.map((f) => ({ ...f, kriteria: f.kriteria as ParameterDaftar }))}
      />
      <DaftarPesanan
        param={{ ...param, statusTermasuk: [...CAKUPAN], lewatPenawaran: true }}
        basisRute="/penjualan/penawaran"
        labelDitolak
      />
    </>
  )
}
