import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DaftarPesanan } from '../daftar-pesanan'

export const metadata = { title: 'Pesanan Pembelian' }

export default async function HalamanPesanan() {
  await wajibIzin('pembelian.pesanan.lihat')
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
      <DaftarPesanan />
    </>
  )
}
