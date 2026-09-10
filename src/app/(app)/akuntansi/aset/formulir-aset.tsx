'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatAngka } from '@/lib/uang'
import { LABEL_METODE } from '@/modules/aset/validasi/aset'
import { FormulirBingkai } from '@/components/formulir/formulir-bingkai'
import { FormulirGrid } from '@/components/formulir/formulir-grid'
import { FormulirField } from '@/components/formulir/formulir-field'
import { FormulirBarisTabel } from '@/components/formulir/formulir-baris-tabel'
import { aksiSimpanAset } from './aksi'

export type PilihanKategori = {
  id: string
  kode: string
  nama: string
  dapatDidepresiasi: boolean
  metodeBawaan: string
  masaManfaatBulanBawaan: number
}

export type NilaiAwalAset = {
  id?: string
  kode: string
  nama: string
  kategoriId: string
  tanggalPerolehan: string
  tanggalMulaiDepresiasi: string
  nilaiPerolehan: string
  nilaiResidu: string
  masaManfaatBulan: string
  metode: string
  partnerId: string
  referensi: string
  catatan: string
}

export type BarisJadwal = {
  id: string
  urutan: number
  tanggal: string
  nilai: string
  akumulasi: string
  nilaiBuku: string
  status: string
  nomorJurnal?: string
  jurnalEntryId?: string
  tombolPosting?: React.ReactNode
}

const TANPA_MITRA = 'tanpa-mitra'

