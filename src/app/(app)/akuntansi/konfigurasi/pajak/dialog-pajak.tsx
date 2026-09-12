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
import type { Pajak } from '@/modules/akuntansi/layanan/pajak'
import { aksiSimpanPajak, aksiUbahStatusPajak } from './aksi'

export type PilihanAkun = { id: string; kode: string; nama: string }

export function DialogPajak({
  pajak, akunPajak, pemicu,
}: {
  pajak?: Pajak
  akunPajak: PilihanAkun[]
  pemicu: React.ReactNode
}) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanPajak(pajak?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        ruangLingkup: String(data.get('ruangLingkup') ?? 'penjualan') as 'penjualan' | 'pembelian',
        tarif: String(data.get('tarif') ?? '0'),
        hargaTermasukPajak: data.get('hargaTermasukPajak') === 'on',
        isPemotongan: data.get('isPemotongan') === 'on',
        akunPajakId: String(data.get('akunPajakId') ?? ''),
      })
      if (hasil.berhasil) {
        toast.success(pajak ? 'Pajak berhasil diperbarui' : 'Pajak berhasil dibuat')
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
          <DialogTitle>{pajak ? 'Ubah Pajak' : 'Tambah Pajak'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kode">Kode</Label>
            <Input id="kode" name="kode" defaultValue={pajak?.kode} required placeholder="PPN-K-11" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" defaultValue={pajak?.nama} required placeholder="PPN Keluaran 11%" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ruangLingkup">Ruang Lingkup</Label>
              <Select name="ruangLingkup" defaultValue={pajak?.ruangLingkup ?? 'penjualan'}>
                <SelectTrigger id="ruangLingkup" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="penjualan">Penjualan</SelectItem>
                  <SelectItem value="pembelian">Pembelian</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tarif">Tarif (%)</Label>
              <Input
                id="tarif" name="tarif" type="number" step="0.0001" min="0" max="100"
                defaultValue={pajak ? String(Number(pajak.tarif)) : '11'} required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="akunPajakId">Akun Pajak</Label>
            <Select name="akunPajakId" defaultValue={pajak?.akunPajakId} required>
              <SelectTrigger id="akunPajakId" className="w-full">
                <SelectValue placeholder="Pilih akun pajak" />
              </SelectTrigger>
              <SelectContent>
                {akunPajak.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="hargaTermasukPajak" name="hargaTermasukPajak"
                defaultChecked={pajak?.hargaTermasukPajak}
              />
              <Label htmlFor="hargaTermasukPajak" className="font-normal">
                Harga sudah termasuk pajak
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="isPemotongan" name="isPemotongan" defaultChecked={pajak?.isPemotongan} />
              <Label htmlFor="isPemotongan" className="font-normal">Pajak pemotongan (PPh)</Label>
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

export function TombolStatusPajak({ id, isActive }: { id: string; isActive: boolean }) {
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiUbahStatusPajak(id, !isActive)
        if (hasil.berhasil) {
          toast.success(isActive ? 'Pajak dinonaktifkan' : 'Pajak diaktifkan')
        } else {
          toast.error(hasil.pesan)
        }
      })}
    >
      {isActive ? 'Nonaktifkan' : 'Aktifkan'}
    </Button>
  )
}
