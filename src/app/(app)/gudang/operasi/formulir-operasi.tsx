'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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

type KolomBaris = {
  kunci: string
  judul: string
  render: (baris: BarisFormulir, index: number) => React.ReactNode
  lebar?: string
  rataKanan?: boolean
}

export function FormulirOperasi({
  awal, produk, lokasi, satuan, mitra,
  readOnly = false, nomor, statusBadge, aksiTambahan, dokumenTerkait,
}: {
  awal: NilaiAwalOperasi
  produk: PilihanProduk[]
  lokasi: PilihanLokasi[]
  satuan: PilihanSatuan[]
  mitra: PilihanMitra[]
  readOnly?: boolean
  nomor?: string
  statusBadge?: React.ReactNode
  aksiTambahan?: React.ReactNode
  dokumenTerkait?: React.ReactNode
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
  const labelKuantitas = awal.tipe === 'opname' ? 'Hasil Hitung' : 'Kuantitas'
  const produkLewatId = new Map(produk.map((p) => [p.id, p]))
  const satuanLewatId = new Map(satuan.map((s) => [s.id, s]))
  const lokasiLewatId = new Map(lokasi.map((l) => [l.id, l]))
  const mitraLewatId = new Map(mitra.map((m) => [m.id, m]))

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

  const KOLOM_EDIT: KolomBaris[] = [
    {
      kunci: 'produk', judul: 'Produk',
      render: (b, i) => (
        <Select value={b.produkId} onValueChange={(v) => pilihProduk(i, v)}>
          <SelectTrigger className="w-full min-w-64"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
          <SelectContent>
            {produk.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.kode} — {p.nama}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      kunci: 'kuantitas', judul: labelKuantitas, lebar: 'w-36', rataKanan: true,
      render: (b, i) => (
        <Input
          value={b.kuantitas} onChange={(e) => ubahBaris(i, { kuantitas: e.target.value })}
          type="number" step="0.000001" min="0" placeholder="0" className="text-right tabular-nums"
        />
      ),
    },
    {
      kunci: 'satuan', judul: 'Satuan', lebar: 'w-40',
      render: (b, i) => (
        <Select value={b.uomId} onValueChange={(v) => ubahBaris(i, { uomId: v })}>
          <SelectTrigger className="w-full min-w-32"><SelectValue placeholder="Satuan" /></SelectTrigger>
          <SelectContent>
            {satuanSekategori(b.produkId).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    ...(perluHarga ? [{
      kunci: 'hargaSatuan', judul: 'Harga Satuan', lebar: 'w-44', rataKanan: true,
      render: (b: BarisFormulir, i: number) => (
        <Input
          value={b.hargaSatuan} onChange={(e) => ubahBaris(i, { hargaSatuan: e.target.value })}
          type="number" step="0.000001" min="0" placeholder="0" className="text-right tabular-nums"
        />
      ),
    }] : []),
  ]

  const KOLOM_READONLY: KolomBaris[] = [
    { kunci: 'produk', judul: 'Produk', render: (b) => produkLewatId.get(b.produkId)?.nama ?? '—' },
    {
      kunci: 'kuantitas', judul: labelKuantitas, rataKanan: true,
      render: (b) => `${formatAngka(b.kuantitas || '0', 2)} ${satuanLewatId.get(b.uomId)?.nama ?? ''}`,
    },
    ...(perluHarga ? [{
      kunci: 'hargaSatuan', judul: 'Harga Satuan', rataKanan: true,
      render: (b: BarisFormulir) => formatAngka(b.hargaSatuan || '0'),
    }] : []),
  ]

  return (
    <form action={simpan}>
      <FormulirBingkai
        breadcrumb={[
          { label: 'Gudang' },
          { label: 'Operasi', href: `/gudang/operasi/${TIPE_KE_SLUG[awal.tipe]}` },
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
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          {DESKRIPSI_TIPE[awal.tipe]}
        </p>

        <FormulirGrid
          kiri={
            <>
              <FormulirField label="Tanggal" htmlFor="tanggal" readOnly={readOnly} valueTampilan={awal.tanggal}>
                <Input id="tanggal" name="tanggal" type="date" defaultValue={awal.tanggal} required />
              </FormulirField>
              <FormulirField label="Lokasi Asal" htmlFor="lokasiAsalId" readOnly={readOnly} valueTampilan={lokasiLewatId.get(lokasiAsalId)?.nama ?? '—'}>
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
              </FormulirField>
            </>
          }
          kanan={
            <>
              <FormulirField label="Lokasi Tujuan" htmlFor="lokasiTujuanId" readOnly={readOnly} valueTampilan={lokasiLewatId.get(lokasiTujuanId)?.nama ?? '—'}>
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
              </FormulirField>
              <FormulirField label="Mitra Usaha" htmlFor="partnerId" readOnly={readOnly} valueTampilan={partnerId ? mitraLewatId.get(partnerId)?.nama ?? '—' : '—'}>
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
              </FormulirField>
            </>
          }
        />

        <FormulirGrid
          kiri={
            <FormulirField label="Referensi" htmlFor="referensi" readOnly={readOnly} valueTampilan={awal.referensi || '—'}>
              <Input id="referensi" name="referensi" defaultValue={awal.referensi} placeholder="Opsional" />
            </FormulirField>
          }
          kanan={
            <FormulirField label="Catatan" htmlFor="catatan" readOnly={readOnly} valueTampilan={awal.catatan || '—'}>
              <Textarea id="catatan" name="catatan" defaultValue={awal.catatan} rows={1} />
            </FormulirField>
          }
        />

        <FormulirNotebook
          tab={[
            {
              id: 'baris-produk',
              label: awal.tipe === 'opname' ? 'Hasil Hitung Fisik' : 'Baris Produk',
              children: (
                <div className="space-y-4">
                  <FormulirBarisTabel
                    kolom={readOnly ? KOLOM_READONLY : KOLOM_EDIT}
                    baris={baris}
                    onTambahBaris={readOnly ? undefined : () => setBaris((b) => [...b, { ...BARIS_KOSONG }])}
                    onHapusBaris={readOnly ? undefined : (i) => setBaris((x) => (x.length <= 1 ? x : x.filter((_, j) => j !== i)))}
                    labelTambah="Tambah Baris"
                    readOnly={readOnly}
                  />
                  {perluHarga && (
                    <dl className="ml-auto max-w-sm space-y-1 text-sm">
                      <div className="flex justify-between border-t pt-1 font-semibold">
                        <dt>Perkiraan Nilai</dt>
                        <dd className="tabular-nums">{formatAngka(totalNilai.toFixed(2))}</dd>
                      </div>
                    </dl>
                  )}
                </div>
              ),
            },
            {
              id: 'lainnya',
              label: 'Pergerakan Stok & Jurnal',
              children: dokumenTerkait ?? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Pergerakan stok dan jurnal tersedia setelah operasi diselesaikan.
                </p>
              ),
            },
          ]}
        />
      </FormulirBingkai>
    </form>
  )
}
