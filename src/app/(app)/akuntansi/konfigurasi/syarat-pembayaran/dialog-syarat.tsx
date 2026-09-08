'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import type { SyaratPembayaran } from '@/modules/akuntansi/layanan/syarat-pembayaran'
import { aksiSimpanSyarat } from './aksi'

export function DialogSyarat({
  syarat, pemicu,
}: {
  syarat?: SyaratPembayaran
  pemicu: React.ReactNode
}) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanSyarat(syarat?.id ?? null, {
        nama: String(data.get('nama') ?? ''),
        jumlahHari: Number(data.get('jumlahHari') ?? 0),
        catatan: String(data.get('catatan') ?? '') || null,
      })
      if (hasil.berhasil) {
        toast.success(syarat ? 'Syarat pembayaran diperbarui' : 'Syarat pembayaran dibuat')
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
          <DialogTitle>{syarat ? 'Ubah Syarat Pembayaran' : 'Tambah Syarat Pembayaran'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" defaultValue={syarat?.nama} required placeholder="Net 30" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jumlahHari">Jumlah Hari</Label>
            <Input
              id="jumlahHari" name="jumlahHari" type="number" min="0" max="365"
              defaultValue={syarat?.jumlahHari ?? 0} required
            />
            <p className="text-xs text-muted-foreground">
              Isi 0 untuk pembayaran tunai. Jatuh tempo dihitung dari tanggal faktur.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="catatan">Catatan</Label>
            <Textarea id="catatan" name="catatan" defaultValue={syarat?.catatan ?? ''} rows={2} />
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
