'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatAngka } from '@/lib/uang'
import { LABEL_METODE } from '@/modules/aset/validasi/aset'
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

const TANPA_MITRA = 'tanpa-mitra'

export function FormulirAset({
  awal, kategori, mitra,
}: {
  awal: NilaiAwalAset
  kategori: PilihanKategori[]
  mitra: { id: string; nama: string }[]
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
    <form action={simpan} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="kode">Kode Aset</Label>
          <Input id="kode" name="kode" required defaultValue={awal.kode} placeholder="AST-001" />
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="nama">Nama Aset</Label>
          <Input id="nama" name="nama" required defaultValue={awal.nama} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kategoriId">Kategori</Label>
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
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="tanggalPerolehan">Tanggal Perolehan</Label>
          <Input
            id="tanggalPerolehan" name="tanggalPerolehan" type="date" required
            defaultValue={awal.tanggalPerolehan}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tanggalMulaiDepresiasi">Mulai Disusutkan</Label>
          <Input
            id="tanggalMulaiDepresiasi" name="tanggalMulaiDepresiasi" type="date" required
            defaultValue={awal.tanggalMulaiDepresiasi}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nilaiPerolehan">Nilai Perolehan</Label>
          <Input
            id="nilaiPerolehan" type="number" step="0.01" min="0" required
            value={nilaiPerolehan} onChange={(e) => setNilaiPerolehan(e.target.value)}
            className="text-right tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nilaiResidu">Nilai Residu</Label>
          <Input
            id="nilaiResidu" type="number" step="0.01" min="0"
            value={nilaiResidu} onChange={(e) => setNilaiResidu(e.target.value)}
            className="text-right tabular-nums"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="masaManfaatBulan">Masa Manfaat (bulan)</Label>
          <Input
            id="masaManfaatBulan" type="number" step="1" min="1" required
            value={masaManfaatBulan} onChange={(e) => setMasaManfaatBulan(e.target.value)}
            className="text-right tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="metode">Metode Depresiasi</Label>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="partnerId">Pemasok</Label>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="referensi">Referensi</Label>
          <Input id="referensi" name="referensi" defaultValue={awal.referensi} placeholder="Nomor tagihan" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="catatan">Catatan</Label>
        <Textarea id="catatan" name="catatan" rows={2} defaultValue={awal.catatan} />
      </div>

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

      <p className="text-sm text-muted-foreground">
        Mendaftarkan aset tidak memposting perolehannya. Nilai aset sudah masuk buku besar lewat
        tagihan pembelian atau saldo awal; modul ini hanya menyusutkannya.
      </p>

      <div className="flex gap-3">
        <Button type="submit" disabled={bekerja}>
          {bekerja ? 'Menyimpan…' : 'Simpan Aset'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
      </div>
    </form>
  )
}
