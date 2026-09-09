import Link from 'next/link'
import { notFound } from 'next/navigation'
import { wajibIzin } from '@/lib/sesi'
import { ambilBom } from '@/modules/manufaktur/layanan/bom'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirBom } from '../../formulir-bom'
import { ambilDataPilihanManufaktur } from '../../data-pilihan'
import { TombolStatusBom } from './tombol-status'

export const metadata = { title: 'Detail Resep' }

export default async function HalamanDetailBom({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await wajibIzin('manufaktur.bom.lihat')
  const { id } = await params
  const bom = await ambilBom(id)
  if (!bom) notFound()

  const { produk, satuan } = await ambilDataPilihanManufaktur()

  return (
    <>
      <KepalaHalaman
        judul={bom.nama}
        deskripsi={bom.isActive
          ? 'Resep aktif dan dapat dipilih saat membuat perintah produksi.'
          : 'Resep nonaktif; perintah produksi yang sudah merujuknya tetap utuh.'}
        aksi={
          <div className="flex gap-3">
            <TombolStatusBom id={bom.id} isActive={bom.isActive} />
            <Button asChild variant="outline">
              <Link href="/manufaktur/bom">Kembali</Link>
            </Button>
          </div>
        }
      />
      <FormulirBom
        awal={{
          id: bom.id,
          kode: bom.kode,
          nama: bom.nama,
          produkId: bom.produkId,
          kuantitas: String(Number(bom.kuantitas)),
          uomId: bom.uomId,
          catatan: bom.catatan ?? '',
          baris: bom.baris.map((b) => ({
            produkId: b.produkId,
            kuantitas: String(Number(b.kuantitas)),
            uomId: b.uomId,
          })),
        }}
        produk={produk}
        satuan={satuan}
      />
    </>
  )
}
