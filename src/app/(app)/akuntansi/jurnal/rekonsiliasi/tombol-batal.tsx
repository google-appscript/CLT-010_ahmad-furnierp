'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { aksiBatalkanRekonsiliasi } from './aksi'

export function TombolBatalRekonsiliasi({ id }: { id: string }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiBatalkanRekonsiliasi(id)
        if (hasil.berhasil) { toast.success('Rekonsiliasi dibatalkan'); router.refresh() }
        else toast.error(hasil.pesan)
      })}
    >
      Batalkan
    </Button>
  )
}
