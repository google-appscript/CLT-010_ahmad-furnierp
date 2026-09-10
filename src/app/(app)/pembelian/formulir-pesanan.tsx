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
  /** Hanya terisi saat `readOnly` (dari `barisDenganSisa()`); `undefined` saat draft. */
  kuantitasDiterima?: string
  /** Hanya terisi saat `readOnly` (dari `barisDenganSisa()`); `undefined` saat draft. */
  kuantitasDitagih?: string
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

type KolomBaris = {
  kunci: string
  judul: string
  render: (baris: BarisFormulir, index: number) => React.ReactNode
  lebar?: string
  rataKanan?: boolean
}

export function FormulirPesanan({
  awal, produk, satuan, pajak, pemasok, lokasi, syaratPembayaran,
  readOnly = false, nomor, statusBadge, aksiTambahan, dokumenTerkait,
}: {
  awal: NilaiAwalPesanan
  produk: PilihanProduk[]
  satuan: PilihanSatuan[]
  pajak: PilihanPajak[]
  pemasok: PilihanUmum[]
  lokasi: PilihanUmum[]
  syaratPembayaran: PilihanUmum[]
  readOnly?: boolean
  nomor?: string
  statusBadge?: React.ReactNode
  aksiTambahan?: React.ReactNode
  dokumenTerkait?: {
    penerimaan: { operasiId: string; nomor: string; tanggal: string }[]
    tagihan: { id: string; nomor: string | null; status: string }[]
  }
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

  const KOLOM_EDIT: KolomBaris[] = [
    {
      kunci: 'produk', judul: 'Produk',
      render: (b, i) => (
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
      ),
    },
    {
      kunci: 'deskripsi', judul: 'Deskripsi',
      render: (b, i) => (
        <Input
          value={b.deskripsi}
          onChange={(e) => ubahBaris(i, { deskripsi: e.target.value })}
          className="min-w-40"
        />
      ),
    },
    {
      kunci: 'kuantitas', judul: 'Kuantitas', lebar: 'w-28', rataKanan: true,
      render: (b, i) => (
        <Input
          value={b.kuantitas}
          onChange={(e) => ubahBaris(i, { kuantitas: e.target.value })}
          type="number" step="0.000001" min="0"
          className="text-right tabular-nums"
        />
      ),
    },
    {
      kunci: 'uom', judul: 'Satuan', lebar: 'w-32',
      render: (b, i) => (
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
      ),
    },
    {
      kunci: 'hargaSatuan', judul: 'Harga Satuan', lebar: 'w-40', rataKanan: true,
      render: (b, i) => (
        <Input
          value={b.hargaSatuan}
          onChange={(e) => ubahBaris(i, { hargaSatuan: e.target.value })}
          type="number" step="0.000001" min="0"
          className="text-right tabular-nums"
        />
      ),
    },
    {
      kunci: 'pajak', judul: 'Pajak', lebar: 'w-44',
      render: (b, i) => (
        <Select value={b.taxId || TANPA_PAJAK} onValueChange={(v) => ubahBaris(i, { taxId: v })}>
          <SelectTrigger className="w-full min-w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TANPA_PAJAK}>Tanpa pajak</SelectItem>
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
    { kunci: 'produk', judul: 'Produk', render: (b) => b.deskripsi },
    { kunci: 'dipesan', judul: 'Dipesan', rataKanan: true, render: (b) => formatAngka(b.kuantitas || '0') },
    { kunci: 'diterima', judul: 'Diterima', rataKanan: true, render: (b) => formatAngka(b.kuantitasDiterima ?? '0') },
    { kunci: 'ditagih', judul: 'Ditagih', rataKanan: true, render: (b) => formatAngka(b.kuantitasDitagih ?? '0') },
    { kunci: 'hargaSatuan', judul: 'Harga Satuan', rataKanan: true, render: (b) => formatAngka(b.hargaSatuan || '0') },
    {
      kunci: 'pajak', judul: 'Pajak',
      render: (b) => (b.taxId ? pajakLewatId.get(b.taxId)?.nama ?? '—' : '—'),
    },
    {
      kunci: 'jumlah', judul: 'Jumlah', rataKanan: true,
      render: (b) => formatAngka((Number(b.kuantitas || 0) * Number(b.hargaSatuan || 0)).toFixed(2)),
    },
  ]

  return (
    <form action={simpan}>
      <FormulirBingkai
        breadcrumb={[
          { label: 'Pembelian' },
          { label: 'Pesanan Pembelian', href: '/pembelian/pesanan' },
          { label: nomor ?? 'Permintaan Baru' },
        ]}
        nomor={nomor ?? 'Permintaan Baru'}
        status={statusBadge}
        aksi={
          <div className="flex gap-3">
            {aksiTambahan}
            {!readOnly && (
              <>
                <Button type="submit" disabled={menyimpan}>
                  {menyimpan ? 'Menyimpan…' : 'Simpan Permintaan'}
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

              <FormulirField
                label="Tanggal" htmlFor="tanggal" readOnly={readOnly}
                valueTampilan={awal.tanggal}
              >
                <Input id="tanggal" name="tanggal" type="date" defaultValue={awal.tanggal} required />
              </FormulirField>

              <FormulirField
                label="Tanggal Diharapkan" htmlFor="tanggalDiharapkan" readOnly={readOnly}
                valueTampilan={awal.tanggalDiharapkan || '—'}
              >
                <Input
                  id="tanggalDiharapkan" name="tanggalDiharapkan" type="date"
                  defaultValue={awal.tanggalDiharapkan}
                />
              </FormulirField>
            </>
          }
          kanan={
            <>
              <FormulirField
                label="Gudang Tujuan" htmlFor="lokasiTujuanId" readOnly={readOnly}
                valueTampilan={lokasi.find((l) => l.id === lokasiTujuanId)?.nama ?? '—'}
              >
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

              <FormulirField
                label="Syarat Pembayaran" htmlFor="syaratPembayaranId" readOnly={readOnly}
                valueTampilan={syaratPembayaran.find((s) => s.id === syaratId)?.nama ?? '—'}
              >
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
              </FormulirField>

              <FormulirField
                label="Referensi" htmlFor="referensi" readOnly={readOnly}
                valueTampilan={awal.referensi || '—'}
              >
                <Input id="referensi" name="referensi" defaultValue={awal.referensi} placeholder="Opsional" />
              </FormulirField>

              <FormulirField
                label="Catatan" htmlFor="catatan" readOnly={readOnly}
                valueTampilan={awal.catatan || '—'}
              >
                <Textarea id="catatan" name="catatan" defaultValue={awal.catatan} rows={1} />
              </FormulirField>
            </>
          }
        />

        <FormulirNotebook
          tab={[
            {
              id: 'baris-pesanan',
              label: 'Baris Pesanan',
              children: (
                <div className="space-y-4">
                  <FormulirBarisTabel
                    kolom={readOnly ? KOLOM_READONLY : KOLOM_EDIT}
                    baris={baris}
                    onTambahBaris={
                      readOnly ? undefined : () => setBaris((b) => [...b, { ...BARIS_KOSONG }])
                    }
                    onHapusBaris={
                      readOnly
                        ? undefined
                        : (i) => setBaris((x) => (x.length <= 1 ? x : x.filter((_, j) => j !== i)))
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
                <div className="grid gap-6 lg:grid-cols-2">
                  <section>
                    <h3 className="mb-3 text-sm font-medium text-muted-foreground">Penerimaan Barang</h3>
                    {dokumenTerkait.penerimaan.length === 0 ? (
                      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Belum ada penerimaan.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {dokumenTerkait.penerimaan.map((p) => (
                          <li
                            key={p.operasiId}
                            className="flex items-center justify-between rounded-md border px-4 py-2 text-sm"
                          >
                            <Link
                              href={`/gudang/operasi/penerimaan/${p.operasiId}`}
                              className="font-mono text-xs underline"
                            >
                              {p.nomor}
                            </Link>
                            <span className="text-muted-foreground">{p.tanggal}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-3 text-sm font-medium text-muted-foreground">Tagihan Pemasok</h3>
                    {dokumenTerkait.tagihan.length === 0 ? (
                      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Belum ada tagihan.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {dokumenTerkait.tagihan.map((t) => (
                          <li
                            key={t.id}
                            className="flex items-center justify-between rounded-md border px-4 py-2 text-sm"
                          >
                            <Link
                              href={`/akuntansi/pemasok/tagihan/${t.id}`}
                              className="font-mono text-xs underline"
                            >
                              {t.nomor ?? 'Draft'}
                            </Link>
                            <span className="text-muted-foreground">{t.status}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
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
