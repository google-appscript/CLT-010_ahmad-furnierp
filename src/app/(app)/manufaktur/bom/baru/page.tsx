import { wajibIzin } from '@/lib/sesi'
import { FormulirBom } from '../../formulir-bom'
import { ambilDataPilihanManufaktur } from '../../data-pilihan'

export const metadata = { title: 'Resep Baru' }

export default async function HalamanBomBaru() {
  await wajibIzin('manufaktur.bom.lihat')
  const { produk, satuan } = await ambilDataPilihanManufaktur()

  return (
    <FormulirBom
      awal={{
        kode: '', nama: '', produkId: '', kuantitas: '1', uomId: '', catatan: '', baris: [],
      }}
      produk={produk}
      satuan={satuan}
    />
  )
}
