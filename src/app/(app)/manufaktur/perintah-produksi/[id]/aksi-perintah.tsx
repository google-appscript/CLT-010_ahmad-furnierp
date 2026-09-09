'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  aksiKonfirmasiPerintah, aksiSelesaikanPerintah,
  aksiBatalkanPerintah, aksiHapusPerintah,
} from '../../aksi'

type Hasil = { berhasil: boolean; pesan?: string }

function useJalankan() {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  function jalankan(fn: () => Promise<Hasil>, sukses: string, keDaftar = false) {
    mulai(async () => {
      const hasil = await fn()
      if (!hasil.berhasil) {
        toast.error(hasil.pesan!)
        return
      }
      toast.success(sukses)
      if (keDaftar) router.push('/manufaktur/perintah-produksi')
      else router.refresh()
    })
  }

  return { bekerja, jalankan }
}

export function AksiDraftPerintah({ id }: { id: string }) {
  const { bekerja, jalankan } = useJalankan()

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        disabled={bekerja}
        onClick={() => jalankan(() => aksiKonfirmasiPerintah(id), 'Perintah produksi dikonfirmasi')}
      >
        {bekerja ? 'Memproses…' : 'Konfirmasi'}
      </Button>
      <Button
        variant="outline" disabled={bekerja}
        onClick={() => jalankan(() => aksiBatalkanPerintah(id), 'Perintah produksi dibatalkan')}
      >
        Batalkan
      </Button>
      <Button
        variant="outline" disabled={bekerja}
        onClick={() => jalankan(() => aksiHapusPerintah(id), 'Draft dihapus', true)}
      >
        Hapus
      </Button>
    </div>
  )
}

export function AksiPerintahDikonfirmasi({ id }: { id: string }) {
  const { bekerja, jalankan } = useJalankan()

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        disabled={bekerja}
        onClick={() => jalankan(
          () => aksiSelesaikanPerintah(id),
          'Produksi selesai; bahan, biaya, dan barang jadi sudah dibukukan',
        )}
      >
        {bekerja ? 'Memproses…' : 'Selesaikan Produksi'}
      </Button>
      <Button
        variant="outline" disabled={bekerja}
        onClick={() => jalankan(() => aksiBatalkanPerintah(id), 'Perintah produksi dibatalkan')}
      >
        Batalkan
      </Button>
    </div>
  )
}
