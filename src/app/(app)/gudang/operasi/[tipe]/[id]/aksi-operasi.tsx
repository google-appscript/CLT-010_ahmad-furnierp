'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  aksiSelesaikanOperasi, aksiBatalkanOperasi, aksiHapusOperasi,
} from '../../aksi'

export function AksiDraftOperasi({ id, tipe }: { id: string; tipe: string }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  function jalankan(fn: () => Promise<{ berhasil: boolean; pesan?: string }>, sukses: string) {
    mulai(async () => {
      const hasil = await fn()
      // Penghapusan mengalihkan halaman; hanya kegagalan yang kembali ke sini.
      if (hasil && !hasil.berhasil) toast.error(hasil.pesan!)
      else if (hasil?.berhasil) { toast.success(sukses); router.refresh() }
    })
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={() => jalankan(
          () => aksiSelesaikanOperasi(id, tipe),
          'Operasi diselesaikan, stok dan jurnal sudah tercatat',
        )}
        disabled={bekerja}
      >
        {bekerja ? 'Memproses…' : 'Selesaikan'}
      </Button>
      <Button
        variant="outline" disabled={bekerja}
        onClick={() => jalankan(() => aksiBatalkanOperasi(id, tipe), 'Draft dibatalkan')}
      >
        Batalkan
      </Button>
      <Button
        variant="outline" disabled={bekerja}
        onClick={() => jalankan(() => aksiHapusOperasi(id, tipe), 'Draft dihapus')}
      >
        Hapus
      </Button>
    </div>
  )
}