export function FormulirAset({
  awal, kategori, mitra,
  readOnly = false, statusBadge, aksiTambahan, ringkasanTambahan, jadwal,
}: {
  awal: NilaiAwalAset
  kategori: PilihanKategori[]
  mitra: { id: string; nama: string }[]
  readOnly?: boolean
  statusBadge?: React.ReactNode
  aksiTambahan?: React.ReactNode
  ringkasanTambahan?: React.ReactNode
  jadwal?: BarisJadwal[]
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()
  const [kategoriId, setKategoriId] = useState(awal.kategoriId)
  const [metode, setMetode] = useState(awal.metode)
  const [partnerId, setPartnerId] = useState(awal.partnerId || TANPA_MITRA)
  const [nilaiPerolehan, setNilaiPerolehan] = useState(awal.nilaiPerolehan)
  const [nilaiResidu, setNilaiResidu] = useState(awal.nilaiResidu)
  const [masaManfaatBulan, setMasaManfaatBulan] = useState(awal.masaManfaatBulan)

  const kategoriTerpilih = kategori.find((k) => k.id === kategoriId)
  const dasar = Math.max(Number(nilaiPerolehan || 0) - Number(nilaiResidu || 0), 0)
  const perBulan = Number(masaManfaatBulan) > 0 ? dasar / Number(masaManfaatBulan) : 0

  /** Kategori membawa metode dan masa manfaat bawaannya sendiri. */
  function pilihKategori(id: string) {
    setKategoriId(id)
    const k = kategori.find((x) => x.id === id)
    if (!k || awal.id) return
    setMetode(k.metodeBawaan)
    setMasaManfaatBulan(String(k.masaManfaatBulanBawaan))
  }

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanAset(awal.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        kategoriId,
        tanggalPerolehan: String(data.get('tanggalPerolehan') ?? ''),
        tanggalMulaiDepresiasi: String(data.get('tanggalMulaiDepresiasi') ?? ''),
        nilaiPerolehan: nilaiPerolehan || '0',
        nilaiResidu: nilaiResidu || '0',
        masaManfaatBulan: masaManfaatBulan || '0',
        metode: metode as 'garis_lurus' | 'saldo_menurun_ganda',
        partnerId: partnerId === TANPA_MITRA ? null : partnerId,
        referensi: String(data.get('referensi') ?? '') || null,
        catatan: String(data.get('catatan') ?? '') || null,
      })

      if (hasil.berhasil) {
        toast.success('Aset berhasil disimpan')
        router.push(`/akuntansi/aset/${hasil.id}`)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <form action={simpan}>
      <FormulirBingkai
        breadcrumb={[
          { label: 'Akuntansi' },
          { label: 'Daftar Aset', href: '/akuntansi/aset' },
          { label: awal.id ? `${awal.kode} — ${awal.nama}` : 'Aset Baru' },
        ]}
        nomor={awal.id ? `${awal.kode} — ${awal.nama}` : 'Aset Baru'}
        status={statusBadge}
        aksi={
          <div className="flex gap-3">
            {aksiTambahan}
            {!readOnly && (
              <>
                <Button type="submit" disabled={bekerja}>
                  {bekerja ? 'Menyimpan…' : 'Simpan Aset'}
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
              <FormulirField label="Kode Aset" htmlFor="kode" readOnly={readOnly} valueTampilan={awal.kode}>
                <Input id="kode" name="kode" required defaultValue={awal.kode} placeholder="AST-001" />
              </FormulirField>
              <FormulirField label="Nama Aset" htmlFor="nama" readOnly={readOnly} valueTampilan={awal.nama}>
                <Input id="nama" name="nama" required defaultValue={awal.nama} />
              </FormulirField>
              <FormulirField
                label="Kategori" htmlFor="kategoriId" readOnly={readOnly}
                valueTampilan={kategori.find((k) => k.id === kategoriId)?.nama ?? '—'}
              >
                <Select value={kategoriId} onValueChange={pilihKategori} required>
                  <SelectTrigger id="kategoriId" className="w-full">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {kategori.map((k) => (
                      <SelectItem key={k.id} value={k.id}>{k.kode} — {k.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormulirField>
              <FormulirField
                label="Tanggal Perolehan" htmlFor="tanggalPerolehan" readOnly={readOnly}
                valueTampilan={awal.tanggalPerolehan}
              >
                <Input
                  id="tanggalPerolehan" name="tanggalPerolehan" type="date" required
                  defaultValue={awal.tanggalPerolehan}
                />
              </FormulirField>
              <FormulirField
                label="Mulai Disusutkan" htmlFor="tanggalMulaiDepresiasi" readOnly={readOnly}
                valueTampilan={awal.tanggalMulaiDepresiasi}
              >
                <Input
                  id="tanggalMulaiDepresiasi" name="tanggalMulaiDepresiasi" type="date" required
                  defaultValue={awal.tanggalMulaiDepresiasi}
                />
              </FormulirField>
            </>
          }
          kanan={
            <>
              <FormulirField
                label="Nilai Perolehan" htmlFor="nilaiPerolehan" readOnly={readOnly}
                valueTampilan={formatAngka(nilaiPerolehan || '0')}
              >
                <Input
                  id="nilaiPerolehan" type="number" step="0.01" min="0" required
                  value={nilaiPerolehan} onChange={(e) => setNilaiPerolehan(e.target.value)}
                  className="text-right tabular-nums"
                />
              </FormulirField>
              <FormulirField
                label="Nilai Residu" htmlFor="nilaiResidu" readOnly={readOnly}
                valueTampilan={formatAngka(nilaiResidu || '0')}
              >
                <Input
                  id="nilaiResidu" type="number" step="0.01" min="0"
                  value={nilaiResidu} onChange={(e) => setNilaiResidu(e.target.value)}
                  className="text-right tabular-nums"
                />
              </FormulirField>
              <FormulirField
                label="Masa Manfaat (bulan)" htmlFor="masaManfaatBulan" readOnly={readOnly}
                valueTampilan={masaManfaatBulan}
              >
                <Input
                  id="masaManfaatBulan" type="number" step="1" min="1" required
                  value={masaManfaatBulan} onChange={(e) => setMasaManfaatBulan(e.target.value)}
                  className="text-right tabular-nums"
                />
              </FormulirField>
              <FormulirField
                label="Metode Depresiasi" htmlFor="metode" readOnly={readOnly}
                valueTampilan={LABEL_METODE[metode as keyof typeof LABEL_METODE] ?? metode}
              >
                <Select value={metode} onValueChange={setMetode} required>
                  <SelectTrigger id="metode" className="w-full">
                    <SelectValue placeholder="Pilih metode" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LABEL_METODE).map(([nilai, label]) => (
                      <SelectItem key={nilai} value={nilai}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormulirField>
              <FormulirField
                label="Pemasok" htmlFor="partnerId" readOnly={readOnly}
                valueTampilan={mitra.find((m) => m.id === partnerId)?.nama ?? '—'}
              >
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger id="partnerId" className="w-full">
                    <SelectValue placeholder="Opsional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TANPA_MITRA}>Tanpa mitra</SelectItem>
                    {mitra.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormulirField>
              <FormulirField
                label="Referensi" htmlFor="referensi" readOnly={readOnly}
                valueTampilan={awal.referensi || '—'}
              >
                <Input id="referensi" name="referensi" defaultValue={awal.referensi} placeholder="Nomor tagihan" />
              </FormulirField>
            </>
          }
        />

        <FormulirField label="Catatan" htmlFor="catatan" readOnly={readOnly} valueTampilan={awal.catatan || '—'}>
          <Textarea id="catatan" name="catatan" rows={2} defaultValue={awal.catatan} />
        </FormulirField>

        {!readOnly && (
          <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
            {kategoriTerpilih && !kategoriTerpilih.dapatDidepresiasi ? (
              <p>
                Kategori {kategoriTerpilih.nama} tidak disusutkan, jadi aset ini hanya tercatat di
                register tanpa jadwal depresiasi.
              </p>
            ) : (
              <p>
                Nilai yang dapat disusutkan {formatAngka(dasar.toFixed(2))}
                {Number(masaManfaatBulan) > 0 && (
                  <> · rata-rata {formatAngka(perBulan.toFixed(2))} per bulan</>
                )}
                . Jadwal sebenarnya baru tersusun saat aset dijalankan.
              </p>
            )}
          </div>
        )}

        {!readOnly && (
          <p className="text-sm text-muted-foreground">
            Mendaftarkan aset tidak memposting perolehannya. Nilai aset sudah masuk buku besar lewat
            tagihan pembelian atau saldo awal; modul ini hanya menyusutkannya.
          </p>
        )}

        {ringkasanTambahan}

        {jadwal && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Jadwal Depresiasi</h2>
            <FormulirBarisTabel
              readOnly
              kolom={[
                { kunci: 'urutan', judul: 'Bulan', rataKanan: true, render: (b: BarisJadwal) => b.urutan },
                { kunci: 'tanggal', judul: 'Tanggal', render: (b: BarisJadwal) => b.tanggal },
                { kunci: 'nilai', judul: 'Beban', rataKanan: true, render: (b: BarisJadwal) => formatAngka(b.nilai) },
                { kunci: 'akumulasi', judul: 'Akumulasi', rataKanan: true, render: (b: BarisJadwal) => formatAngka(b.akumulasi) },
                { kunci: 'nilaiBuku', judul: 'Nilai Buku', rataKanan: true, render: (b: BarisJadwal) => formatAngka(b.nilaiBuku) },
                {
                  kunci: 'status', judul: 'Status',
                  render: (b: BarisJadwal) => (
                    <span className={b.status === 'diposting' ? 'font-medium' : 'text-muted-foreground'}>
                      {b.status === 'diposting' ? 'Diposting' : 'Draft'}
                    </span>
                  ),
                },
                {
                  kunci: 'jurnal', judul: 'Jurnal',
                  render: (b: BarisJadwal) => (b.jurnalEntryId ? (
                    <Link href={`/akuntansi/jurnal/entri/${b.jurnalEntryId}`} className="font-mono text-xs underline">
                      {b.nomorJurnal}
                    </Link>
                  ) : '—'),
                },
                { kunci: 'aksi', judul: '', render: (b: BarisJadwal) => b.tombolPosting },
              ]}
              baris={jadwal}
            />
          </div>
        )}
      </FormulirBingkai>
    </form>
  )
}
