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

export const metadata = { title: 'Nota Kredit' }

const KUNCI_DAFTAR = 'akuntansi.pelanggan.notakredit'

export default async function HalamanNotaKredit({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesi = await wajibIzin('akuntansi.nota-kredit.lihat')

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
        judul="Nota Kredit"
        deskripsi="Membalik arah faktur, dipakai untuk retur penjualan atau koreksi tagihan kepada pelanggan."
        aksi={
          <Button asChild>
            <Link href="/akuntansi/pelanggan/faktur/baru?tipe=nota_kredit">
              <Plus className="mr-2 h-4 w-4" />Buat Nota Kredit
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
      <DaftarFaktur tipe="nota_kredit" param={param} />
    </>
  )
}
