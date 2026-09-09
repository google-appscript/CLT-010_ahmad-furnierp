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
import { formatAngka } from '@/lib/uang'
import { TIPE_KE_SLUG, DESKRIPSI_TIPE } from '@/modules/gudang/validasi/operasi'
import { aksiSimpanOperasi } from './aksi'

export type PilihanProduk = { id: string; kode: string; nama: string; uomId: string }
export type PilihanLokasi = { id: string; kode: string; nama: string; tipe: string }
export type PilihanSatuan = { id: string; kode: string; nama: string; kategori: string }
export type PilihanMitra = { id: string; nama: string }

export type BarisFormulir = {
  produkId: string
  kuantitas: string
  uomId: string
  hargaSatuan: string
  catatan: string
}

const BARIS_KOSONG: BarisFormulir = {
  produkId: '', kuantitas: '', uomId: '', hargaSatuan: '', catatan: '',
}

export type NilaiAwalOperasi = {
  id?: string
  tipe: string
  tanggal: string
  lokasiAsalId: string
  lokasiTujuanId: string
  partnerId: string
  referensi: string
  catatan: string
  baris: BarisFormulir[]
}

export function FormulirOperasi({
  awal, produk, lokasi, satuan, mitra,
}: {
  awal: NilaiAwalOperasi
  produk: PilihanProduk[]
  lokasi: PilihanLokasi[]
  satuan: PilihanSatuan[]
  mitra: PilihanMitra[]
}) {
  const router = useRouter()
  const [menyimpan, mulai] = useTransition()
  const [baris, setBaris] = useState<BarisFormulir[]>(
    awal.baris.length > 0 ? awal.baris : [{ ...BARIS_KOSONG }],
  )
  const [lokasiAsalId, setLokasiAsalId] = useState(awal.lokasiAsalId)
  const [lokasiTujuanId, setLokasiTujuanId] = useState(awal.lokasiTujuanId)
  const [partnerId, setPartnerId] = useState(awal.partnerId)

  const perluHarga = awal.tipe === 'penerimaan'
  const produkLewatId = new Map(produk.map((p) => [p.id, p]))
  const satuanLewatId = new Map(satuan.map((s) => [s.id, s]))

  function ubahBaris(i: number, isi: Partial<BarisFormulir>) {
    setBaris((b) => b.map((x, j) => (j === i ? { ...x, ...isi } : x)))
  }

  /** Memilih produk sekaligus menetapkan satuan dasarnya sebagai bawaan. */
  function pilihProduk(i: number, produkId: string) {
    const p = produkLewatId.get(produkId)
    ubahBaris(i, { produkId, uomId: p?.uomId ?? '' })
  }

  function satuanSekategori(produkId: string): PilihanSatuan[] {
    const p = produkLewatId.get(produkId)
    if (!p) return satuan
    const kategori = satuanLewatId.get(p.uomId)?.kategori
    return kategori ? satuan.filter((s) => s.kategori === kategori) : satuan
  }

  const totalNilai = baris.reduce(
    (t, b) => t + Number(b.kuantitas || 0) * Number(b.hargaSatuan || 0), 0,
  )

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanOperasi(awal.id ?? null, {
        tipe: awal.tipe as never,
        tanggal: String(data.get('tanggal') ?? ''),
        lokasiAsalId, lokasiTujuanId,
        partnerId: partnerId || null,
        referensi: String(data.get('referensi') ?? '') || null,
        catatan: String(data.get('catatan') ?? '') || null,
        baris: baris.map((b) => ({
          produkId: b.produkId,
          kuantitas: b.kuantitas,
          uomId: b.uomId,
          hargaSatuan: perluHarga ? (b.hargaSatuan || '0') : null,
          catatan: b.catatan || null,
        })),
      })

      if (hasil.berhasil) {
        toast.success(awal.id ? 'Operasi berhasil disimpan' : 'Draft operasi berhasil dibuat')
        router.push(`/gudang/operasi/${TIPE_KE_SLUG[awal.tipe]}/${hasil.id}`)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  const lokasiInternal = lokasi.filter((l) => l.tipe === 'internal')
  const lokasiAsalPilihan = awal.tipe === 'transfer' || awal.tipe === 'pengiriman' || awal.tipe === 'barang_rusak'
    ? lokasiInternal
    : lokasi.filter((l) => l.tipe !== 'internal')
  const lokasiTujuanPilihan = awal.tipe === 'transfer' || awal.tipe === 'penerimaan' || awal.tipe === 'opname'
    ? lokasiInternal
    : lokasi.filter((l) => l.tipe !== 'internal')

  return (
    <form action={simpan} className="space-y-6">
      <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        {DESKRIPSI_TIPE[awal.tipe]}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="tanggal">Tanggal</Label>
          <Input id="tanggal" name="tanggal" type="date" defaultValue={awal.tanggal} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lokasiAsalId">Lokasi Asal</Label>
          <Select value={lokasiAsalId} onValueChange={setLokasiAsalId} required>
            <SelectTrigger id="lokasiAsalId" className="w-full">
              <SelectValue placeholder="Pilih lokasi" />
            </SelectTrigger>
            <SelectContent>
              {lokasiAsalPilihan.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lokasiTujuanId">Lokasi Tujuan</Label>
          <Select value={lokasiTujuanId} onValueChange={setLokasiTujuanId} required>
            <SelectTrigger id="lokasiTujuanId" className="w-full">
              <SelectValue placeholder="Pilih lokasi" />
            </SelectTrigger>
            <SelectContent>
              {lokasiTujuanPilihan.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="partnerId">Mitra Usaha</Label>
          <Select value={partnerId} onValueChange={setPartnerId}>
            <SelectTrigger id="partnerId" className="w-full">
              <SelectValue placeholder="Opsional" />
            </SelectTrigger>
            <SelectContent>
              {mitra.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="referensi">Referensi</Label>
          <Input id="referensi" name="referensi" defaultValue={awal.referensi} placeholder="Opsional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="catatan">Catatan</Label>
          <Textarea id="catatan" name="catatan" defaultValue={awal.catatan} rows={1} />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">
            {awal.tipe === 'opname' ? 'Hasil Hitung Fisik' : 'Baris Produk'}
          </h2>
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => setBaris((b) => [...b, { ...BARIS_KOSONG }])}
          >
            <Plus className="mr-2 h-4 w-4" />Tambah Baris
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Produk</th>
                <th className="w-36 px-3 py-2 text-right font-medium">
                  {awal.tipe === 'opname' ? 'Hasil Hitung' : 'Kuantitas'}
                </th>
                <th className="w-40 px-3 py-2 text-left font-medium">Satuan</th>
                {perluHarga && (
                  <th className="w-44 px-3 py-2 text-right font-medium">Harga Satuan</th>
                )}
                <th className="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {baris.map((b, i) => (
                <tr key={i} className="border-b">
                  <td className="px-3 py-1.5">
                    <Select value={b.produkId} onValueChange={(v) => pilihProduk(i, v)}>
                      <SelectTrigger className="w-full min-w-64">
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
                      value={b.kuantitas}
                      onChange={(e) => ubahBaris(i, { kuantitas: e.target.value })}
                      type="number" step="0.000001" min="0" placeholder="0"
                      className="text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Select value={b.uomId} onValueChange={(v) => ubahBaris(i, { uomId: v })}>
                      <SelectTrigger className="w-full min-w-32">
                        <SelectValue placeholder="Satuan" />
                      </SelectTrigger>
                      <SelectContent>
                        {satuanSekategori(b.produkId).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  {perluHarga && (
                    <td className="px-3 py-1.5">
                      <Input
                        value={b.hargaSatuan}
                        onChange={(e) => ubahBaris(i, { hargaSatuan: e.target.value })}
                        type="number" step="0.000001" min="0" placeholder="0"
                        className="text-right tabular-nums"
                      />
                    </td>
                  )}
                  <td className="px-3 py-1.5">
                    <Button
                      type="button" variant="ghost" size="icon"
                      onClick={() => setBaris((x) => (x.length <= 1 ? x : x.filter((_, j) => j !== i)))}
                      disabled={baris.length <= 1}
                      aria-label={`Hapus baris ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            {perluHarga && (
              <tfoot className="border-t-2 bg-muted/40 font-semibold">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right">Perkiraan Nilai</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatAngka(totalNilai.toFixed(2))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={menyimpan}>
          {menyimpan ? 'Menyimpan…' : 'Simpan Draft'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
      </div>
    </form>
  )
}
