import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { uraikanParameterDaftar, type ParameterDaftar } from '@/lib/daftar'
import { daftarFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { LABEL_STATUS_FAKTUR } from '@/modules/penjualan/validasi/pesanan'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelPencarian } from '@/components/data/panel-pencarian'
import { DaftarFaktur } from '../daftar-faktur'

export const metadata = { title: 'Faktur Penjualan' }

const KUNCI_DAFTAR = 'akuntansi.pelanggan.faktur'

export default async function HalamanFaktur({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesi = await wajibIzin('akuntansi.faktur.lihat')

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
        judul="Faktur Penjualan"
        deskripsi="Mencatat pendapatan dan piutang. Harga pokok sudah dibebankan lebih dulu saat barang dikirim."
        aksi={
          <Button asChild>
            <Link href="/akuntansi/pelanggan/faktur/baru">
              <Plus className="mr-2 h-4 w-4" />Buat Faktur
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
            opsi: Object.entries(LABEL_STATUS_FAKTUR).map(([nilai, label]) => ({ nilai, label })),
          },
        ]}
        kolomGroupBy={[
          { kunci: 'status', label: 'Status' },
          { kunci: 'partnerId', label: 'Pelanggan' },
        ]}
        favorit={favorit.map((f) => ({ ...f, kriteria: f.kriteria as ParameterDaftar }))}
      />
      <DaftarFaktur tipe="faktur" param={param} />
    </>
  )
}
