'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { aksiPostingTagihan, aksiBatalkanTagihan, aksiHapusTagihan } from '../../aksi'

export function AksiDraftTagihan({ id }: { id: string }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  function jalankan(fn: () => Promise<{ berhasil: boolean; pesan?: string }>, sukses: string) {
    mulai(async () => {
      const hasil = await fn()
      if (hasil && !hasil.berhasil) toast.error(hasil.pesan!)
      else if (hasil?.berhasil) { toast.success(sukses); router.refresh() }
    })
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={() => jalankan(() => aksiPostingTagihan(id), 'Tagihan diposting ke buku besar')}
        disabled={bekerja}
      >
        {bekerja ? 'Memproses…' : 'Posting'}
      </Button>
      <Button
        variant="outline" disabled={bekerja}
        onClick={() => jalankan(() => aksiBatalkanTagihan(id), 'Draft dibatalkan')}
      >
        Batalkan
      </Button>
      <Button
        variant="outline" disabled={bekerja}
        onClick={() => jalankan(() => aksiHapusTagihan(id), 'Draft dihapus')}
      >
        Hapus
      </Button>
    </div>
  )
}
