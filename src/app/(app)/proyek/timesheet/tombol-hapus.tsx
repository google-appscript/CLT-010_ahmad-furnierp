'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TombolHapus } from '@/components/data/tombol-aksi'
import { aksiHapusTimesheet } from '../aksi'

export function TombolHapusTimesheet({ id }: { id: string }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <TombolHapus size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiHapusTimesheet(id)
        if (hasil.berhasil) { toast.success('Baris timesheet dihapus'); router.refresh() }
        else toast.error(hasil.pesan)
      })} />
  )
}
