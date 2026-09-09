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
import { aksiSimpanFaktur } from './aksi'

export type PilihanAkun = { id: string; kode: string; nama: string }
export type PilihanPajak = { id: string; nama: string; tarif: string; isPemotongan: boolean }
export type PilihanUmum = { id: string; nama: string }

export type BarisFormulir = {
  produkId: string
  soLineId: string
  deskripsi: string
  kuantitas: string
  hargaSatuan: string
  taxId: string
  akunId: string
}

const BARIS_KOSONG: BarisFormulir = {
  produkId: '', soLineId: '', deskripsi: '',
  kuantitas: '', hargaSatuan: '', taxId: '', akunId: '',
}

const TANPA = 'tanpa'

export type NilaiAwalFaktur = {
  id?: string
  tipe: 'faktur' | 'nota_kredit'
  partnerId: string
  soId: string
  tanggal: string
  tanggalJatuhTempo: string
  referensi: string
  catatan: string
  baris: BarisFormulir[]
}

export function FormulirFaktur({
  awal, pelanggan, akun, pajak,
}: {
  awal: NilaiAwalFaktur
  pelanggan: PilihanUmum[]
  akun: PilihanAkun[]
  pajak: PilihanPajak[]
}) {
  const router = useRouter()
  const [menyimpan, mulai] = useTransition()
  const [baris, setBaris] = useState<BarisFormulir[]>(
    awal.baris.length > 0 ? awal.baris : [{ ...BARIS_KOSONG }],
  )
  const [partnerId, setPartnerId] = useState(awal.partnerId)
  const pajakLewatId = new Map(pajak.map((p) => [p.id, p]))

  function ubahBaris(i: number, isi: Partial<BarisFormulir>) {
    setBaris((b) => b.map((x, j) => (j === i ? { ...x, ...isi } : x)))
  }

  const ringkasan = baris.reduce(
    (t, b) => {
      const bruto = Number(b.kuantitas || 0) * Number(b.hargaSatuan || 0)
      const p = b.taxId && b.taxId !== TANPA ? pajakLewatId.get(b.taxId) : undefined
      if (!p) return { ...t, dpp: t.dpp + bruto }
      const nilai = bruto * (Number(p.tarif) / 100)
      return p.isPemotongan
        ? { ...t, dpp: t.dpp + bruto, pemotongan: t.pemotongan + nilai }
        : { ...t, dpp: t.dpp + bruto, ppn: t.ppn + nilai }
    },
    { dpp: 0, ppn: 0, pemotongan: 0 },
  )
  const totalTagihan = ringkasan.dpp + ringkasan.ppn

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanFaktur(awal.id ?? null, {
        tipe: awal.tipe,
        partnerId,
        soId: awal.soId || null,
        tanggal: String(data.get('tanggal') ?? ''),
        tanggalJatuhTempo: String(data.get('tanggalJatuhTempo') ?? '') || null,
        referensi: String(data.get('referensi') ?? '') || null,
        mataUangId: 'IDR',
        catatan: String(data.get('catatan') ?? '') || null,
        baris: baris.map((b) => ({
          produkId: b.produkId || null,
          soLineId: b.soLineId || null,
          deskripsi: b.deskripsi,
          kuantitas: b.kuantitas,
          uomId: null,
          hargaSatuan: b.hargaSatuan || '0',
          taxId: b.taxId && b.taxId !== TANPA ? b.taxId : null,
          akunId: b.akunId,
        })),
      })

      if (hasil.berhasil) {
        toast.success('Dokumen berhasil disimpan')
        router.push(`/akuntansi/pelanggan/faktur/${hasil.id}`)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <form action={simpan} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <Input id="tanggal" name="tanggal" type="date" defaultValue={awal.tanggal} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tanggalJatuhTempo">Jatuh Tempo</Label>
          <Input
            id="tanggalJatuhTempo" name="tanggalJatuhTempo" type="date"
            defaultValue={awal.tanggalJatuhTempo}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="referensi">Referensi</Label>
          <Input
            id="referensi" name="referensi"
            defaultValue={awal.referensi} placeholder="Opsional"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="catatan">Catatan</Label>
        <Textarea id="catatan" name="catatan" defaultValue={awal.catatan} rows={1} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Baris Faktur</h2>
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
                <th className="px-3 py-2 text-left font-medium">Deskripsi</th>
                <th className="px-3 py-2 text-left font-medium">Akun Pendapatan</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Kuantitas</th>
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
                    <Input
                      value={b.deskripsi}
                      onChange={(e) => ubahBaris(i, { deskripsi: e.target.value })}
                      className="min-w-48"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Select value={b.akunId} onValueChange={(v) => ubahBaris(i, { akunId: v })}>
                      <SelectTrigger className="w-full min-w-56">
                        <SelectValue placeholder="Pilih akun" />
                      </SelectTrigger>
                      <SelectContent>
                        {akun.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
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
                    <Input
                      value={b.hargaSatuan}
                      onChange={(e) => ubahBaris(i, { hargaSatuan: e.target.value })}
                      type="number" step="0.000001" min="0"
                      className="text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Select
                      value={b.taxId || TANPA}
                      onValueChange={(v) => ubahBaris(i, { taxId: v })}
                    >
                      <SelectTrigger className="w-full min-w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TANPA}>Tanpa pajak</SelectItem>
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
          <BarisRingkas label="Dasar Pengenaan Pajak" nilai={ringkasan.dpp} />
          <BarisRingkas label="PPN Keluaran" nilai={ringkasan.ppn} />
          <BarisRingkas label="Total Faktur" nilai={totalTagihan} tegas />
          {ringkasan.pemotongan > 0 && (
            <>
              <BarisRingkas label="PPh Dipotong Pelanggan" nilai={-ringkasan.pemotongan} />
              <BarisRingkas label="Diterima dari Pelanggan" nilai={totalTagihan - ringkasan.pemotongan} tegas />
            </>
          )}
        </dl>
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

function BarisRingkas({ label, nilai, tegas }: { label: string; nilai: number; tegas?: boolean }) {
  return (
    <div className={`flex justify-between ${tegas ? 'border-t pt-1 font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatAngka(nilai.toFixed(2))}</dd>
    </div>
  )
}
