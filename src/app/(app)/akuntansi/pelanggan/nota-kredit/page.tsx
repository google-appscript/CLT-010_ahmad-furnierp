import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DaftarFaktur } from '../daftar-faktur'

export const metadata = { title: 'Nota Kredit' }

export default async function HalamanNotaKredit() {
  await wajibIzin('akuntansi.nota-kredit.lihat')
  return (
    <>
      <KepalaHalaman
        judul="Nota Kredit"
        deskripsi="Membalik arah faktur, dipakai untuk retur penjualan atau koreksi tagihan kepada pelanggan."
        aksi={
          <Button asChild>
            <Link href="/akuntansi/pelanggan/faktur/baru?tipe=nota_kredit">
              <Plus className="mr-2 h-4 w-4" />Buat Nota Kredit
            </Link>
          </Button>
        }
      />
      <DaftarFaktur tipe="nota_kredit" />
    </>
  )
}
