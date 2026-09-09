import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DaftarTagihan } from '../daftar-tagihan'

export const metadata = { title: 'Tagihan Pembelian' }

export default async function HalamanTagihan() {
  await wajibIzin('akuntansi.tagihan.lihat')
  return (
    <>
      <KepalaHalaman
        judul="Tagihan Pembelian"
        deskripsi="Memposting tagihan mendebit akun Penerimaan Barang Belum Ditagih, sehingga penampung yang dikredit saat barang diterima tertutup."
        aksi={
          <Button asChild>
            <Link href="/akuntansi/pemasok/tagihan/baru">
              <Plus className="mr-2 h-4 w-4" />Buat Tagihan
            </Link>
          </Button>
        }
      />
      <DaftarTagihan tipe="tagihan" />
    </>
  )
}
