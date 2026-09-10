'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatAngka } from '@/lib/uang'
import { FormulirBingkai } from '@/components/formulir/formulir-bingkai'
import { FormulirGrid } from '@/components/formulir/formulir-grid'
import { FormulirField } from '@/components/formulir/formulir-field'
import { FormulirNotebook } from '@/components/formulir/formulir-notebook'
import { FormulirBarisTabel } from '@/components/formulir/formulir-baris-tabel'
import { aksiSimpanTagihan } from './aksi'

export type PilihanAkun = { id: string; kode: string; nama: string }
export type PilihanPajak = { id: string; nama: string; tarif: string; isPemotongan: boolean }
export type PilihanUmum = { id: string; nama: string }

export type BarisFormulir = {
  produkId: string
  poLineId: string
  deskripsi: string
  kuantitas: string
  hargaSatuan: string
  taxId: string
  akunId: string
}

const BARIS_KOSONG: BarisFormulir = {
  produkId: '', poLineId: '', deskripsi: '',
  kuantitas: '', hargaSatuan: '', taxId: '', akunId: '',
}

const TANPA = 'tanpa'

export type NilaiAwalTagihan = {
  id?: string
  tipe: 'tagihan' | 'nota_debit'
  partnerId: string
  poId: string
  tanggal: string
  tanggalJatuhTempo: string
  referensiPemasok: string
  catatan: string
  baris: BarisFormulir[]
}

type KolomBaris = {
  kunci: string
  judul: string
  render: (baris: BarisFormulir, index: number) => React.ReactNode
  lebar?: string
  rataKanan?: boolean
}

