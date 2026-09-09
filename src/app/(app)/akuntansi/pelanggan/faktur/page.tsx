import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DaftarFaktur } from '../daftar-faktur'

export const metadata = { title: 'Faktur Penjualan' }

export default async function HalamanFaktur() {
  await wajibIzin('akuntansi.faktur.lihat')
  return (
    <>
      <KepalaHalaman
        judul="Faktur Penjualan"
        deskripsi="Mencatat pendapatan dan piutang. Harga pokok sudah dibebankan lebih dulu saat barang dikirim."
        aksi={
          <Button asChild>
            <Link href="/akuntansi/pelanggan/faktur/baru">
              <Plus className="mr-2 h-4 w-4" />Buat Faktur
            </Link>
          </Button>
        }
      />
      <DaftarFaktur tipe="faktur" />
    </>
  )
}
