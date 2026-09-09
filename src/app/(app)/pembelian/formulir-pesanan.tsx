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
import { aksiSimpanPesanan } from './aksi'

export type PilihanProduk = { id: string; kode: string; nama: string; uomId: string }
export type PilihanSatuan = { id: string; nama: string; kategori: string }
export type PilihanPajak = { id: string; kode: string; nama: string; tarif: string; isPemotongan: boolean }
export type PilihanUmum = { id: string; nama: string }

export type BarisFormulir = {
  produkId: string
  deskripsi: string
  kuantitas: string
  uomId: string
  hargaSatuan: string
  taxId: string
}

const BARIS_KOSONG: BarisFormulir = {
  produkId: '', deskripsi: '', kuantitas: '', uomId: '', hargaSatuan: '', taxId: '',
}

export type NilaiAwalPesanan = {
  id?: string
  partnerId: string
  tanggal: string
  tanggalDiharapkan: string
  lokasiTujuanId: string
  syaratPembayaranId: string
  referensi: string
  catatan: string
  baris: BarisFormulir[]
}

const TANPA_PAJAK = 'tanpa-pajak'

export function FormulirPesanan({
  awal, produk, satuan, pajak, pemasok, lokasi, syaratPembayaran,
}: {
  awal: NilaiAwalPesanan
  produk: PilihanProduk[]
  satuan: PilihanSatuan[]
  pajak: PilihanPajak[]
  pemasok: PilihanUmum[]
  lokasi: PilihanUmum[]
  syaratPembayaran: PilihanUmum[]
}) {
  const router = useRouter()
  const [menyimpan, mulai] = useTransition()
  const [baris, setBaris] = useState<BarisFormulir[]>(
    awal.baris.length > 0 ? awal.baris : [{ ...BARIS_KOSONG }],
  )
  const [partnerId, setPartnerId] = useState(awal.partnerId)
  const [lokasiTujuanId, setLokasiTujuanId] = useState(awal.lokasiTujuanId)
  const [syaratId, setSyaratId] = useState(awal.syaratPembayaranId)

  const produkLewatId = new Map(produk.map((p) => [p.id, p]))
  const satuanLewatId = new Map(satuan.map((s) => [s.id, s]))
  const pajakLewatId = new Map(pajak.map((p) => [p.id, p]))

  function ubahBaris(i: number, isi: Partial<BarisFormulir>) {
    setBaris((b) => b.map((x, j) => (j === i ? { ...x, ...isi } : x)))
  }

  /** Memilih produk sekaligus mengisi deskripsi dan satuan dasarnya. */
  function pilihProduk(i: number, produkId: string) {
    const p = produkLewatId.get(produkId)
    ubahBaris(i, { produkId, uomId: p?.uomId ?? '', deskripsi: p?.nama ?? '' })
  }

  function satuanSekategori(produkId: string): PilihanSatuan[] {
    const p = produkLewatId.get(produkId)
    if (!p) return satuan
    const kategori = satuanLewatId.get(p.uomId)?.kategori
    return kategori ? satuan.filter((s) => s.kategori === kategori) : satuan
  }

  // Ringkasan dihitung di peramban agar pengguna melihat dampak pajak
  // seketika; angka resmi tetap dihitung ulang di server saat disimpan.
  const ringkasan = baris.reduce(
    (t, b) => {
      const bruto = Number(b.kuantitas || 0) * Number(b.hargaSatuan || 0)
      const p = b.taxId && b.taxId !== TANPA_PAJAK ? pajakLewatId.get(b.taxId) : undefined
      if (!p) return { ...t, dpp: t.dpp + bruto }
      const nilaiPajak = bruto * (Number(p.tarif) / 100)
      return p.isPemotongan
        ? { ...t, dpp: t.dpp + bruto, pemotongan: t.pemotongan + nilaiPajak }
        : { ...t, dpp: t.dpp + bruto, ppn: t.ppn + nilaiPajak }
    },
    { dpp: 0, ppn: 0, pemotongan: 0 },
  )
  const totalTagihan = ringkasan.dpp + ringkasan.ppn

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanPesanan(awal.id ?? null, {
        partnerId,
        tanggal: String(data.get('tanggal') ?? ''),
        tanggalDiharapkan: String(data.get('tanggalDiharapkan') ?? '') || null,
        lokasiTujuanId,
        syaratPembayaranId: syaratId || null,
        mataUangId: 'IDR',
        referensi: String(data.get('referensi') ?? '') || null,
        catatan: String(data.get('catatan') ?? '') || null,
        baris: baris.map((b) => ({
          produkId: b.produkId,
          deskripsi: b.deskripsi,
          kuantitas: b.kuantitas,
          uomId: b.uomId,
          hargaSatuan: b.hargaSatuan || '0',
          taxId: b.taxId && b.taxId !== TANPA_PAJAK ? b.taxId : null,
        })),
      })

      if (hasil.berhasil) {
        toast.success(awal.id ? 'Permintaan berhasil disimpan' : 'Permintaan penawaran dibuat')
        router.push(`/pembelian/pesanan/${hasil.id}`)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <form action={simpan} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <Input id="tanggal" name="tanggal" type="date" defaultValue={awal.tanggal} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tanggalDiharapkan">Tanggal Diharapkan</Label>
          <Input
            id="tanggalDiharapkan" name="tanggalDiharapkan" type="date"
            defaultValue={awal.tanggalDiharapkan}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lokasiTujuanId">Gudang Tujuan</Label>
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
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="syaratPembayaranId">Syarat Pembayaran</Label>
          <Select value={syaratId} onValueChange={setSyaratId}>
            <SelectTrigger id="syaratPembayaranId" className="w-full">
              <SelectValue placeholder="Opsional" />
            </SelectTrigger>
            <SelectContent>
              {syaratPembayaran.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
          <h2 className="text-sm font-medium">Baris Produk</h2>
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
                <th className="px-3 py-2 text-left font-medium">Deskripsi</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Kuantitas</th>
                <th className="w-32 px-3 py-2 text-left font-medium">Satuan</th>
                <th className="w-40 px-3 py-2 text-right font-medium">Harga Satuan</th>
                <th className="w-44 px-3 py-2 text-left font-medium">Pajak</th>
                <th className="w-36 px-3 py-2 text-right font-medium">Jumlah</th>
                <th className="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {baris.map((b, i) => (
                <tr key={i} className="border-b">
                  <td className="px-3 py-1.5">
                    <Select value={b.produkId} onValueChange={(v) => pilihProduk(i, v)}>
                      <SelectTrigger className="w-full min-w-56">
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
                      value={b.deskripsi}
                      onChange={(e) => ubahBaris(i, { deskripsi: e.target.value })}
                      className="min-w-40"
                    />
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
                      <SelectTrigger className="w-full min-w-28">
                        <SelectValue placeholder="Satuan" />
                      </SelectTrigger>
                      <SelectContent>
                        {satuanSekategori(b.produkId).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={b.hargaSatuan}
                      onChange={(e) => ubahBaris(i, { hargaSatuan: e.target.value })}
                      type="number" step="0.000001" min="0"
                      className="text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Select
                      value={b.taxId || TANPA_PAJAK}
                      onValueChange={(v) => ubahBaris(i, { taxId: v })}
                    >
                      <SelectTrigger className="w-full min-w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TANPA_PAJAK}>Tanpa pajak</SelectItem>
                        {pajak.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatAngka(
                      (Number(b.kuantitas || 0) * Number(b.hargaSatuan || 0)).toFixed(2),
                    )}
                  </td>
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
          </table>
        </div>

        <dl className="mt-4 ml-auto max-w-sm space-y-1 text-sm">
          <Baris label="Dasar Pengenaan Pajak" nilai={ringkasan.dpp} />
          <Baris label="PPN Masukan" nilai={ringkasan.ppn} />
          <Baris label="Total Tagihan" nilai={totalTagihan} tegas />
          {ringkasan.pemotongan > 0 && (
            <>
              <Baris label="PPh Dipotong" nilai={-ringkasan.pemotongan} />
              <Baris label="Dibayar ke Pemasok" nilai={totalTagihan - ringkasan.pemotongan} tegas />
            </>
          )}
        </dl>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={menyimpan}>
          {menyimpan ? 'Menyimpan…' : 'Simpan Permintaan'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
      </div>
    </form>
  )
}

function Baris({ label, nilai, tegas }: { label: string; nilai: number; tegas?: boolean }) {
  return (
    <div className={`flex justify-between ${tegas ? 'border-t pt-1 font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatAngka(nilai.toFixed(2))}</dd>
    </div>
  )
}
