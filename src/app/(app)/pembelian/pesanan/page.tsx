import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { uraikanParameterDaftar, type ParameterDaftar } from '@/lib/daftar'
import { daftarFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { LABEL_STATUS_PEMBELIAN } from '@/modules/pembelian/validasi/pesanan'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelPencarian } from '@/components/data/panel-pencarian'
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
          <Button asChild>
            <Link href="/pembelian/pesanan/baru">
              <Plus className="mr-2 h-4 w-4" />Buat Permintaan
            </Link>
          </Button>
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
