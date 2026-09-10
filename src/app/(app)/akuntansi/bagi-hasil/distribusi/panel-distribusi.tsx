'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LABEL_PERIODE_BAGI_HASIL } from '@/modules/kepemilikan/validasi/kepemilikan'
import {
  aksiKunciBagiHasil, aksiBukaKunciBagiHasil, aksiAturPeriodeBagiHasil,
} from '../aksi'

export function PemilihPeriodeBagiHasil({ nilai }: { nilai: string }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <div className="space-y-2">
      <Label htmlFor="periodeBagiHasil">Panjang Periode</Label>
      <Select
        value={nilai}
        disabled={bekerja}
        onValueChange={(v) => mulai(async () => {
          const hasil = await aksiAturPeriodeBagiHasil(v as never)
          if (hasil.berhasil) {
            toast.success('Panjang periode bagi hasil disimpan')
            router.refresh()
          } else toast.error(hasil.pesan)
        })}
      >
        <SelectTrigger id="periodeBagiHasil" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(LABEL_PERIODE_BAGI_HASIL).map(([n, l]) => (
            <SelectItem key={n} value={n}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function PemilihTahun({ tahun }: { tahun: number }) {
  const router = useRouter()
  const kini = new Date().getUTCFullYear()
  const pilihan = Array.from({ length: 7 }, (_, i) => kini - 3 + i)

  return (
    <div className="space-y-2">
      <Label htmlFor="tahun">Tahun</Label>
      <Select
        value={String(tahun)}
        onValueChange={(v) => router.push(`/akuntansi/bagi-hasil/distribusi?tahun=${v}`)}
      >
        <SelectTrigger id="tahun" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pilihan.map((t) => (
            <SelectItem key={t} value={String(t)}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function TombolKunci({ kode, nonaktif }: { kode: string; nonaktif: boolean }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      size="sm" disabled={bekerja || nonaktif}
      onClick={() => mulai(async () => {
        const hasil = await aksiKunciBagiHasil(kode)
        if (hasil.berhasil) {
          toast.success(`Bagi hasil ${kode} dikunci dan diposting`)
          router.refresh()
        } else toast.error(hasil.pesan)
      })}
    >
      {bekerja ? 'Memproses…' : 'Kunci & Bagikan'}
    </Button>
  )
}

export function TombolBukaKunci({ id }: { id: string }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiBukaKunciBagiHasil(id)
        if (hasil.berhasil) {
          toast.success('Kunci dibuka; jurnal distribusinya dibalik')
          router.refresh()
        } else toast.error(hasil.pesan)
      })}
    >
      Buka Kunci
    </Button>
  )
}
