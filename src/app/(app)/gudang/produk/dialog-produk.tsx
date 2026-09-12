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
import { DAFTAR_TIPE_PRODUK, LABEL_TIPE_PRODUK } from '@/modules/gudang/validasi/produk'
import { aksiSimpanProduk, aksiUbahStatusProduk } from './aksi'

export type PilihanKategori = { id: string; kode: string; nama: string }
export type PilihanUom = { id: string; kode: string; nama: string }

export type ProdukTampil = {
  id: string
  kode: string
  nama: string
  tipe: string
  kategoriId: string
  uomId: string
  barcode: string | null
  hargaJual: string
  catatan: string | null
}

export function DialogProduk({
  produk, kategori, uom, pemicu,
}: {
  produk?: ProdukTampil
  kategori: PilihanKategori[]
  uom: PilihanUom[]
  pemicu: React.ReactNode
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()
  const [tipe, setTipe] = useState(produk?.tipe ?? DAFTAR_TIPE_PRODUK[0])
  const [kategoriId, setKategoriId] = useState(produk?.kategoriId ?? '')
  const [uomId, setUomId] = useState(produk?.uomId ?? '')

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanProduk(produk?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        tipe: tipe as typeof DAFTAR_TIPE_PRODUK[number],
        kategoriId,
        uomId,
        barcode: String(data.get('barcode') ?? '') || null,
        hargaJual: String(data.get('hargaJual') ?? '0'),
        catatan: String(data.get('catatan') ?? '') || null,
      })
      if (hasil.berhasil) {
        toast.success(produk ? 'Produk berhasil diperbarui' : 'Produk berhasil dibuat')
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{produk ? 'Ubah Produk' : 'Tambah Produk'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kode">Kode</Label>
              <Input id="kode" name="kode" defaultValue={produk?.kode} required placeholder="BJ-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipe">Tipe</Label>
              <Select value={tipe} onValueChange={setTipe}>
                <SelectTrigger id="tipe" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAFTAR_TIPE_PRODUK.map((t) => (
                    <SelectItem key={t} value={t}>{LABEL_TIPE_PRODUK[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" defaultValue={produk?.nama} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kategoriId">Kategori</Label>
              <Select value={kategoriId} onValueChange={setKategoriId} required>
                <SelectTrigger id="kategoriId" className="w-full">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {kategori.map((k) => (
                    <SelectItem key={k.id} value={k.id}>{k.kode} — {k.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="uomId">Satuan</Label>
              <Select value={uomId} onValueChange={setUomId} required>
                <SelectTrigger id="uomId" className="w-full">
                  <SelectValue placeholder="Pilih satuan" />
                </SelectTrigger>
                <SelectContent>
                  {uom.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.kode} — {u.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hargaJual">Harga Jual</Label>
              <Input
                id="hargaJual" name="hargaJual" type="number" step="0.01" min="0" required
                defaultValue={produk?.hargaJual ?? '0'} className="text-right tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" name="barcode" defaultValue={produk?.barcode ?? ''} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="catatan">Catatan</Label>
            <Textarea id="catatan" name="catatan" defaultValue={produk?.catatan ?? ''} rows={2} />
          </div>

          {produk && (
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Harga pokok rata-rata tidak diubah di sini — nilainya diperbarui otomatis setiap
              kali barang diterima.
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

export function TombolStatusProduk({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiUbahStatusProduk(id, !isActive)
        if (hasil.berhasil) {
          toast.success(isActive ? 'Produk dinonaktifkan' : 'Produk diaktifkan')
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
