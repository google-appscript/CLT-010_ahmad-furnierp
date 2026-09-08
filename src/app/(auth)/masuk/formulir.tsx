'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { aksiMasuk, type StatusMasuk } from './aksi'

const awal: StatusMasuk = { galat: null }

export function FormulirMasuk() {
  const [status, kirim, sedangKirim] = useActionState(aksiMasuk, awal)

  return (
    <form action={kirim} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kataSandi">Kata Sandi</Label>
        <Input
          id="kataSandi" name="kataSandi" type="password"
          required autoComplete="current-password"
        />
      </div>
      {status.galat && (
        <p role="alert" className="text-sm text-destructive">{status.galat}</p>
      )}
      <Button type="submit" className="w-full" disabled={sedangKirim}>
        {sedangKirim ? 'Memproses…' : 'Masuk'}
      </Button>
    </form>
  )
}
