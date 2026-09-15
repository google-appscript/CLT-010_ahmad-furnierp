'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CircleCheck, CircleX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { TombolHapus } from '@/components/data/tombol-aksi'
import { aksiKonfirmasiPesanan, aksiBatalkanPesanan, aksiHapusPenawaran } from '../../aksi'

export function AksiPenawaran({ id }: { id: string }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  function jalankan(
    fn: () => Promise<{ berhasil: boolean; pesan?: string }>,
    sukses: string,
    tujuan?: string,
  ) {
    mulai(async () => {
      const hasil = await fn()
      if (hasil && !hasil.berhasil) {
        toast.error(hasil.pesan!)
        return
      }
      toast.success(sukses)
      if (tujuan) router.push(tujuan)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        disabled={bekerja}
        onClick={() => jalankan(
          () => aksiKonfirmasiPesanan(id),
          'Penawaran menjadi pesanan penjualan',
          `/penjualan/pesanan/${id}`,
        )}
      >
        <CircleCheck />
        {bekerja ? 'Memproses…' : 'Jadikan Pesanan Penjualan'}
      </Button>
      <Button
        variant="outline" disabled={bekerja}
        onClick={() => jalankan(() => aksiBatalkanPesanan(id), 'Penawaran ditolak')}
      >
        <CircleX />
        Tolak
      </Button>
      <TombolHapus
        size="default" disabled={bekerja}
        onClick={() => jalankan(() => aksiHapusPenawaran(id), 'Penawaran dihapus')}
      />
    </div>
  )
}
