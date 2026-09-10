'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  aksiSimpanPemilik, aksiUbahStatusPemilik, aksiSimpanSusunan, aksiHapusSusunan,
} from '../aksi'

export type PilihanAkunEkuitas = { id: string; kode: string; nama: string }
export type PilihanPemilik = { id: string; kode: string; nama: string }

export type NilaiPemilik = {
  id?: string
  kode: string
  nama: string
  akunModalId: string
  akunPriveId: string | null
  catatan: string
}

const TANPA_PRIVE = 'tanpa-prive'

export function DialogPemilik({
  pemilik, akun, pemicu,
}: {
  pemilik?: NilaiPemilik
  akun: PilihanAkunEkuitas[]
  pemicu: React.ReactNode
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [bekerja, mulai] = useTransition()
  const [akunModalId, setAkunModalId] = useState(pemilik?.akunModalId ?? '')
  const [akunPriveId, setAkunPriveId] = useState(pemilik?.akunPriveId ?? TANPA_PRIVE)

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanPemilik(pemilik?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        akunModalId,
        akunPriveId: akunPriveId === TANPA_PRIVE ? null : akunPriveId,
        catatan: String(data.get('catatan') ?? '') || null,
      })
      if (hasil.berhasil) {
        toast.success(pemilik ? 'Pemilik diperbarui' : 'Pemilik ditambahkan')
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pemilik ? 'Ubah Pemilik' : 'Tambah Pemilik'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kode">Kode</Label>
              <Input id="kode" name="kode" required defaultValue={pemilik?.kode} placeholder="OWN-1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nama">Nama</Label>
              <Input id="nama" name="nama" required defaultValue={pemilik?.nama} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="akunModalId">Akun Modal</Label>
            <Select value={akunModalId} onValueChange={setAkunModalId} required>
              <SelectTrigger id="akunModalId" className="w-full">
                <SelectValue placeholder="Pilih akun ekuitas" />
              </SelectTrigger>
              <SelectContent>
                {akun.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="akunPriveId">Akun Prive</Label>
            <Select value={akunPriveId} onValueChange={setAkunPriveId}>
              <SelectTrigger id="akunPriveId" className="w-full">
                <SelectValue placeholder="Opsional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TANPA_PRIVE}>Tanpa akun prive</SelectItem>
                {akun.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="catatan">Catatan</Label>
            <Textarea id="catatan" name="catatan" rows={2} defaultValue={pemilik?.catatan} />
          </div>

          <p className="text-sm text-muted-foreground">
            Setiap pemilik memerlukan akun modalnya sendiri — di situlah haknya terbaca
            langsung dari neraca, bukan dari catatan di luar pembukuan.
          </p>

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

export function TombolStatusPemilik({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiUbahStatusPemilik(id, !isActive)
        if (hasil.berhasil) {
          toast.success(isActive ? 'Pemilik dinonaktifkan' : 'Pemilik diaktifkan')
          router.refresh()
        } else toast.error(hasil.pesan)
      })}
    >
      {isActive ? 'Nonaktifkan' : 'Aktifkan'}
    </Button>
  )
}

export type BarisPorsi = { ownerId: string; persentase: string }

export type NilaiSusunan = {
  id?: string
  nama: string
  tanggalMulai: string
  tanggalSelesai: string
  catatan: string
  porsi: BarisPorsi[]
}

export function DialogSusunan({
  susunan, pemilik, pemicu,
}: {
  susunan?: NilaiSusunan
  pemilik: PilihanPemilik[]
  pemicu: React.ReactNode
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [bekerja, mulai] = useTransition()
  const [porsi, setPorsi] = useState<BarisPorsi[]>(
    susunan?.porsi.length ? susunan.porsi : [{ ownerId: '', persentase: '' }],
  )

  const terisi = porsi.filter((p) => p.ownerId && Number(p.persentase) > 0)
  const total = terisi.reduce((t, p) => t + Number(p.persentase), 0)
  const ganda = new Set(terisi.map((p) => p.ownerId)).size !== terisi.length
  const sah = terisi.length > 0 && Math.abs(total - 100) < 0.0001 && !ganda

  function ubah(i: number, u: Partial<BarisPorsi>) {
    setPorsi((l) => l.map((p, j) => (j === i ? { ...p, ...u } : p)))
  }

  function ratakan() {
    const n = porsi.length
    const rata = (100 / n).toFixed(4)
    const sisa = (100 - Number(rata) * (n - 1)).toFixed(4)
    setPorsi((l) => l.map((p, i) => ({ ...p, persentase: i === n - 1 ? sisa : rata })))
  }

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanSusunan(susunan?.id ?? null, {
        nama: String(data.get('nama') ?? ''),
        tanggalMulai: String(data.get('tanggalMulai') ?? ''),
        tanggalSelesai: String(data.get('tanggalSelesai') ?? '') || null,
        catatan: String(data.get('catatan') ?? '') || null,
        porsi: terisi,
      })
      if (hasil.berhasil) {
        toast.success(susunan ? 'Susunan diperbarui' : 'Susunan dibuat')
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {susunan ? 'Ubah Susunan Kepemilikan' : 'Susunan Kepemilikan Baru'}
          </DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="nama">Nama Susunan</Label>
              <Input
                id="nama" name="nama" required defaultValue={susunan?.nama}
                placeholder="Susunan 2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tanggalMulai">Berlaku Mulai</Label>
              <Input
                id="tanggalMulai" name="tanggalMulai" type="date" required
                defaultValue={susunan?.tanggalMulai}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tanggalSelesai">Berlaku Sampai</Label>
              <Input
                id="tanggalSelesai" name="tanggalSelesai" type="date"
                defaultValue={susunan?.tanggalSelesai}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Pemilik</th>
                  <th className="w-36 px-3 py-2 text-right font-medium">Persentase</th>
                  <th className="w-12 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {porsi.map((p, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-1.5">
                      <Select
                        value={p.ownerId}
                        onValueChange={(v) => ubah(i, { ownerId: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih pemilik" />
                        </SelectTrigger>
                        <SelectContent>
                          {pemilik.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.kode} — {o.nama}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        value={p.persentase}
                        onChange={(e) => ubah(i, { persentase: e.target.value })}
                        type="number" step="0.0001" min="0" max="100"
                        className="text-right tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Button
                        type="button" variant="ghost" size="icon"
                        aria-label={`Hapus porsi ${i + 1}`}
                        disabled={porsi.length === 1}
                        onClick={() => setPorsi((l) => l.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setPorsi((l) => [...l, { ownerId: '', persentase: '' }])}
            >
              <Plus className="mr-2 h-4 w-4" />Tambah Pemilik
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={ratakan}>
              Ratakan
            </Button>
            <span className={`text-sm ${sah ? 'text-muted-foreground' : 'text-destructive'}`}>
              Total {total.toFixed(2)}%
              {ganda && ' · satu pemilik muncul dua kali'}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="catatan">Catatan</Label>
            <Textarea id="catatan" name="catatan" rows={2} defaultValue={susunan?.catatan} />
          </div>

          <p className="text-sm text-muted-foreground">
            Persentase disimpan per susunan, bukan pada pemiliknya. Dengan begitu mengubah
            komposisi hari ini tidak mengubah pembagian periode yang sudah lewat.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={bekerja || !sah}>
              {bekerja ? 'Menyimpan…' : 'Simpan Susunan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TombolHapusSusunan({ id }: { id: string }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiHapusSusunan(id)
        if (hasil.berhasil) { toast.success('Susunan dihapus'); router.refresh() }
        else toast.error(hasil.pesan)
      })}
    >
      Hapus
    </Button>
  )
}
