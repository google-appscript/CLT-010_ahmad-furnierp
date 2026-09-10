'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LABEL_METODE } from '@/modules/aset/validasi/aset'
import { aksiSimpanKategoriAset, aksiUbahStatusKategoriAset } from './aksi'

export type PilihanAkun = { id: string; kode: string; nama: string; tipeAkun: string }

export type NilaiKategoriAset = {
  id?: string
  kode: string
  nama: string
  akunAsetId: string
  akunAkumulasiId: string | null
  akunBebanId: string | null
  dapatDidepresiasi: boolean
  metodeBawaan: string
  masaManfaatBulanBawaan: number
}

const TANPA_AKUN = 'tanpa-akun'

export function DialogKategoriAset({
  kategori, akun, pemicu,
}: {
  kategori?: NilaiKategoriAset
  akun: PilihanAkun[]
  pemicu: React.ReactNode
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [bekerja, mulai] = useTransition()
  const [disusutkan, setDisusutkan] = useState(kategori?.dapatDidepresiasi ?? true)
  const [akunAsetId, setAkunAsetId] = useState(kategori?.akunAsetId ?? '')
  const [akunAkumulasiId, setAkunAkumulasiId] = useState(kategori?.akunAkumulasiId ?? TANPA_AKUN)
  const [akunBebanId, setAkunBebanId] = useState(kategori?.akunBebanId ?? TANPA_AKUN)
  const [metode, setMetode] = useState(kategori?.metodeBawaan ?? 'garis_lurus')

  const akunAset = akun.filter((a) => a.tipeAkun === 'aset_tetap')
  const akunAkumulasi = akun.filter((a) => a.tipeAkun === 'aset_akumulasi_depresiasi')
  const akunBeban = akun.filter((a) => a.tipeAkun === 'beban_depresiasi')

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanKategoriAset(kategori?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        akunAsetId,
        akunAkumulasiId: disusutkan && akunAkumulasiId !== TANPA_AKUN ? akunAkumulasiId : null,
        akunBebanId: disusutkan && akunBebanId !== TANPA_AKUN ? akunBebanId : null,
        dapatDidepresiasi: disusutkan,
        metodeBawaan: metode as 'garis_lurus' | 'saldo_menurun_ganda',
        masaManfaatBulanBawaan: String(data.get('masaManfaatBulanBawaan') ?? '60'),
      })
      if (hasil.berhasil) {
        toast.success(kategori ? 'Kategori diperbarui' : 'Kategori dibuat')
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
          <DialogTitle>{kategori ? 'Ubah Kategori Aset' : 'Tambah Kategori Aset'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kode">Kode</Label>
              <Input id="kode" name="kode" required defaultValue={kategori?.kode} placeholder="KND" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nama">Nama</Label>
              <Input id="nama" name="nama" required defaultValue={kategori?.nama} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="akunAsetId">Akun Aset</Label>
            <Select value={akunAsetId} onValueChange={setAkunAsetId} required>
              <SelectTrigger id="akunAsetId" className="w-full">
                <SelectValue placeholder="Pilih akun aset tetap" />
              </SelectTrigger>
              <SelectContent>
                {akunAset.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="dapatDidepresiasi"
              checked={disusutkan}
              onCheckedChange={(v) => setDisusutkan(v === true)}
            />
            <Label htmlFor="dapatDidepresiasi">Disusutkan</Label>
          </div>

          {disusutkan ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="akunAkumulasiId">Akun Akumulasi Depresiasi</Label>
                <Select value={akunAkumulasiId} onValueChange={setAkunAkumulasiId}>
                  <SelectTrigger id="akunAkumulasiId" className="w-full">
                    <SelectValue placeholder="Pilih akun akumulasi" />
                  </SelectTrigger>
                  <SelectContent>
                    {akunAkumulasi.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="akunBebanId">Akun Beban Depresiasi</Label>
                <Select value={akunBebanId} onValueChange={setAkunBebanId}>
                  <SelectTrigger id="akunBebanId" className="w-full">
                    <SelectValue placeholder="Pilih akun beban" />
                  </SelectTrigger>
                  <SelectContent>
                    {akunBeban.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="metodeBawaan">Metode Bawaan</Label>
                  <Select value={metode} onValueChange={setMetode}>
                    <SelectTrigger id="metodeBawaan" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LABEL_METODE).map(([n, l]) => (
                        <SelectItem key={n} value={n}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="masaManfaatBulanBawaan">Masa Manfaat (bulan)</Label>
                  <Input
                    id="masaManfaatBulanBawaan" name="masaManfaatBulanBawaan"
                    type="number" step="1" min="1" required
                    defaultValue={kategori?.masaManfaatBulanBawaan ?? 60}
                    className="text-right tabular-nums"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <input type="hidden" name="masaManfaatBulanBawaan" value={12} />
              <p className="rounded-md border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
                Kategori yang tidak disusutkan — tanah, misalnya — hanya perlu akun asetnya.
                Aset di dalamnya tercatat di register tanpa jadwal depresiasi.
              </p>
            </>
          )}

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

export function TombolStatusKategoriAset({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiUbahStatusKategoriAset(id, !isActive)
        if (hasil.berhasil) {
          toast.success(isActive ? 'Kategori dinonaktifkan' : 'Kategori diaktifkan')
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
