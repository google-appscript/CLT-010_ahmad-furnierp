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

export type TagihanTerbuka = {
  id: string
  nomor: string
  partnerId: string
  namaPemasok: string
  tanggal: string
  sisa: string
}

export type PilihanAkunKas = { id: string; kode: string; nama: string }

export function DialogPembayaran({
  tagihan, akunKas, pemasok, tagihanAwal,
}: {
  tagihan: TagihanTerbuka[]
  akunKas: PilihanAkunKas[]
  pemasok: { id: string; nama: string }[]
  tagihanAwal?: string
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(Boolean(tagihanAwal))
  const [bekerja, mulai] = useTransition()
  const [partnerId, setPartnerId] = useState(
    tagihanAwal ? tagihan.find((t) => t.id === tagihanAwal)?.partnerId ?? '' : '',
  )
  const [akunKasId, setAkunKasId] = useState(akunKas[0]?.id ?? '')
  const [alokasi, setAlokasi] = useState<Record<string, string>>(
    tagihanAwal
      ? { [tagihanAwal]: String(Number(tagihan.find((t) => t.id === tagihanAwal)?.sisa ?? 0)) }
      : {},
  )

  const tagihanPemasok = tagihan.filter((t) => !partnerId || t.partnerId === partnerId)
  const totalAlokasi = Object.entries(alokasi)
    .filter(([id]) => tagihanPemasok.some((t) => t.id === id))
    .reduce((s, [, v]) => s + Number(v || 0), 0)

  function simpan(data: FormData) {
    mulai(async () => {
      const daftarAlokasi = Object.entries(alokasi)
        .filter(([id, v]) => Number(v) > 0 && tagihanPemasok.some((t) => t.id === id))
        .map(([billId, jumlah]) => ({ billId, jumlah }))

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

      // Pembayaran langsung diposting agar kas dan utang tercatat seketika.
      const posting = await aksiPostingPembayaran(hasil.id!)
      if (posting.berhasil) {
        toast.success('Pembayaran diposting ke buku besar')
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
        <Button><Plus className="mr-2 h-4 w-4" />Catat Pembayaran</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Catat Pembayaran kepada Pemasok</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="partnerId">Pemasok</Label>
              <Select value={partnerId} onValueChange={setPartnerId} required>
                <SelectTrigger id="partnerId" className="w-full">
                  <SelectValue placeholder="Pilih pemasok" />
                </SelectTrigger>
                <SelectContent>
                  {pemasok.map((p) => (
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
              <Label htmlFor="akunKasId">Dibayar Dari</Label>
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
              <Label htmlFor="jumlah">Jumlah Dibayar</Label>
              <Input
                id="jumlah" name="jumlah" type="number" step="0.01" min="0" required
                defaultValue={totalAlokasi > 0 ? totalAlokasi.toFixed(2) : ''}
                className="text-right tabular-nums"
              />
            </div>
          </div>

          <div>
            <Label>Alokasi ke Tagihan</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Kelebihan yang tidak dialokasikan dicatat sebagai uang muka pembelian.
            </p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Tagihan</th>
                    <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                    <th className="w-36 px-3 py-2 text-right font-medium">Sisa</th>
                    <th className="w-40 px-3 py-2 text-right font-medium">Dialokasikan</th>
                  </tr>
                </thead>
                <tbody>
                  {tagihanPemasok.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                        Tidak ada tagihan terbuka untuk pemasok ini.
                      </td>
                    </tr>
                  )}
                  {tagihanPemasok.map((t) => (
                    <tr key={t.id} className="border-b">
                      <td className="px-3 py-1.5 font-mono text-xs">{t.nomor}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{t.tanggal}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {formatAngka(t.sisa)}
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          value={alokasi[t.id] ?? ''}
                          onChange={(e) => setAlokasi((a) => ({ ...a, [t.id]: e.target.value }))}
                          type="number" step="0.01" min="0" max={Number(t.sisa)}
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
