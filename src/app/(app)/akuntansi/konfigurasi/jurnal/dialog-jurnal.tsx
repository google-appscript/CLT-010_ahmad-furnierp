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
import { DAFTAR_TIPE_JURNAL, labelTipeJurnal } from '@/modules/akuntansi/validasi/jurnal'
import type { Jurnal } from '@/modules/akuntansi/layanan/jurnal'
import { aksiSimpanJurnal } from './aksi'

export function DialogJurnal({ jurnal, pemicu }: { jurnal?: Jurnal; pemicu: React.ReactNode }) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanJurnal(jurnal?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        tipe: String(data.get('tipe') ?? 'umum') as never,
        prefixNomor: String(data.get('prefixNomor') ?? jurnal?.kode ?? ''),
        resetNomor: String(data.get('resetNomor') ?? 'bulanan') as never,
        akunDefaultDebitId: null,
        akunDefaultKreditId: null,
        mataUangId: null,
      })
      if (hasil.berhasil) {
        toast.success(jurnal ? 'Jurnal berhasil diperbarui' : 'Jurnal berhasil dibuat')
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
          <DialogTitle>{jurnal ? 'Ubah Jurnal' : 'Tambah Jurnal'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kode">Kode</Label>
              <Input id="kode" name="kode" defaultValue={jurnal?.kode} required placeholder="JU" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipe">Tipe</Label>
              <Select name="tipe" defaultValue={jurnal?.tipe ?? 'umum'}>
                <SelectTrigger id="tipe" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAFTAR_TIPE_JURNAL.map((t) => (
                    <SelectItem key={t} value={t}>{labelTipeJurnal(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" defaultValue={jurnal?.nama} required placeholder="Jurnal Umum" />
          </div>

          {!jurnal && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prefixNomor">Prefiks Nomor</Label>
                <Input id="prefixNomor" name="prefixNomor" required placeholder="JU" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resetNomor">Reset Nomor</Label>
                <Select name="resetNomor" defaultValue="bulanan">
                  <SelectTrigger id="resetNomor" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bulanan">Setiap Bulan</SelectItem>
                    <SelectItem value="tahunan">Setiap Tahun</SelectItem>
                    <SelectItem value="tidak_pernah">Tidak Pernah</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {jurnal && (
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Pengaturan penomoran tidak dapat diubah dari sini agar dokumen yang sudah terbit
              tidak ternomori ulang.
            </p>
          )}

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
