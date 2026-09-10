import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { uraikanParameterDaftar, type ParameterDaftar } from '@/lib/daftar'
import { daftarFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelPencarian } from '@/components/data/panel-pencarian'
import { DaftarBom } from '../daftar-bom'

export const metadata = { title: 'Bill of Materials' }

const KUNCI_DAFTAR = 'manufaktur.bom'

export default async function HalamanBom({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesi = await wajibIzin('manufaktur.bom.lihat')

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
        judul="Bill of Materials"
        deskripsi="Resep bahan untuk setiap produk. Perintah produksi menyalin resep saat dibuat, sehingga mengubah resep tidak mengusik perintah yang sudah berjalan."
        aksi={
          <Button asChild>
            <Link href="/manufaktur/bom/baru"><Plus className="mr-2 h-4 w-4" />Buat Resep</Link>
          </Button>
        }
      />
      <PanelPencarian
        kunciDaftar={KUNCI_DAFTAR}
        kolomFilter={[
          {
            kunci: 'status',
            label: 'Status',
            opsi: [{ nilai: 'aktif', label: 'Aktif' }, { nilai: 'nonaktif', label: 'Nonaktif' }],
          },
        ]}
        kolomGroupBy={[]}
        favorit={favorit.map((f) => ({ ...f, kriteria: f.kriteria as ParameterDaftar }))}
      />
      <DaftarBom param={param} />
    </>
  )
}
