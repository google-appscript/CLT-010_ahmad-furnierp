import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { uraikanParameterDaftar, type ParameterDaftar } from '@/lib/daftar'
import { daftarFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { LABEL_STATUS_PERINTAH_PRODUKSI } from '@/modules/manufaktur/validasi/produksi'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelPencarian } from '@/components/data/panel-pencarian'
import { DaftarPerintah } from '../daftar-perintah'

export const metadata = { title: 'Perintah Produksi' }

const KUNCI_DAFTAR = 'manufaktur.perintah-produksi'

export default async function HalamanPerintahProduksi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesi = await wajibIzin('manufaktur.mo.lihat')

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
        judul="Perintah Produksi"
        deskripsi="Bahan keluar ke lokasi virtual Produksi, biaya konversi diserap, lalu barang jadi masuk gudang senilai seluruh biaya itu."
        aksi={
          <Button asChild>
            <Link href="/manufaktur/perintah-produksi/baru">
              <Plus className="mr-2 h-4 w-4" />Buat Perintah
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
            opsi: Object.entries(LABEL_STATUS_PERINTAH_PRODUKSI).map(([nilai, label]) => ({ nilai, label })),
          },
        ]}
        kolomGroupBy={[{ kunci: 'status', label: 'Status' }]}
        favorit={favorit.map((f) => ({ ...f, kriteria: f.kriteria as ParameterDaftar }))}
      />
      <DaftarPerintah param={param} />
    </>
  )
}
