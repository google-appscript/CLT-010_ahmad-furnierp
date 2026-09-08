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
import { aksiCatatKurs } from './aksi'

export type PilihanMataUang = { kode: string; nama: string }

export function DialogKurs({
  mataUang, pemicu,
}: {
  mataUang: PilihanMataUang[]
  pemicu: React.ReactNode
}) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiCatatKurs({
        kodeMataUang: String(data.get('kodeMataUang') ?? ''),
        tanggal: String(data.get('tanggal') ?? ''),
        kurs: String(data.get('kurs') ?? ''),
      })
      if (hasil.berhasil) {
        toast.success('Kurs berhasil dicatat')
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
          <DialogTitle>Catat Kurs</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kodeMataUang">Mata Uang</Label>
            <Select name="kodeMataUang" required>
              <SelectTrigger id="kodeMataUang" className="w-full">
                <SelectValue placeholder="Pilih mata uang" />
              </SelectTrigger>
              <SelectContent>
                {mataUang.map((m) => (
                  <SelectItem key={m.kode} value={m.kode}>{m.kode} — {m.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tanggal">Tanggal Berlaku</Label>
            <Input id="tanggal" name="tanggal" type="date" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kurs">Kurs (Rupiah per 1 unit)</Label>
            <Input id="kurs" name="kurs" type="number" step="0.000001" min="0" required placeholder="16250" />
            <p className="text-xs text-muted-foreground">
              Mencatat kurs pada tanggal yang sudah ada akan menimpanya. Jurnal yang sudah
              terposting tidak ikut berubah karena kursnya dibekukan saat posting.
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
