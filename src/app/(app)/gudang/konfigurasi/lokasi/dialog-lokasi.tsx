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
import { TIPE_LOKASI_DAPAT_DIBUAT, LABEL_TIPE_LOKASI } from '@/modules/gudang/validasi/lokasi'
import { aksiSimpanLokasi, aksiUbahStatusLokasi } from './aksi'

export type PilihanWarehouse = { id: string; kode: string; nama: string }
export type PilihanLokasiInduk = { id: string; kode: string; nama: string }

export type LokasiTampil = {
  id: string
  kode: string
  nama: string
  tipe: string
  warehouseId: string | null
  parentId: string | null
}

const TANPA_GUDANG = 'tanpa-gudang'
const TANPA_INDUK = 'tanpa-induk'

export function DialogLokasi({
  lokasi, gudang, lokasiLain, pemicu,
}: {
  lokasi?: LokasiTampil
  gudang: PilihanWarehouse[]
  lokasiLain: PilihanLokasiInduk[]
  pemicu: React.ReactNode
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()
  const [tipe, setTipe] = useState(lokasi?.tipe ?? TIPE_LOKASI_DAPAT_DIBUAT[0])
  const [warehouseId, setWarehouseId] = useState(lokasi?.warehouseId ?? TANPA_GUDANG)
  const [parentId, setParentId] = useState(lokasi?.parentId ?? TANPA_INDUK)

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanLokasi(lokasi?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        tipe: tipe as 'internal' | 'transit',
        warehouseId: warehouseId === TANPA_GUDANG ? null : warehouseId,
        parentId: parentId === TANPA_INDUK ? null : parentId,
      })
      if (hasil.berhasil) {
        toast.success(lokasi ? 'Lokasi berhasil diperbarui' : 'Lokasi berhasil dibuat')
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
          <DialogTitle>{lokasi ? 'Ubah Lokasi' : 'Tambah Lokasi'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kode">Kode</Label>
            <Input id="kode" name="kode" defaultValue={lokasi?.kode} required placeholder="GU/RAK-01" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" defaultValue={lokasi?.nama} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipe">Tipe</Label>
            {lokasi ? (
              <p className="rounded-md bg-muted px-3 py-2 text-sm">
                {LABEL_TIPE_LOKASI[lokasi.tipe] ?? lokasi.tipe}
                <span className="ml-2 text-xs text-muted-foreground">
                  (tipe tidak dapat diubah)
                </span>
              </p>
            ) : (
              <Select value={tipe} onValueChange={setTipe}>
                <SelectTrigger id="tipe" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPE_LOKASI_DAPAT_DIBUAT.map((t) => (
                    <SelectItem key={t} value={t}>{LABEL_TIPE_LOKASI[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="warehouseId">
              Gudang {tipe === 'internal' && <span className="text-destructive">*</span>}
            </Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger id="warehouseId" className="w-full">
                <SelectValue placeholder="Pilih gudang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TANPA_GUDANG}>Tanpa gudang</SelectItem>
                {gudang.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.kode} — {g.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="parentId">Lokasi Induk</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger id="parentId" className="w-full">
                <SelectValue placeholder="Opsional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TANPA_INDUK}>Tanpa induk</SelectItem>
                {lokasiLain.filter((l) => l.id !== lokasi?.id).map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.kode} — {l.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

export function TombolStatusLokasi({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiUbahStatusLokasi(id, !isActive)
        if (hasil.berhasil) {
          toast.success(isActive ? 'Lokasi dinonaktifkan' : 'Lokasi diaktifkan')
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
