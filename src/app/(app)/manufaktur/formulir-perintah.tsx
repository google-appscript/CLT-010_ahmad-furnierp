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
  kuantitasDikonsumsi?: string
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

type KolomBaris = {
  kunci: string
  judul: string
  render: (baris: BarisPerintahFormulir, index: number) => React.ReactNode
  lebar?: string
  rataKanan?: boolean
}

const TANPA_RESEP = 'tanpa-resep'

export function FormulirPerintah({
  awal, produk, satuan, lokasi, resep,
  readOnly = false, nomor, statusBadge, aksiTambahan, dokumenTerkait,
}: {
  awal: NilaiAwalPerintah
  produk: PilihanProduk[]
  satuan: PilihanSatuan[]
  lokasi: PilihanLokasi[]
  resep: PilihanResep[]
  readOnly?: boolean
  nomor?: string
  statusBadge?: React.ReactNode
  aksiTambahan?: React.ReactNode
  dokumenTerkait?: React.ReactNode
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

  const produkLewatId = new Map(produk.map((p) => [p.id, p]))
  const satuanLewatId = new Map(satuan.map((s) => [s.id, s]))
  const lokasiLewatId = new Map(lokasi.map((l) => [l.id, l]))
  const resepLewatId = new Map(resep.map((r) => [r.id, r]))
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

  const KOLOM_EDIT: KolomBaris[] = [
    {
      kunci: 'bahan', judul: 'Bahan',
      render: (b, i) => (
        <Select value={b.produkId} onValueChange={(v) => pilihProdukBaris(i, v)}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Pilih bahan" /></SelectTrigger>
          <SelectContent>
            {produk.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.kode} — {p.nama}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      kunci: 'kuantitas', judul: 'Kuantitas', lebar: 'w-40', rataKanan: true,
      render: (b, i) => (
        <Input
          value={b.kuantitas} onChange={(e) => ubahBaris(i, { kuantitas: e.target.value })}
          type="number" step="0.000001" min="0" className="text-right tabular-nums"
        />
      ),
    },
    {
      kunci: 'satuan', judul: 'Satuan', lebar: 'w-40',
      render: (b, i) => (
        <Select value={b.uomId} onValueChange={(v) => ubahBaris(i, { uomId: v })}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Satuan" /></SelectTrigger>
          <SelectContent>
            {satuan.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ]

  const KOLOM_READONLY: KolomBaris[] = [
    { kunci: 'bahan', judul: 'Bahan', render: (b) => produkLewatId.get(b.produkId)?.nama ?? '—' },
    {
      kunci: 'dibutuhkan', judul: 'Dibutuhkan', rataKanan: true,
      render: (b) => `${formatAngka(b.kuantitas || '0', 2)} ${satuanLewatId.get(b.uomId)?.nama ?? ''}`,
    },
    {
      kunci: 'dikonsumsi', judul: 'Dikonsumsi', rataKanan: true,
      render: (b) => formatAngka(b.kuantitasDikonsumsi || '0', 2),
    },
  ]

  return (
    <form action={simpan}>
      <FormulirBingkai
        breadcrumb={[
          { label: 'Manufaktur' },
          { label: 'Perintah Produksi', href: '/manufaktur/perintah-produksi' },
          { label: nomor ?? 'Draft Baru' },
        ]}
        nomor={nomor ?? 'Draft Baru'}
        status={statusBadge}
        aksi={
          <div className="flex gap-3">
            {aksiTambahan}
            {!readOnly && (
              <>
                <Button type="submit" disabled={bekerja}>
                  {bekerja ? 'Menyimpan…' : 'Simpan Draft'}
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
                label="Produk yang Diproduksi" htmlFor="produkId" readOnly={readOnly}
                valueTampilan={produkLewatId.get(produkId) ? `${produkLewatId.get(produkId)!.kode} — ${produkLewatId.get(produkId)!.nama}` : '—'}
              >
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
              </FormulirField>
              <FormulirField
                label="Kuantitas" htmlFor="kuantitas" readOnly={readOnly}
                valueTampilan={`${formatAngka(awal.kuantitas, 2)} ${satuanLewatId.get(uomId)?.nama ?? ''}`}
              >
                <Input
                  id="kuantitas" type="number" step="0.000001" min="0" required
                  value={kuantitas} onChange={(e) => setKuantitas(e.target.value)}
                  onBlur={hitungUlangDariResep}
                  className="text-right tabular-nums"
                />
              </FormulirField>
              <FormulirField label="Satuan" htmlFor="uomId" readOnly={readOnly} valueTampilan={satuanLewatId.get(uomId)?.nama ?? '—'}>
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
              </FormulirField>
              <FormulirField
                label="Resep" htmlFor="bomId" readOnly={readOnly}
                valueTampilan={bomId !== TANPA_RESEP ? (resepLewatId.get(bomId)?.kode ?? '—') : 'Tanpa resep'}
              >
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
              </FormulirField>
              <FormulirField label="Tanggal" htmlFor="tanggal" readOnly={readOnly} valueTampilan={awal.tanggal}>
                <Input id="tanggal" name="tanggal" type="date" required defaultValue={awal.tanggal} />
              </FormulirField>
            </>
          }
          kanan={
            <>
              <FormulirField label="Gudang Bahan" htmlFor="lokasiSumberId" readOnly={readOnly} valueTampilan={lokasiLewatId.get(lokasiSumberId)?.nama ?? '—'}>
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
              </FormulirField>
              <FormulirField label="Gudang Barang Jadi" htmlFor="lokasiTujuanId" readOnly={readOnly} valueTampilan={lokasiLewatId.get(lokasiTujuanId)?.nama ?? '—'}>
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
              </FormulirField>
              <FormulirField label="Target Selesai" htmlFor="tanggalTarget" readOnly={readOnly} valueTampilan={awal.tanggalTarget || '—'}>
                <Input id="tanggalTarget" name="tanggalTarget" type="date" defaultValue={awal.tanggalTarget} />
              </FormulirField>
              <FormulirField label="Referensi" htmlFor="referensi" readOnly={readOnly} valueTampilan={awal.referensi || '—'}>
                <Input id="referensi" name="referensi" defaultValue={awal.referensi} placeholder="Opsional" />
              </FormulirField>
              <FormulirField label="Biaya Tenaga Kerja" htmlFor="biayaTenagaKerja" readOnly={readOnly} valueTampilan={formatAngka(awal.biayaTenagaKerja)}>
                <Input
                  id="biayaTenagaKerja" name="biayaTenagaKerja" type="number" step="0.01" min="0"
                  defaultValue={awal.biayaTenagaKerja} className="text-right tabular-nums"
                />
              </FormulirField>
              <FormulirField label="Biaya Overhead" htmlFor="biayaOverhead" readOnly={readOnly} valueTampilan={formatAngka(awal.biayaOverhead)}>
                <Input
                  id="biayaOverhead" name="biayaOverhead" type="number" step="0.01" min="0"
                  defaultValue={awal.biayaOverhead} className="text-right tabular-nums"
                />
              </FormulirField>
              <FormulirField label="Catatan" htmlFor="catatan" readOnly={readOnly} valueTampilan={awal.catatan || '—'}>
                <Textarea id="catatan" name="catatan" rows={1} defaultValue={awal.catatan} />
              </FormulirField>
            </>
          }
        />

        {!readOnly && (
          <p className="text-sm text-muted-foreground">
            Biaya tenaga kerja dan overhead diserap ke harga pokok barang jadi: keduanya mendebit
            Barang Dalam Proses dan mengkredit akun bebannya, sehingga tidak dihitung dua kali
            ketika barangnya terjual.
          </p>
        )}

        <FormulirNotebook
          tab={[
            {
              id: 'kebutuhan-bahan',
              label: 'Kebutuhan Bahan',
              children: (
                <FormulirBarisTabel
                  kolom={readOnly ? KOLOM_READONLY : KOLOM_EDIT}
                  baris={baris}
                  onTambahBaris={readOnly ? undefined : () => setBaris((l) => [...l, { produkId: '', kuantitas: '', uomId: '' }])}
                  onHapusBaris={readOnly ? undefined : (i) => setBaris((l) => (l.length <= 1 ? l : l.filter((_, j) => j !== i)))}
                  labelTambah="Tambah Bahan"
                  readOnly={readOnly}
                />
              ),
            },
            {
              id: 'lainnya',
              label: 'Harga Pokok & Dokumen',
              children: dokumenTerkait ?? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Harga pokok dan dokumen terkait tersedia setelah perintah dikonfirmasi.
                </p>
              ),
            },
          ]}
        />
      </FormulirBingkai>
    </form>
  )
}
