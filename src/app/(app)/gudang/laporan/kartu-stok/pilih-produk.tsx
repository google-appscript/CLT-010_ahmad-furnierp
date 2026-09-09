'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function PilihProduk({
  produk, terpilih,
}: {
  produk: { id: string; kode: string; nama: string }[]
  terpilih?: string
}) {
  const router = useRouter()
  const jalur = usePathname()
  const params = useSearchParams()
  const [memuat, mulai] = useTransition()

  function pilih(id: string) {
    const baru = new URLSearchParams(params.toString())
    baru.set('produk', id)
    mulai(() => router.push(`${jalur}?${baru.toString()}`))
  }

  return (
    <div className="mb-6 max-w-md space-y-2">
      <Label htmlFor="produk">Produk</Label>
      <Select value={terpilih} onValueChange={pilih} disabled={memuat}>
        <SelectTrigger id="produk" className="w-full">
          <SelectValue placeholder="Pilih produk" />
        </SelectTrigger>
        <SelectContent>
          {produk.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.kode} — {p.nama}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
