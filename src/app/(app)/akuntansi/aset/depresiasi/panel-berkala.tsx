'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatRupiah } from '@/lib/uang'
import { aksiPostingBerkala } from '../aksi'

export function PanelPostingBerkala({
  sampaiTanggal, jumlahJatuhTempo, totalJatuhTempo,
}: {
  sampaiTanggal: string
  jumlahJatuhTempo: number
  totalJatuhTempo: string
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()
  const [tanggal, setTanggal] = useState(sampaiTanggal)

  return (
    <div className="mb-6 flex flex-wrap items-end gap-4 rounded-md border p-4">
      <div className="space-y-2">
        <Label htmlFor="sampai">Sampai Tanggal</Label>
        <Input
          id="sampai" type="date" value={tanggal}
          onChange={(e) => setTanggal(e.target.value)}
          className="w-48"
        />
      </div>

      <Button
        variant="outline"
        onClick={() => router.push(`/akuntansi/aset/depresiasi?sampai=${tanggal}`)}
      >
        Tampilkan
      </Button>

      <div className="flex-1 text-sm text-muted-foreground">
        {jumlahJatuhTempo === 0
          ? 'Tidak ada depresiasi yang jatuh tempo pada tanggal itu.'
          : `${jumlahJatuhTempo} baris jatuh tempo senilai ${formatRupiah(totalJatuhTempo)}.`}
      </div>

      <Button
        disabled={bekerja || jumlahJatuhTempo === 0}
        onClick={() => mulai(async () => {
          const hasil = await aksiPostingBerkala(tanggal)
          if (hasil.berhasil) {
            toast.success('Depresiasi yang jatuh tempo sudah diposting')
            router.refresh()
          } else {
            toast.error(hasil.pesan)
          }
        })}
      >
        {bekerja ? 'Memproses…' : 'Posting Semua yang Jatuh Tempo'}
      </Button>
    </div>
  )
}
