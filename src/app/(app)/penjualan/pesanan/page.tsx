import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DaftarPesanan } from '../daftar-pesanan'

export const metadata = { title: 'Pesanan Penjualan' }

export default async function HalamanPesanan() {
  await wajibIzin('penjualan.pesanan.lihat')
  return (
    <>
      <KepalaHalaman
        judul="Pesanan Penjualan"
        deskripsi="Seluruh dokumen penjualan beserta tahapannya."
        aksi={
          <Button asChild>
            <Link href="/penjualan/pesanan/baru">
              <Plus className="mr-2 h-4 w-4" />Buat Penawaran
            </Link>
          </Button>
        }
      />
      <DaftarPesanan />
    </>
  )
}
