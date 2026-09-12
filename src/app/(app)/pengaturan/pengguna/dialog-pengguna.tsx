'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { aksiSimpanPengguna, aksiUbahStatusPengguna } from './aksi'

export type PilihanPeran = { id: string; nama: string }
export type PenggunaTampil = { id: string; email: string; nama: string }

export function DialogPengguna({
  pengguna, peran, peranTerpilihId, pemicu,
}: {
  pengguna?: PenggunaTampil
  peran: PilihanPeran[]
  peranTerpilihId?: string
  pemicu: React.ReactNode
}) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const kataSandi = String(data.get('kataSandi') ?? '')
      const hasil = await aksiSimpanPengguna(pengguna?.id ?? null, {
        email: String(data.get('email') ?? ''),
        nama: String(data.get('nama') ?? ''),
        peranId: String(data.get('peranId') ?? ''),
        ...(kataSandi ? { kataSandi } : {}),
      })
      if (hasil.berhasil) {
        toast.success(pengguna ? 'Pengguna berhasil diperbarui' : 'Pengguna berhasil dibuat')
        setTerbuka(false)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>{pemicu}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pengguna ? 'Ubah Pengguna' : 'Tambah Pengguna'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" defaultValue={pengguna?.nama} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={pengguna?.email} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="peranId">Peran</Label>
            <Select name="peranId" defaultValue={peranTerpilihId ?? peran[0]?.id} required>
              <SelectTrigger id="peranId" className="w-full">
                <SelectValue placeholder="Pilih peran" />
              </SelectTrigger>
              <SelectContent>
                {peran.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kataSandi">{pengguna ? 'Kata Sandi Baru' : 'Kata Sandi'}</Label>
            <Input
              id="kataSandi" name="kataSandi" type="password"
              required={!pengguna} minLength={8} autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              {pengguna
                ? 'Kosongkan bila tidak ingin mengganti kata sandi.'
                : 'Minimal 8 karakter.'}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TombolStatusPengguna({ id, isActive }: { id: string; isActive: boolean }) {
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiUbahStatusPengguna(id, !isActive)
        if (hasil.berhasil) {
          toast.success(isActive ? 'Pengguna dinonaktifkan' : 'Pengguna diaktifkan')
        } else {
          toast.error(hasil.pesan)
        }
      })}
    >
      {isActive ? 'Nonaktifkan' : 'Aktifkan'}
    </Button>
  )
}
