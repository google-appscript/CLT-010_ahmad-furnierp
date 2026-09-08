'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Penyaring periode yang menulis rentang tanggal ke query string, sehingga
 * laporan dapat ditautkan dan dimuat ulang tanpa kehilangan filter.
 */
export function PenyaringPeriode({
  dari, sampai, hanyaSampai = false,
}: {
  dari: string
  sampai: string
  hanyaSampai?: boolean
}) {
  const router = useRouter()
  const jalur = usePathname()
  const params = useSearchParams()
  const [memuat, mulai] = useTransition()

  function terapkan(data: FormData) {
    const baru = new URLSearchParams(params.toString())
    if (!hanyaSampai) baru.set('dari', String(data.get('dari') ?? ''))
    baru.set('sampai', String(data.get('sampai') ?? ''))
    mulai(() => router.push(`${jalur}?${baru.toString()}`))
  }

  return (
    <form action={terapkan} className="mb-6 flex flex-wrap items-end gap-3 rounded-md border p-4">
      {!hanyaSampai && (
        <div className="space-y-2">
          <Label htmlFor="dari">Dari Tanggal</Label>
          <Input id="dari" name="dari" type="date" defaultValue={dari} className="w-44" />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="sampai">{hanyaSampai ? 'Per Tanggal' : 'Sampai Tanggal'}</Label>
        <Input id="sampai" name="sampai" type="date" defaultValue={sampai} className="w-44" />
      </div>
      <Button type="submit" disabled={memuat}>
        {memuat ? 'Memuat…' : 'Terapkan'}
      </Button>
    </form>
  )
}
