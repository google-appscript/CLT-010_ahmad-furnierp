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
import { formatRupiah } from '@/lib/uang'
import { aksiJalankanAset, aksiHapusAset, aksiLepaskanAset, aksiPostingBaris } from '../aksi'

type Hasil = { berhasil: boolean; pesan?: string }

function useJalankan() {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  function jalankan(fn: () => Promise<Hasil>, sukses: string, keDaftar = false) {
    mulai(async () => {
      const hasil = await fn()
      if (!hasil.berhasil) {
        toast.error(hasil.pesan!)
        return
      }
      toast.success(sukses)
      if (keDaftar) router.push('/akuntansi/aset')
      else router.refresh()
    })
  }

  return { bekerja, jalankan }
}

export function AksiDraftAset({ id }: { id: string }) {
  const { bekerja, jalankan } = useJalankan()

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        disabled={bekerja}
        onClick={() => jalankan(() => aksiJalankanAset(id), 'Jadwal depresiasi tersusun')}
      >
        {bekerja ? 'Memproses…' : 'Jalankan Aset'}
      </Button>
      <Button
        variant="outline" disabled={bekerja}
        onClick={() => jalankan(() => aksiHapusAset(id), 'Draft aset dihapus', true)}
      >
        Hapus
      </Button>
    </div>
  )
}

export function TombolPostingBaris({ id }: { id: string }) {
  const { bekerja, jalankan } = useJalankan()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => jalankan(() => aksiPostingBaris(id), 'Depresiasi diposting')}
    >
      Posting
    </Button>
  )
}

export function DialogPelepasan({
  id, nilaiBuku, akunKas,
}: {
  id: string
  nilaiBuku: string
  akunKas: { id: string; kode: string; nama: string }[]
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [bekerja, mulai] = useTransition()
  const [nilaiPelepasan, setNilaiPelepasan] = useState('0')
  const [akunPenerimaanId, setAkunPenerimaanId] = useState('')

  const selisih = Number(nilaiPelepasan || 0) - Number(nilaiBuku)

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiLepaskanAset(id, {
        tanggal: String(data.get('tanggal') ?? ''),
        nilaiPelepasan: nilaiPelepasan || '0',
        akunPenerimaanId: Number(nilaiPelepasan) > 0 ? akunPenerimaanId || null : null,
        catatan: String(data.get('catatan') ?? '') || null,
      })

      if (hasil.berhasil) {
        toast.success('Aset dilepas dan jurnalnya diposting')
        setTerbuka(false)
        router.refresh()
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        <Button variant="outline">Lepaskan Aset</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lepaskan Aset</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Nilai perolehan dan akumulasinya dikeluarkan dari neraca. Selisih antara hasil
            pelepasan dan nilai buku {formatRupiah(nilaiBuku)} dicatat sebagai laba atau rugi.
            Jadwal depresiasi yang belum diposting ikut gugur.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tanggal">Tanggal Pelepasan</Label>
              <Input
                id="tanggal" name="tanggal" type="date" required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nilaiPelepasan">Hasil Pelepasan</Label>
              <Input
                id="nilaiPelepasan" type="number" step="0.01" min="0"
                value={nilaiPelepasan} onChange={(e) => setNilaiPelepasan(e.target.value)}
                className="text-right tabular-nums"
              />
            </div>
          </div>

          {Number(nilaiPelepasan) > 0 && (
            <div className="space-y-2">
              <Label htmlFor="akunPenerimaanId">Diterima Pada</Label>
              <Select value={akunPenerimaanId} onValueChange={setAkunPenerimaanId} required>
                <SelectTrigger id="akunPenerimaanId" className="w-full">
                  <SelectValue placeholder="Pilih akun kas atau bank" />
                </SelectTrigger>
                <SelectContent>
                  {akunKas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="rounded-md border bg-muted/40 px-4 py-2 text-sm">
            {selisih === 0
              ? 'Dilepas persis sebesar nilai bukunya; tidak ada laba maupun rugi.'
              : selisih > 0
                ? `Laba pelepasan ${formatRupiah(selisih.toFixed(2))}`
                : `Rugi pelepasan ${formatRupiah((-selisih).toFixed(2))}`}
          </p>

          <div className="space-y-2">
            <Label htmlFor="catatan">Catatan</Label>
            <Textarea id="catatan" name="catatan" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={bekerja}>
              {bekerja ? 'Memproses…' : 'Lepaskan dan Posting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
