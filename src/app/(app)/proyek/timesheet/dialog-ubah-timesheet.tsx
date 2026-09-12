'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { aksiUbahTimesheet } from '../aksi'
import type { PilihanTugas, PilihanPengguna } from './formulir-timesheet'

const TANPA_TUGAS = 'tanpa-tugas'

export type TimesheetUntukDiubah = {
  id: string
  proyekId: string
  tugasId: string | null
  penggunaId: string
  tanggal: string
  jam: string
  deskripsi: string
}

export function DialogUbahTimesheet({
  baris, tugas, pengguna,
}: {
  baris: TimesheetUntukDiubah
  tugas: PilihanTugas[]
  pengguna: PilihanPengguna[]
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [bekerja, mulai] = useTransition()
  const [tugasId, setTugasId] = useState(baris.tugasId ?? TANPA_TUGAS)
  const [penggunaId, setPenggunaId] = useState(baris.penggunaId)

  const tugasProyek = tugas.filter((t) => t.proyekId === baris.proyekId)

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiUbahTimesheet(baris.id, {
        proyekId: baris.proyekId,
        tugasId: tugasId === TANPA_TUGAS ? null : tugasId,
        penggunaId,
        tanggal: String(data.get('tanggal') ?? ''),
        jam: String(data.get('jam') ?? '0'),
        deskripsi: String(data.get('deskripsi') ?? ''),
      })
      if (hasil.berhasil) {
        toast.success('Timesheet diperbarui')
        setTerbuka(false)
        router.refresh()
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">Ubah</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah Timesheet</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tugasId">Tugas</Label>
            <Select value={tugasId} onValueChange={setTugasId}>
              <SelectTrigger id="tugasId" className="w-full">
                <SelectValue placeholder="Opsional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TANPA_TUGAS}>Tanpa tugas</SelectItem>
                {tugasProyek.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="penggunaId">Pelaksana</Label>
            <Select value={penggunaId} onValueChange={setPenggunaId} required>
              <SelectTrigger id="penggunaId" className="w-full">
                <SelectValue placeholder="Pilih pelaksana" />
              </SelectTrigger>
              <SelectContent>
                {pengguna.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tanggal">Tanggal</Label>
              <Input id="tanggal" name="tanggal" type="date" required defaultValue={baris.tanggal} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jam">Jam</Label>
              <Input
                id="jam" name="jam" type="number" step="0.25" min="0.25" max="24" required
                defaultValue={baris.jam} className="text-right tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deskripsi">Uraian Pekerjaan</Label>
            <Input id="deskripsi" name="deskripsi" required defaultValue={baris.deskripsi} />
          </div>

          <p className="text-xs text-muted-foreground">
            Tarif yang sudah dibekukan pada baris ini tidak ikut berubah.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={bekerja}>
              {bekerja ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