export function FormulirTagihan({
  awal, pemasok, akun, pajak,
  readOnly = false, nomor, statusBadge, aksiTambahan, dokumenTerkait,
}: {
  awal: NilaiAwalTagihan
  pemasok: PilihanUmum[]
  akun: PilihanAkun[]
  pajak: PilihanPajak[]
  readOnly?: boolean
  nomor?: string
  statusBadge?: React.ReactNode
  aksiTambahan?: React.ReactNode
  dokumenTerkait?: { jurnal?: { id: string; nomor: string }; pesanan?: { id: string; nomor: string }; ringkasan?: React.ReactNode }
}) {
  const router = useRouter()
  const [menyimpan, mulai] = useTransition()
  const [baris, setBaris] = useState<BarisFormulir[]>(
    awal.baris.length > 0 ? awal.baris : [{ ...BARIS_KOSONG }],
  )
  const [partnerId, setPartnerId] = useState(awal.partnerId)
  const akunLewatId = new Map(akun.map((a) => [a.id, a]))
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
      const hasil = await aksiSimpanTagihan(awal.id ?? null, {
        tipe: awal.tipe,
        partnerId,
        poId: awal.poId || null,
        tanggal: String(data.get('tanggal') ?? ''),
        tanggalJatuhTempo: String(data.get('tanggalJatuhTempo') ?? '') || null,
        referensiPemasok: String(data.get('referensiPemasok') ?? '') || null,
        mataUangId: 'IDR',
        catatan: String(data.get('catatan') ?? '') || null,
        baris: baris.map((b) => ({
          produkId: b.produkId || null,
          poLineId: b.poLineId || null,
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
        router.push(`/akuntansi/pemasok/tagihan/${hasil.id}`)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  const KOLOM_EDIT: KolomBaris[] = [
    {
      kunci: 'deskripsi', judul: 'Deskripsi',
      render: (b, i) => (
        <Input value={b.deskripsi} onChange={(e) => ubahBaris(i, { deskripsi: e.target.value })} className="min-w-48" />
      ),
    },
    {
      kunci: 'akun', judul: 'Akun Debit',
      render: (b, i) => (
        <Select value={b.akunId} onValueChange={(v) => ubahBaris(i, { akunId: v })}>
          <SelectTrigger className="w-full min-w-56"><SelectValue placeholder="Pilih akun" /></SelectTrigger>
          <SelectContent>
            {akun.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      kunci: 'kuantitas', judul: 'Kuantitas', lebar: 'w-28', rataKanan: true,
      render: (b, i) => (
        <Input
          value={b.kuantitas} onChange={(e) => ubahBaris(i, { kuantitas: e.target.value })}
          type="number" step="0.000001" min="0" className="text-right tabular-nums"
        />
      ),
    },
    {
      kunci: 'hargaSatuan', judul: 'Harga Satuan', lebar: 'w-40', rataKanan: true,
      render: (b, i) => (
        <Input
          value={b.hargaSatuan} onChange={(e) => ubahBaris(i, { hargaSatuan: e.target.value })}
          type="number" step="0.000001" min="0" className="text-right tabular-nums"
        />
      ),
    },
    {
      kunci: 'pajak', judul: 'Pajak', lebar: 'w-44',
      render: (b, i) => (
        <Select value={b.taxId || TANPA} onValueChange={(v) => ubahBaris(i, { taxId: v })}>
          <SelectTrigger className="w-full min-w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TANPA}>Tanpa pajak</SelectItem>
            {pajak.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      kunci: 'jumlah', judul: 'Jumlah', lebar: 'w-36', rataKanan: true,
      render: (b) => formatAngka((Number(b.kuantitas || 0) * Number(b.hargaSatuan || 0)).toFixed(2)),
    },
  ]

  const KOLOM_READONLY: KolomBaris[] = [
    { kunci: 'deskripsi', judul: 'Deskripsi', render: (b) => b.deskripsi },
    { kunci: 'akun', judul: 'Akun', render: (b) => akunLewatId.get(b.akunId)?.nama ?? '—' },
    { kunci: 'kuantitas', judul: 'Kuantitas', rataKanan: true, render: (b) => formatAngka(b.kuantitas || '0') },
    { kunci: 'hargaSatuan', judul: 'Harga Satuan', rataKanan: true, render: (b) => formatAngka(b.hargaSatuan || '0') },
    { kunci: 'pajak', judul: 'Pajak', render: (b) => (b.taxId ? pajakLewatId.get(b.taxId)?.nama ?? '—' : '—') },
    {
      kunci: 'jumlah', judul: 'Jumlah', rataKanan: true,
      render: (b) => formatAngka((Number(b.kuantitas || 0) * Number(b.hargaSatuan || 0)).toFixed(2)),
    },
  ]

  return (
    <form action={simpan}>
      <FormulirBingkai
        breadcrumb={[
          { label: 'Akuntansi' },
          { label: awal.tipe === 'nota_debit' ? 'Nota Debit' : 'Tagihan Pembelian', href: awal.tipe === 'nota_debit' ? '/akuntansi/pemasok/nota-debit' : '/akuntansi/pemasok/tagihan' },
          { label: nomor ?? 'Draft Baru' },
        ]}
        nomor={nomor ?? 'Draft Baru'}
        status={statusBadge}
        aksi={
          <div className="flex gap-3">
            {aksiTambahan}
            {!readOnly && (
              <>
                <Button type="submit" disabled={menyimpan}>
                  {menyimpan ? 'Menyimpan…' : 'Simpan Draft'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.back()}>Batal</Button>
              </>
            )}
          </div>
        }
      >
        <FormulirGrid
          kiri={
            <>
              <FormulirField
                label="Pemasok" htmlFor="partnerId" readOnly={readOnly}
                valueTampilan={pemasok.find((p) => p.id === partnerId)?.nama ?? '—'}
              >
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
              </FormulirField>
              <FormulirField label="Tanggal" htmlFor="tanggal" readOnly={readOnly} valueTampilan={awal.tanggal}>
                <Input id="tanggal" name="tanggal" type="date" defaultValue={awal.tanggal} required />
              </FormulirField>
            </>
          }
          kanan={
            <>
              <FormulirField
                label="Jatuh Tempo" htmlFor="tanggalJatuhTempo" readOnly={readOnly}
                valueTampilan={awal.tanggalJatuhTempo || '—'}
              >
                <Input id="tanggalJatuhTempo" name="tanggalJatuhTempo" type="date" defaultValue={awal.tanggalJatuhTempo} />
              </FormulirField>
              <FormulirField
                label="Nomor Faktur Pemasok" htmlFor="referensiPemasok" readOnly={readOnly}
                valueTampilan={awal.referensiPemasok || '—'}
              >
                <Input id="referensiPemasok" name="referensiPemasok" defaultValue={awal.referensiPemasok} placeholder="Opsional" />
              </FormulirField>
              <FormulirField label="Catatan" htmlFor="catatan" readOnly={readOnly} valueTampilan={awal.catatan || '—'}>
                <Textarea id="catatan" name="catatan" defaultValue={awal.catatan} rows={1} />
              </FormulirField>
            </>
          }
        />

        <FormulirNotebook
          tab={[
            {
              id: 'baris-tagihan',
              label: 'Baris Tagihan',
              children: (
                <div className="space-y-4">
                  <FormulirBarisTabel
                    kolom={readOnly ? KOLOM_READONLY : KOLOM_EDIT}
                    baris={baris}
                    onTambahBaris={readOnly ? undefined : () => setBaris((b) => [...b, { ...BARIS_KOSONG }])}
                    onHapusBaris={
                      readOnly ? undefined : (i) => setBaris((x) => (x.length <= 1 ? x : x.filter((_, j) => j !== i)))
                    }
                    labelTambah="Tambah Baris"
                    readOnly={readOnly}
                  />
                  <dl className="ml-auto max-w-sm space-y-1 text-sm">
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
              ),
            },
            {
              id: 'lainnya',
              label: 'Lainnya',
              children: dokumenTerkait ? (
                <div className="space-y-3">
                  {dokumenTerkait.jurnal && (
                    <p className="text-sm">
                      Jurnal{' '}
                      <Link href={`/akuntansi/jurnal/entri/${dokumenTerkait.jurnal.id}`} className="font-medium underline">
                        {dokumenTerkait.jurnal.nomor}
                      </Link>
                    </p>
                  )}
                  {dokumenTerkait.pesanan && (
                    <p className="text-sm">
                      Pesanan{' '}
                      <Link href={`/pembelian/pesanan/${dokumenTerkait.pesanan.id}`} className="font-medium underline">
                        {dokumenTerkait.pesanan.nomor}
                      </Link>
                    </p>
                  )}
                  {dokumenTerkait.ringkasan}
                </div>
              ) : (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Belum ada dokumen terkait.
                </p>
              ),
            },
          ]}
        />
      </FormulirBingkai>
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
