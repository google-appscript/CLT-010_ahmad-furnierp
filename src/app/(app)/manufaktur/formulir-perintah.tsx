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
import { aksiSimpanPerintah, aksiKebutuhanBahan } from './aksi'
import type { PilihanProduk, PilihanSatuan } from './formulir-bom'

export type PilihanLokasi = { id: string; kode: string; nama: string }
export type PilihanResep = {
  id: string; kode: string; nama: string; produkId: string; kuantitas: string
}

export type BarisPerintahFormulir = {
  produkId: string
  kuantitas: string
  uomId: string
}

export type NilaiAwalPerintah = {
  id?: string
  produkId: string
  bomId: string
  kuantitas: string
  uomId: string
  tanggal: string
  tanggalTarget: string
  lokasiSumberId: string
  lokasiTujuanId: string
  biayaTenagaKerja: string
  biayaOverhead: string
  referensi: string
  catatan: string
  baris: BarisPerintahFormulir[]
}

const TANPA_RESEP = 'tanpa-resep'

export function FormulirPerintah({
  awal, produk, satuan, lokasi, resep,
}: {
  awal: NilaiAwalPerintah
  produk: PilihanProduk[]
  satuan: PilihanSatuan[]
  lokasi: PilihanLokasi[]
  resep: PilihanResep[]
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()
  const [produkId, setProdukId] = useState(awal.produkId)
  const [bomId, setBomId] = useState(awal.bomId || TANPA_RESEP)
  const [kuantitas, setKuantitas] = useState(awal.kuantitas)
  const [uomId, setUomId] = useState(awal.uomId)
  const [lokasiSumberId, setLokasiSumberId] = useState(awal.lokasiSumberId)
  const [lokasiTujuanId, setLokasiTujuanId] = useState(awal.lokasiTujuanId)
  const [baris, setBaris] = useState<BarisPerintahFormulir[]>(
    awal.baris.length > 0 ? awal.baris : [{ produkId: '', kuantitas: '', uomId: '' }],
  )

  const resepProduk = resep.filter((r) => r.produkId === produkId)

  function ubahBaris(i: number, ubah: Partial<BarisPerintahFormulir>) {
    setBaris((lama) => lama.map((b, j) => (j === i ? { ...b, ...ubah } : b)))
  }

  function pilihProdukBaris(i: number, id: string) {
    const p = produk.find((x) => x.id === id)
    ubahBaris(i, { produkId: id, uomId: p?.uomId ?? '' })
  }

  function pilihProduk(id: string) {
    setProdukId(id)
    setBomId(TANPA_RESEP)
    const p = produk.find((x) => x.id === id)
    if (p) setUomId(p.uomId)
  }

  /** Memilih resep mengisi baris bahan dari kebutuhan yang sudah diskalakan. */
  function pilihResep(id: string) {
    setBomId(id)
    if (id === TANPA_RESEP) return
    mulai(async () => {
      const hasil = await aksiKebutuhanBahan(id, kuantitas || '1')
      if (!hasil.berhasil) {
        toast.error(hasil.pesan)
        return
      }
      setBaris(hasil.baris.map((b) => ({
        produkId: b.produkId,
        kuantitas: String(Number(b.kuantitas)),
        uomId: b.uomId,
      })))
      toast.success('Kebutuhan bahan diisi dari resep')
    })
  }

  function hitungUlangDariResep() {
    if (bomId === TANPA_RESEP) return
    pilihResep(bomId)
  }

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanPerintah(awal.id ?? null, {
        produkId,
        bomId: bomId === TANPA_RESEP ? null : bomId,
        kuantitas,
        uomId,
        tanggal: String(data.get('tanggal') ?? ''),
        tanggalTarget: String(data.get('tanggalTarget') ?? '') || null,
        lokasiSumberId,
        lokasiTujuanId,
        biayaTenagaKerja: String(data.get('biayaTenagaKerja') ?? '') || '0',
        biayaOverhead: String(data.get('biayaOverhead') ?? '') || '0',
        referensi: String(data.get('referensi') ?? '') || null,
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
        toast.success('Perintah produksi berhasil disimpan')
        router.push(`/manufaktur/perintah-produksi/${hasil.id}`)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <form action={simpan} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="produkId">Produk yang Diproduksi</Label>
          <Select value={produkId} onValueChange={pilihProduk} required>
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
            <Label htmlFor="kuantitas">Kuantitas</Label>
            <Input
              id="kuantitas" type="number" step="0.000001" min="0" required
              value={kuantitas} onChange={(e) => setKuantitas(e.target.value)}
              onBlur={hitungUlangDariResep}
              className="text-right tabular-nums"
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
        <div className="space-y-2">
          <Label htmlFor="bomId">Resep</Label>
          <Select value={bomId} onValueChange={pilihResep}>
            <SelectTrigger id="bomId" className="w-full">
              <SelectValue placeholder="Tanpa resep" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TANPA_RESEP}>Tanpa resep</SelectItem>
              {resepProduk.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.kode} — {r.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tanggal">Tanggal</Label>
          <Input id="tanggal" name="tanggal" type="date" required defaultValue={awal.tanggal} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="lokasiSumberId">Gudang Bahan</Label>
          <Select value={lokasiSumberId} onValueChange={setLokasiSumberId} required>
            <SelectTrigger id="lokasiSumberId" className="w-full">
              <SelectValue placeholder="Pilih gudang" />
            </SelectTrigger>
            <SelectContent>
              {lokasi.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lokasiTujuanId">Gudang Barang Jadi</Label>
          <Select value={lokasiTujuanId} onValueChange={setLokasiTujuanId} required>
            <SelectTrigger id="lokasiTujuanId" className="w-full">
              <SelectValue placeholder="Pilih gudang" />
            </SelectTrigger>
            <SelectContent>
              {lokasi.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tanggalTarget">Target Selesai</Label>
          <Input
            id="tanggalTarget" name="tanggalTarget" type="date"
            defaultValue={awal.tanggalTarget}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="referensi">Referensi</Label>
          <Input id="referensi" name="referensi" defaultValue={awal.referensi} placeholder="Opsional" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="biayaTenagaKerja">Biaya Tenaga Kerja</Label>
          <Input
            id="biayaTenagaKerja" name="biayaTenagaKerja" type="number" step="0.01" min="0"
            defaultValue={awal.biayaTenagaKerja} className="text-right tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="biayaOverhead">Biaya Overhead</Label>
          <Input
            id="biayaOverhead" name="biayaOverhead" type="number" step="0.01" min="0"
            defaultValue={awal.biayaOverhead} className="text-right tabular-nums"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="catatan">Catatan</Label>
          <Textarea id="catatan" name="catatan" rows={1} defaultValue={awal.catatan} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Biaya tenaga kerja dan overhead diserap ke harga pokok barang jadi: keduanya mendebit
        Barang Dalam Proses dan mengkredit akun bebannya, sehingga tidak dihitung dua kali
        ketika barangnya terjual.
      </p>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Kebutuhan Bahan</h2>
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

      <div className="flex gap-3">
        <Button type="submit" disabled={bekerja}>
          {bekerja ? 'Menyimpan…' : 'Simpan Draft'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
      </div>
    </form>
  )
}
