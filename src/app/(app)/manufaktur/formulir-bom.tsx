'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormulirBingkai } from '@/components/formulir/formulir-bingkai'
import { FormulirGrid } from '@/components/formulir/formulir-grid'
import { FormulirField } from '@/components/formulir/formulir-field'
import { FormulirNotebook } from '@/components/formulir/formulir-notebook'
import { FormulirBarisTabel } from '@/components/formulir/formulir-baris-tabel'
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

type KolomBaris = {
  kunci: string
  judul: string
  render: (baris: BarisBomFormulir, index: number) => React.ReactNode
  lebar?: string
  rataKanan?: boolean
}

export function FormulirBom({
  awal, produk, satuan, statusBadge, aksiTambahan,
}: {
  awal: NilaiAwalBom
  produk: PilihanProduk[]
  satuan: PilihanSatuan[]
  statusBadge?: React.ReactNode
  aksiTambahan?: React.ReactNode
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

  return (
    <form action={simpan}>
      <FormulirBingkai
        breadcrumb={[
          { label: 'Manufaktur' },
          { label: 'Bill of Materials', href: '/manufaktur/bom' },
          { label: awal.nama || 'Resep Baru' },
        ]}
        nomor={awal.nama || 'Resep Baru'}
        status={statusBadge}
        aksi={
          <div className="flex gap-3">
            {aksiTambahan}
            <Button type="submit" disabled={bekerja}>
              {bekerja ? 'Menyimpan…' : 'Simpan Resep'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>Batal</Button>
          </div>
        }
      >
        <FormulirGrid
          kiri={
            <>
              <FormulirField label="Kode Resep" htmlFor="kode">
                <Input id="kode" name="kode" required defaultValue={awal.kode} placeholder="BOM-KRS-01" />
              </FormulirField>
              <FormulirField label="Nama Resep" htmlFor="nama">
                <Input id="nama" name="nama" required defaultValue={awal.nama} />
              </FormulirField>
              <FormulirField label="Produk Hasil" htmlFor="produkId">
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
              </FormulirField>
            </>
          }
          kanan={
            <>
              <FormulirField label="Menghasilkan" htmlFor="kuantitas">
                <Input
                  id="kuantitas" name="kuantitas" type="number" step="0.000001" min="0" required
                  defaultValue={awal.kuantitas} className="text-right tabular-nums"
                />
              </FormulirField>
              <FormulirField label="Satuan" htmlFor="uomId">
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
              <FormulirField label="Catatan" htmlFor="catatan">
                <Textarea id="catatan" name="catatan" rows={1} defaultValue={awal.catatan} />
              </FormulirField>
            </>
          }
        />

        <p className="text-sm text-muted-foreground">
          Kebutuhan bahan diskalakan terhadap kuantitas hasil di atas, sehingga resep boleh
          ditulis untuk satu unit maupun untuk satu batch sekaligus.
        </p>

        <FormulirNotebook
          tab={[
            {
              id: 'bahan',
              label: 'Bahan',
              children: (
                <FormulirBarisTabel
                  kolom={KOLOM_EDIT}
                  baris={baris}
                  onTambahBaris={() => setBaris((l) => [...l, { produkId: '', kuantitas: '', uomId: '' }])}
                  onHapusBaris={(i) => setBaris((l) => (l.length <= 1 ? l : l.filter((_, j) => j !== i)))}
                  labelTambah="Tambah Bahan"
                />
              ),
            },
          ]}
        />
      </FormulirBingkai>
    </form>
  )
}
