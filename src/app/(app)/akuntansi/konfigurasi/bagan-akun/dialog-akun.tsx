'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { KELOMPOK_TIPE_AKUN, labelTipeAkun } from '@/modules/akuntansi/validasi/akun'
import type { Akun } from '@/modules/akuntansi/layanan/akun'
import { aksiSimpanAkun, aksiUbahStatusAkun } from './aksi'

export function DialogAkun({ akun, pemicu }: { akun?: Akun; pemicu: React.ReactNode }) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanAkun(akun?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        tipeAkun: String(data.get('tipeAkun') ?? ''),
        mataUangId: null,
        dapatDirekonsiliasi: data.get('dapatDirekonsiliasi') === 'on',
        catatan: String(data.get('catatan') ?? '') || null,
      })
      if (hasil.berhasil) {
        toast.success(akun ? 'Akun berhasil diperbarui' : 'Akun berhasil dibuat')
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
          <DialogTitle>{akun ? 'Ubah Akun' : 'Tambah Akun'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kode">Kode Akun</Label>
            <Input id="kode" name="kode" defaultValue={akun?.kode} required placeholder="1101" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nama">Nama Akun</Label>
            <Input id="nama" name="nama" defaultValue={akun?.nama} required placeholder="Kas" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipeAkun">Tipe Akun</Label>
            <Select name="tipeAkun" defaultValue={akun?.tipeAkun} required>
              <SelectTrigger id="tipeAkun" className="w-full">
                <SelectValue placeholder="Pilih tipe akun" />
              </SelectTrigger>
              <SelectContent>
                {KELOMPOK_TIPE_AKUN.map((kelompok) => (
                  <SelectGroup key={kelompok.label}>
                    <SelectLabel>{kelompok.label}</SelectLabel>
                    {kelompok.tipe.map((tipe) => (
                      <SelectItem key={tipe} value={tipe}>{labelTipeAkun(tipe)}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Tipe akun menentukan baris tempat akun ini muncul di laporan keuangan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="dapatDirekonsiliasi" name="dapatDirekonsiliasi"
              defaultChecked={akun?.dapatDirekonsiliasi}
            />
            <Label htmlFor="dapatDirekonsiliasi" className="font-normal">Dapat direkonsiliasi</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="catatan">Catatan</Label>
            <Textarea id="catatan" name="catatan" defaultValue={akun?.catatan ?? ''} rows={2} />
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

export function TombolStatusAkun({ id, isActive }: { id: string; isActive: boolean }) {
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiUbahStatusAkun(id, !isActive)
        if (hasil.berhasil) {
          toast.success(isActive ? 'Akun dinonaktifkan' : 'Akun diaktifkan')
        } else {
          toast.error(hasil.pesan)
        }
      })}
    >
      {isActive ? 'Nonaktifkan' : 'Aktifkan'}
    </Button>
  )
}
