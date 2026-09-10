'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { aksiSimpanPosBiaya, aksiUbahStatusPosBiaya, aksiAturPosBawaanLokasi } from './aksi'

export type NilaiPos = { id?: string; kode: string; nama: string; deskripsi: string }

export function DialogPosBiaya({
  pos, pemicu,
}: {
  pos?: NilaiPos
  pemicu: React.ReactNode
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [bekerja, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanPosBiaya(pos?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        deskripsi: String(data.get('deskripsi') ?? '') || null,
      })
      if (hasil.berhasil) {
        toast.success(pos ? 'Pos biaya diperbarui' : 'Pos biaya dibuat')
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
          <DialogTitle>{pos ? 'Ubah Pos Biaya' : 'Tambah Pos Biaya'}</DialogTitle>
        </DialogHeader>
        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kode">Kode</Label>
            <Input id="kode" name="kode" required defaultValue={pos?.kode} placeholder="WS" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" required defaultValue={pos?.nama} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deskripsi">Deskripsi</Label>
            <Textarea id="deskripsi" name="deskripsi" rows={2} defaultValue={pos?.deskripsi} />
          </div>
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

export function TombolStatusPos({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiUbahStatusPosBiaya(id, !isActive)
        if (hasil.berhasil) {
          toast.success(isActive ? 'Pos biaya dinonaktifkan' : 'Pos biaya diaktifkan')
          router.refresh()
        } else toast.error(hasil.pesan)
      })}
    >
      {isActive ? 'Nonaktifkan' : 'Aktifkan'}
    </Button>
  )
}

const TANPA_POS = 'tanpa-pos'

export function PemilihPosLokasi({
  lokasiId, terpilih, pos,
}: {
  lokasiId: string
  terpilih: string | null
  pos: { id: string; kode: string; nama: string }[]
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()
  const [nilai, setNilai] = useState(terpilih ?? TANPA_POS)

  function ubah(v: string) {
    const sebelumnya = nilai
    setNilai(v)
    mulai(async () => {
      const hasil = await aksiAturPosBawaanLokasi(lokasiId, v === TANPA_POS ? null : v)
      if (hasil.berhasil) {
        toast.success('Pos bawaan gudang disimpan')
        router.refresh()
      } else {
        setNilai(sebelumnya)
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Select value={nilai} onValueChange={ubah} disabled={bekerja}>
      <SelectTrigger className="w-full min-w-48">
        <SelectValue placeholder="Tanpa pos bawaan" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TANPA_POS}>Tanpa pos bawaan</SelectItem>
        {pos.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.kode} — {p.nama}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
