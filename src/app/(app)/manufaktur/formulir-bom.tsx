'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { aksiSimpanBom } from './aksi'

export type PilihanProduk = { id: string; kode: string; nama: string; uomId: string }
export type PilihanSatuan = { id: string; kode: string; nama: string }

export type BarisBomFormulir = {
  produkId: string
  kuantitas: string
  uomId: string
}

export type NilaiAwalBom = {
  id?: string
  kode: string
  nama: string
  produkId: string
  kuantitas: string
  uomId: string
  catatan: string
  baris: BarisBomFormulir[]
}

export function FormulirBom({
  awal, produk, satuan,
}: {
  awal: NilaiAwalBom
  produk: PilihanProduk[]
  satuan: PilihanSatuan[]
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()
  const [produkId, setProdukId] = useState(awal.produkId)
  const [uomId, setUomId] = useState(awal.uomId)
  const [baris, setBaris] = useState<BarisBomFormulir[]>(
    awal.baris.length > 0 ? awal.baris : [{ produkId: '', kuantitas: '', uomId: '' }],
  )

  function ubahBaris(i: number, ubah: Partial<BarisBomFormulir>) {
    setBaris((lama) => lama.map((b, j) => (j === i ? { ...b, ...ubah } : b)))
  }

  function pilihProdukBaris(i: number, id: string) {
    const p = produk.find((x) => x.id === id)
    ubahBaris(i, { produkId: id, uomId: p?.uomId ?? '' })
  }

  function pilihProdukHasil(id: string) {
    setProdukId(id)
    const p = produk.find((x) => x.id === id)
    if (p && !awal.id) setUomId(p.uomId)
  }

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanBom(awal.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        produkId,
        kuantitas: String(data.get('kuantitas') ?? ''),
        uomId,
        catatan: String(data.get('catatan') ?? '') || null,
        baris: baris
          .filter((b) => b.produkId && Number(b.kuantitas) > 0)
          .map((b) => ({
            produkId: b.produkId,
            kuantitas: b.kuantitas,
            uomId: b.uomId,
            catatan: null,
          })),
      })

      if (hasil.berhasil) {
        toast.success('Resep berhasil disimpan')
        router.push(`/manufaktur/bom/${hasil.id}`)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <form action={simpan} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="kode">Kode Resep</Label>
          <Input id="kode" name="kode" required defaultValue={awal.kode} placeholder="BOM-KRS-01" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nama">Nama Resep</Label>
          <Input id="nama" name="nama" required defaultValue={awal.nama} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="produkId">Produk Hasil</Label>
          <Select value={produkId} onValueChange={pilihProdukHasil} required>
            <SelectTrigger id="produkId" className="w-full">
              <SelectValue placeholder="Pilih produk" />
            </SelectTrigger>
            <SelectContent>
              {produk.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.kode} — {p.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="kuantitas">Menghasilkan</Label>
            <Input
              id="kuantitas" name="kuantitas" type="number" step="0.000001" min="0" required
              defaultValue={awal.kuantitas} className="text-right tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="uomId">Satuan</Label>
            <Select value={uomId} onValueChange={setUomId} required>
              <SelectTrigger id="uomId" className="w-full">
                <SelectValue placeholder="Satuan" />
              </SelectTrigger>
              <SelectContent>
                {satuan.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Kebutuhan bahan diskalakan terhadap kuantitas hasil di atas, sehingga resep boleh
        ditulis untuk satu unit maupun untuk satu batch sekaligus.
      </p>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Bahan</h2>
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => setBaris((l) => [...l, { produkId: '', kuantitas: '', uomId: '' }])}
          >
            <Plus className="mr-2 h-4 w-4" />Tambah Bahan
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Bahan</th>
                <th className="w-40 px-3 py-2 text-right font-medium">Kuantitas</th>
                <th className="w-40 px-3 py-2 text-left font-medium">Satuan</th>
                <th className="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {baris.map((b, i) => (
                <tr key={i} className="border-b">
                  <td className="px-3 py-1.5">
                    <Select value={b.produkId} onValueChange={(v) => pilihProdukBaris(i, v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih bahan" />
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
                      value={b.kuantitas}
                      onChange={(e) => ubahBaris(i, { kuantitas: e.target.value })}
                      type="number" step="0.000001" min="0"
                      className="text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Select value={b.uomId} onValueChange={(v) => ubahBaris(i, { uomId: v })}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Satuan" />
                      </SelectTrigger>
                      <SelectContent>
                        {satuan.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Button
                      type="button" variant="ghost" size="icon"
                      aria-label={`Hapus bahan ${i + 1}`}
                      disabled={baris.length === 1}
                      onClick={() => setBaris((l) => l.filter((_, j) => j !== i))}
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
        <Textarea id="catatan" name="catatan" rows={2} defaultValue={awal.catatan} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={bekerja}>
          {bekerja ? 'Menyimpan…' : 'Simpan Resep'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
      </div>
    </form>
  )
}
