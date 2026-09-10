import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DaftarPesanan } from '../daftar-pesanan'

export const metadata = { title: 'Permintaan Penawaran' }

export default async function HalamanPermintaan() {
  await wajibIzin('pembelian.permintaan.lihat')
  return (
    <>
      <KepalaHalaman
        judul="Permintaan Penawaran"
        deskripsi="Permintaan dan pesanan adalah dokumen yang sama pada tahap berbeda. Nomor diberikan saat dikonfirmasi."
        aksi={
          <Button asChild>
            <Link href="/pembelian/pesanan/baru">
              <Plus className="mr-2 h-4 w-4" />Buat Permintaan
            </Link>
          </Button>
        }
      />
      <DaftarPesanan param={{ halaman: 1, ukuranHalaman: 20, filter: { status: ['permintaan'] } }} />
    </>
  )
}
