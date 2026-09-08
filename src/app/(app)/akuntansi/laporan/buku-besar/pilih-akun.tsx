'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function PilihAkun({
  akun, terpilih,
}: {
  akun: { id: string; kode: string; nama: string }[]
  terpilih?: string
}) {
  const router = useRouter()
  const jalur = usePathname()
  const params = useSearchParams()
  const [memuat, mulai] = useTransition()

  function pilih(id: string) {
    const baru = new URLSearchParams(params.toString())
    baru.set('akun', id)
    mulai(() => router.push(`${jalur}?${baru.toString()}`))
  }

  return (
    <div className="mb-6 max-w-md space-y-2">
      <Label htmlFor="akun">Akun</Label>
      <Select value={terpilih} onValueChange={pilih} disabled={memuat}>
        <SelectTrigger id="akun" className="w-full">
          <SelectValue placeholder="Pilih akun" />
        </SelectTrigger>
        <SelectContent>
          {akun.map((a) => (
            <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
