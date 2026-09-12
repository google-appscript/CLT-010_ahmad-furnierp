'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Partner } from '@/modules/akuntansi/layanan/partner'
import { aksiSimpanPartner, aksiUbahStatusPartner } from './aksi'

export function DialogPartner({
  partner, pemicu, peranAwal,
}: {
  partner?: Partner
  pemicu: React.ReactNode
  peranAwal?: 'pelanggan' | 'pemasok'
}) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const teks = (k: string) => String(data.get(k) ?? '') || null
      const hasil = await aksiSimpanPartner(partner?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        tipe: String(data.get('tipe') ?? 'badan') as 'perorangan' | 'badan',
        isPelanggan: data.get('isPelanggan') === 'on',
        isPemasok: data.get('isPemasok') === 'on',
        npwp: teks('npwp'), nik: teks('nik'), alamat: teks('alamat'),
        kota: teks('kota'), provinsi: teks('provinsi'), kodePos: teks('kodePos'),
        telepon: teks('telepon'), email: teks('email'), kontakPerson: teks('kontakPerson'),
        syaratPembayaranId: null, akunPiutangId: null, akunUtangId: null,
      })
      if (hasil.berhasil) {
        toast.success(partner ? 'Mitra berhasil diperbarui' : 'Mitra berhasil dibuat')
        setTerbuka(false)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>{pemicu}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{partner ? 'Ubah Mitra Usaha' : 'Tambah Mitra Usaha'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="kode">Kode</Label>
            <Input id="kode" name="kode" defaultValue={partner?.kode} required placeholder="CUST-001" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipe">Tipe</Label>
            <Select name="tipe" defaultValue={partner?.tipe ?? 'badan'}>
              <SelectTrigger id="tipe" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="badan">Badan Usaha</SelectItem>
                <SelectItem value="perorangan">Perorangan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" defaultValue={partner?.nama} required />
          </div>

          <div className="flex items-center gap-6 sm:col-span-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="isPelanggan" name="isPelanggan"
                defaultChecked={partner?.isPelanggan ?? peranAwal === 'pelanggan'}
              />
              <Label htmlFor="isPelanggan" className="font-normal">Pelanggan</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isPemasok" name="isPemasok"
                defaultChecked={partner?.isPemasok ?? peranAwal === 'pemasok'}
              />
              <Label htmlFor="isPemasok" className="font-normal">Pemasok</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="npwp">NPWP</Label>
            <Input id="npwp" name="npwp" defaultValue={partner?.npwp ?? ''} placeholder="01.234.567.8-901.000" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nik">NIK</Label>
            <Input id="nik" name="nik" defaultValue={partner?.nik ?? ''} placeholder="16 digit" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="alamat">Alamat</Label>
            <Input id="alamat" name="alamat" defaultValue={partner?.alamat ?? ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kota">Kota</Label>
            <Input id="kota" name="kota" defaultValue={partner?.kota ?? ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provinsi">Provinsi</Label>
            <Input id="provinsi" name="provinsi" defaultValue={partner?.provinsi ?? ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kodePos">Kode Pos</Label>
            <Input id="kodePos" name="kodePos" defaultValue={partner?.kodePos ?? ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telepon">Telepon</Label>
            <Input id="telepon" name="telepon" defaultValue={partner?.telepon ?? ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={partner?.email ?? ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kontakPerson">Kontak Person</Label>
            <Input id="kontakPerson" name="kontakPerson" defaultValue={partner?.kontakPerson ?? ''} />
          </div>

          <DialogFooter className="sm:col-span-2">
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

export function TombolStatusPartner({ id, isActive }: { id: string; isActive: boolean }) {
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiUbahStatusPartner(id, !isActive)
        if (hasil.berhasil) {
          toast.success(isActive ? 'Mitra dinonaktifkan' : 'Mitra diaktifkan')
        } else {
          toast.error(hasil.pesan)
        }
      })}
    >
      {isActive ? 'Nonaktifkan' : 'Aktifkan'}
    </Button>
  )
}
