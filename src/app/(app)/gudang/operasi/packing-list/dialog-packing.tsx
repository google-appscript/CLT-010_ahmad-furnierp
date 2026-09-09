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
import { aksiBuatPackingList } from './aksi'

export type PilihanPengiriman = { id: string; nomor: string; tanggal: string }
export type PilihanProduk = { id: string; kode: string; nama: string }

type Koli = { nomorKoli: string; produkId: string; kuantitas: string; beratKg: string }

const KOLI_KOSONG: Koli = { nomorKoli: '', produkId: '', kuantitas: '', beratKg: '' }

export function DialogPackingList({
  pengiriman, produk,
}: {
  pengiriman: PilihanPengiriman[]
  produk: PilihanProduk[]
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()
  const [operasiId, setOperasiId] = useState('')
  const [koli, setKoli] = useState<Koli[]>([{ ...KOLI_KOSONG }])

  function ubah(i: number, isi: Partial<Koli>) {
    setKoli((k) => k.map((x, j) => (j === i ? { ...x, ...isi } : x)))
  }

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiBuatPackingList({
        operasiId,
        tanggal: String(data.get('tanggal') ?? ''),
        catatan: String(data.get('catatan') ?? '') || null,
        item: koli.map((k) => ({
          nomorKoli: k.nomorKoli,
          produkId: k.produkId,
          kuantitas: k.kuantitas,
          beratKg: k.beratKg || null,
          catatan: null,
        })),
      })
      if (hasil.berhasil) {
        toast.success('Packing list berhasil dibuat')
        setTerbuka(false)
        setKoli([{ ...KOLI_KOSONG }])
        router.refresh()
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Buat Packing List</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Buat Packing List</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="operasiId">Pengiriman</Label>
              <Select value={operasiId} onValueChange={setOperasiId} required>
                <SelectTrigger id="operasiId" className="w-full">
                  <SelectValue placeholder="Pilih dokumen pengiriman" />
                </SelectTrigger>
                <SelectContent>
                  {pengiriman.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nomor} — {p.tanggal}</SelectItem>
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
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Rincian Koli</Label>
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => setKoli((k) => [...k, { ...KOLI_KOSONG }])}
              >
                <Plus className="mr-2 h-4 w-4" />Tambah Koli
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="w-32 px-3 py-2 text-left font-medium">Nomor Koli</th>
                    <th className="px-3 py-2 text-left font-medium">Produk</th>
                    <th className="w-28 px-3 py-2 text-right font-medium">Kuantitas</th>
                    <th className="w-28 px-3 py-2 text-right font-medium">Berat (kg)</th>
                    <th className="w-12 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {koli.map((k, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-1.5">
                        <Input
                          value={k.nomorKoli}
                          onChange={(e) => ubah(i, { nomorKoli: e.target.value })}
                          placeholder="KOLI-01"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Select value={k.produkId} onValueChange={(v) => ubah(i, { produkId: v })}>
                          <SelectTrigger className="w-full min-w-52">
                            <SelectValue placeholder="Pilih produk" />
                          </SelectTrigger>
                          <SelectContent>
                            {produk.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.kode} — {p.nama}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          value={k.kuantitas}
                          onChange={(e) => ubah(i, { kuantitas: e.target.value })}
                          type="number" step="0.000001" min="0"
                          className="text-right tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          value={k.beratKg}
                          onChange={(e) => ubah(i, { beratKg: e.target.value })}
                          type="number" step="0.001" min="0"
                          className="text-right tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Button
                          type="button" variant="ghost" size="icon"
                          onClick={() => setKoli((x) => (x.length <= 1 ? x : x.filter((_, j) => j !== i)))}
                          disabled={koli.length <= 1}
                          aria-label={`Hapus koli ${i + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="catatan">Catatan</Label>
            <Textarea id="catatan" name="catatan" rows={2} />
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
