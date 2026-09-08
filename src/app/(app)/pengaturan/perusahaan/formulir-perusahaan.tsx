'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { aksiSimpanPerusahaan } from './aksi'

export type NilaiAwal = {
  nama: string; npwp: string; alamat: string; kota: string
  provinsi: string; kodePos: string; telepon: string; email: string
}

export function FormulirPerusahaan({ awal }: { awal: NilaiAwal }) {
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const teks = (k: string) => String(data.get(k) ?? '') || null
      const hasil = await aksiSimpanPerusahaan({
        nama: String(data.get('nama') ?? ''),
        npwp: teks('npwp'), alamat: teks('alamat'), kota: teks('kota'),
        provinsi: teks('provinsi'), kodePos: teks('kodePos'),
        telepon: teks('telepon'), email: teks('email'),
      })
      if (hasil.berhasil) toast.success('Profil perusahaan diperbarui')
      else toast.error(hasil.pesan)
    })
  }

  return (
    <form action={simpan} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="nama">Nama Perusahaan</Label>
        <Input id="nama" name="nama" defaultValue={awal.nama} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="npwp">NPWP</Label>
        <Input id="npwp" name="npwp" defaultValue={awal.npwp} placeholder="01.234.567.8-901.000" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="telepon">Telepon</Label>
        <Input id="telepon" name="telepon" defaultValue={awal.telepon} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="alamat">Alamat</Label>
        <Input id="alamat" name="alamat" defaultValue={awal.alamat} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kota">Kota</Label>
        <Input id="kota" name="kota" defaultValue={awal.kota} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="provinsi">Provinsi</Label>
        <Input id="provinsi" name="provinsi" defaultValue={awal.provinsi} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kodePos">Kode Pos</Label>
        <Input id="kodePos" name="kodePos" defaultValue={awal.kodePos} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={awal.email} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={menyimpan}>
          {menyimpan ? 'Menyimpan…' : 'Simpan Perubahan'}
        </Button>
      </div>
    </form>
  )
}
