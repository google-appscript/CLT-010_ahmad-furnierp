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
import { DAFTAR_KATEGORI_UOM, LABEL_KATEGORI_UOM } from '@/modules/gudang/validasi/uom'
import { aksiSimpanUom, aksiUbahStatusUom } from './aksi'

export type UomTampil = {
  id: string; kode: string; nama: string; kategori: string; faktor: string
}

export function DialogUom({ uom, pemicu }: { uom?: UomTampil; pemicu: React.ReactNode }) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()
  const [kategori, setKategori] = useState(uom?.kategori ?? DAFTAR_KATEGORI_UOM[0])

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanUom(uom?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        kategori: kategori as typeof DAFTAR_KATEGORI_UOM[number],
        faktor: String(data.get('faktor') ?? '1'),
      })
      if (hasil.berhasil) {
        toast.success(uom ? 'Satuan berhasil diperbarui' : 'Satuan berhasil dibuat')
        setTerbuka(false)
        router.refresh()
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
          <DialogTitle>{uom ? 'Ubah Satuan' : 'Tambah Satuan'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kode">Kode</Label>
              <Input id="kode" name="kode" defaultValue={uom?.kode} required placeholder="PCS" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nama">Nama</Label>
              <Input id="nama" name="nama" defaultValue={uom?.nama} required placeholder="Pieces" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kategori">Kategori</Label>
              <Select value={kategori} onValueChange={setKategori}>
                <SelectTrigger id="kategori" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAFTAR_KATEGORI_UOM.map((k) => (
                    <SelectItem key={k} value={k}>{LABEL_KATEGORI_UOM[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="faktor">Faktor</Label>
              <Input
                id="faktor" name="faktor" type="number" step="0.000001" min="0.000001" required
                defaultValue={uom?.faktor ?? '1'} className="text-right tabular-nums"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Faktor menyatakan berapa satuan acuan yang setara dengan satu satuan ini. Konversi
            hanya berlaku di dalam kategori yang sama, dan perubahan hanya memengaruhi
            konversi berikutnya.
          </p>

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

export function TombolStatusUom({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiUbahStatusUom(id, !isActive)
        if (hasil.berhasil) {
          toast.success(isActive ? 'Satuan dinonaktifkan' : 'Satuan diaktifkan')
          router.refresh()
        } else {
          toast.error(hasil.pesan)
        }
      })}
    >
      {isActive ? 'Nonaktifkan' : 'Aktifkan'}
    </Button>
  )
}
