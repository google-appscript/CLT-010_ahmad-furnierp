import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DaftarTagihan } from '../daftar-tagihan'

export const metadata = { title: 'Nota Debit' }

export default async function HalamanNotaDebit() {
  await wajibIzin('akuntansi.nota-debit.lihat')
  return (
    <>
      <KepalaHalaman
        judul="Nota Debit"
        deskripsi="Membalik arah tagihan, dipakai untuk retur barang atau koreksi tagihan pemasok."
        aksi={
          <Button asChild>
            <Link href="/akuntansi/pemasok/tagihan/baru?tipe=nota_debit">
              <Plus className="mr-2 h-4 w-4" />Buat Nota Debit
            </Link>
          </Button>
        }
      />
      <DaftarTagihan tipe="nota_debit" />
    </>
  )
}
