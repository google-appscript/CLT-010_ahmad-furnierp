'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { aksiAturKunciBuku, aksiBuatTahunBuku } from './aksi'

export function FormulirPenguncian({ tanggalKunci }: { tanggalKunci: string | null }) {
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const nilai = String(data.get('tanggalKunciBuku') ?? '')
      const hasil = await aksiAturKunciBuku(nilai === '' ? null : nilai)
      if (hasil.berhasil) toast.success('Tanggal kunci buku diperbarui')
      else toast.error(hasil.pesan)
    })
  }

  return (
    <form action={simpan} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="tanggalKunciBuku">Tanggal Kunci Buku</Label>
        <Input
          id="tanggalKunciBuku" name="tanggalKunciBuku" type="date"
          defaultValue={tanggalKunci ?? ''} className="w-48"
        />
      </div>
      <Button type="submit" disabled={menyimpan}>
        {menyimpan ? 'Menyimpan…' : 'Simpan'}
      </Button>
    </form>
  )
}

export function DialogTahunBuku() {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiBuatTahunBuku({
        nama: String(data.get('nama') ?? ''),
        tanggalMulai: String(data.get('tanggalMulai') ?? ''),
        tanggalSelesai: String(data.get('tanggalSelesai') ?? ''),
      })
      if (hasil.berhasil) {
        toast.success('Tahun buku berhasil dibuat')
        setTerbuka(false)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        <Button>Tambah Tahun Buku</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Tahun Buku</DialogTitle>
        </DialogHeader>
        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" required placeholder="Tahun Buku 2027" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tanggalMulai">Tanggal Mulai</Label>
              <Input id="tanggalMulai" name="tanggalMulai" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tanggalSelesai">Tanggal Selesai</Label>
              <Input id="tanggalSelesai" name="tanggalSelesai" type="date" required />
            </div>
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
