'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { aksiUbahStatusBom } from '../../aksi'

export function TombolStatusBom({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="outline" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiUbahStatusBom(id, !isActive)
        if (hasil.berhasil) {
          toast.success(isActive ? 'Resep dinonaktifkan' : 'Resep diaktifkan kembali')
          router.refresh()
        } else {
          toast.error(hasil.pesan)
        }
      })}
    >
      {isActive ? 'Nonaktifkan' : 'Aktifkan'}
    </Button>
  )
}
