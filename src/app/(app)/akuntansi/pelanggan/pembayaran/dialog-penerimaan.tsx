'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatAngka } from '@/lib/uang'
import { aksiBuatPembayaran, aksiPostingPembayaran } from '../aksi'

export type FakturTerbuka = {
  id: string
  nomor: string
  partnerId: string
  namaPelanggan: string
  tanggal: string
  sisa: string
}

export type PilihanAkunKas = { id: string; kode: string; nama: string }

export function DialogPenerimaan({
  faktur, akunKas, pelanggan, fakturAwal,
}: {
  faktur: FakturTerbuka[]
  akunKas: PilihanAkunKas[]
  pelanggan: { id: string; nama: string }[]
  fakturAwal?: string
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(Boolean(fakturAwal))
  const [bekerja, mulai] = useTransition()
  const [partnerId, setPartnerId] = useState(
    fakturAwal ? faktur.find((f) => f.id === fakturAwal)?.partnerId ?? '' : '',
  )
  const [akunKasId, setAkunKasId] = useState(akunKas[0]?.id ?? '')
  const [alokasi, setAlokasi] = useState<Record<string, string>>(
    fakturAwal
      ? { [fakturAwal]: String(Number(faktur.find((f) => f.id === fakturAwal)?.sisa ?? 0)) }
      : {},
  )

  const fakturPelanggan = faktur.filter((f) => !partnerId || f.partnerId === partnerId)
  const totalAlokasi = Object.entries(alokasi)
    .filter(([id]) => fakturPelanggan.some((f) => f.id === id))
    .reduce((s, [, v]) => s + Number(v || 0), 0)

  function simpan(data: FormData) {
    mulai(async () => {
      const daftarAlokasi = Object.entries(alokasi)
        .filter(([id, v]) => Number(v) > 0 && fakturPelanggan.some((f) => f.id === id))
        .map(([invoiceId, jumlah]) => ({ invoiceId, jumlah }))

      const hasil = await aksiBuatPembayaran({
        partnerId,
        tanggal: String(data.get('tanggal') ?? ''),
        akunKasId,
        jumlah: String(data.get('jumlah') ?? ''),
        referensi: String(data.get('referensi') ?? '') || null,
        catatan: String(data.get('catatan') ?? '') || null,
        alokasi: daftarAlokasi,
      })

      if (!hasil.berhasil) {
        toast.error(hasil.pesan)
        return
      }

      // Langsung diposting agar kas dan piutang tercatat seketika, sekaligus
      // memicu rekonsiliasi otomatis bila piutang pelanggan itu jadi nol.
      const posting = await aksiPostingPembayaran(hasil.id!)
      if (posting.berhasil) {
        toast.success('Penerimaan diposting ke buku besar')
        setTerbuka(false)
        setAlokasi({})
        router.refresh()
      } else {
        toast.error(posting.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Catat Penerimaan</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Catat Penerimaan dari Pelanggan</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="partnerId">Pelanggan</Label>
              <Select value={partnerId} onValueChange={setPartnerId} required>
                <SelectTrigger id="partnerId" className="w-full">
                  <SelectValue placeholder="Pilih pelanggan" />
                </SelectTrigger>
                <SelectContent>
                  {pelanggan.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tanggal">Tanggal</Label>
              <Input
                id="tanggal" name="tanggal" type="date" required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="akunKasId">Diterima Pada</Label>
              <Select value={akunKasId} onValueChange={setAkunKasId} required>
                <SelectTrigger id="akunKasId" className="w-full">
                  <SelectValue placeholder="Pilih akun kas atau bank" />
                </SelectTrigger>
                <SelectContent>
                  {akunKas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jumlah">Jumlah Diterima</Label>
              <Input
                id="jumlah" name="jumlah" type="number" step="0.01" min="0" required
                defaultValue={totalAlokasi > 0 ? totalAlokasi.toFixed(2) : ''}
                className="text-right tabular-nums"
              />
            </div>
          </div>

          <div>
            <Label>Alokasi ke Faktur</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Kelebihan yang tidak dialokasikan dicatat sebagai uang muka penjualan.
            </p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Faktur</th>
                    <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                    <th className="w-36 px-3 py-2 text-right font-medium">Sisa</th>
                    <th className="w-40 px-3 py-2 text-right font-medium">Dialokasikan</th>
                  </tr>
                </thead>
                <tbody>
                  {fakturPelanggan.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                        Tidak ada faktur terbuka untuk pelanggan ini.
                      </td>
                    </tr>
                  )}
                  {fakturPelanggan.map((f) => (
                    <tr key={f.id} className="border-b">
                      <td className="px-3 py-1.5 font-mono text-xs">{f.nomor}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{f.tanggal}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {formatAngka(f.sisa)}
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          value={alokasi[f.id] ?? ''}
                          onChange={(e) => setAlokasi((a) => ({ ...a, [f.id]: e.target.value }))}
                          type="number" step="0.01" min="0" max={Number(f.sisa)}
                          className="text-right tabular-nums"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="referensi">Referensi</Label>
              <Input id="referensi" name="referensi" placeholder="Nomor transfer" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catatan">Catatan</Label>
              <Textarea id="catatan" name="catatan" rows={1} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={bekerja}>
              {bekerja ? 'Memproses…' : 'Simpan dan Posting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
