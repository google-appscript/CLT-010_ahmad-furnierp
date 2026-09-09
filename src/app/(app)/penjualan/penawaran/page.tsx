import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DaftarPesanan } from '../daftar-pesanan'

export const metadata = { title: 'Penawaran' }

export default async function HalamanPenawaran() {
  await wajibIzin('penjualan.penawaran.lihat')
  return (
    <>
      <KepalaHalaman
        judul="Penawaran"
        deskripsi="Penawaran dan pesanan penjualan adalah dokumen yang sama pada tahap berbeda. Nomor diberikan saat dikonfirmasi."
        aksi={
          <Button asChild>
            <Link href="/penjualan/pesanan/baru">
              <Plus className="mr-2 h-4 w-4" />Buat Penawaran
            </Link>
          </Button>
        }
      />
      <DaftarPesanan status="penawaran" />
    </>
  )
}
