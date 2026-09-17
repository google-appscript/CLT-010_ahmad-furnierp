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
import { formatAngka } from '@/lib/uang'
import { aksiKirimBarang } from '../../aksi'

export type BarisKirim = {
  soLineId: string
  namaProduk: string
  namaUom: string
  sisaDikirim: string
}

export type PilihanGudang = { id: string; nama: string }

export function DialogKirimBarang({
  soId, baris, gudang,
}: {
  soId: string
  baris: BarisKirim[]
  /** Gudang internal yang dapat mengeluarkan barang. */
  gudang: PilihanGudang[]
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [bekerja, mulai] = useTransition()
  const [lokasiAsalId, setLokasiAsalId] = useState(gudang[0]?.id ?? '')
  const [jumlah, setJumlah] = useState<Record<string, string>>(
    Object.fromEntries(baris.map((b) => [b.soLineId, String(Number(b.sisaDikirim))])),
  )

  function kirim(data: FormData) {
    mulai(async () => {
      const hasil = await aksiKirimBarang(
        soId,
        String(data.get('tanggal') ?? ''),
        lokasiAsalId,
        baris
          .map((b) => ({ soLineId: b.soLineId, kuantitas: jumlah[b.soLineId] || '0' }))
          .filter((b) => Number(b.kuantitas) > 0),
      )
      if (hasil.berhasil) {
        toast.success('Barang dikirim, stok dan harga pokok sudah tercatat')
        setTerbuka(false)
        router.refresh()
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  const adaSisa = baris.some((b) => Number(b.sisaDikirim) > 0)
  const siap = adaSisa && lokasiAsalId !== ''

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        <Button disabled={!adaSisa}>Kirim Barang</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kirim Barang</DialogTitle>
        </DialogHeader>
        <form action={kirim} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pengiriman membebankan harga pokok rata-rata dan memposting jurnal Harga Pokok
            Penjualan lawan Persediaan. Pendapatan baru dicatat saat faktur diposting.
          </p>

          <div className="space-y-2">
            <Label htmlFor="lokasiAsalId">Gudang Asal</Label>
            <Select value={lokasiAsalId} onValueChange={setLokasiAsalId} required>
              <SelectTrigger id="lokasiAsalId" className="w-full">
                <SelectValue placeholder="Pilih gudang" />
              </SelectTrigger>
              <SelectContent>
                {gudang.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tanggal">Tanggal Pengiriman</Label>
            <Input
              id="tanggal" name="tanggal" type="date" required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Produk</th>
                  <th className="w-32 px-3 py-2 text-right font-medium">Sisa</th>
                  <th className="w-36 px-3 py-2 text-right font-medium">Dikirim</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => (
                  <tr key={b.soLineId} className="border-b">
                    <td className="px-3 py-1.5">{b.namaProduk}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {formatAngka(b.sisaDikirim, 2)} {b.namaUom}
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        value={jumlah[b.soLineId] ?? ''}
                        onChange={(e) => setJumlah((j) => ({ ...j, [b.soLineId]: e.target.value }))}
                        type="number" step="0.000001" min="0" max={Number(b.sisaDikirim)}
                        className="text-right tabular-nums"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={bekerja || !siap}>
              {bekerja ? 'Memproses…' : 'Kirim'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
