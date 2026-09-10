import { notFound } from 'next/navigation'
import { wajibIzin } from '@/lib/sesi'
import { ambilBom } from '@/modules/manufaktur/layanan/bom'
import { Badge } from '@/components/ui/badge'
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
      statusBadge={<Badge variant={bom.isActive ? 'default' : 'outline'}>{bom.isActive ? 'Aktif' : 'Nonaktif'}</Badge>}
      aksiTambahan={<TombolStatusBom key="status" id={bom.id} isActive={bom.isActive} />}
    />
  )
}
