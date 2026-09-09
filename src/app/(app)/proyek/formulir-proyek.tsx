'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { aksiSimpanProyek } from './aksi'

export type PilihanPesanan = {
  id: string; nomor: string; tanggal: string; namaPelanggan: string
}
export type PilihanPengguna = { id: string; nama: string }

export type NilaiAwalProyek = {
  id?: string
  kode: string
  nama: string
  soId: string
  tanggalMulai: string
  tanggalTarget: string
  manajerId: string
  tarifPerJam: string
  catatan: string
}

const TANPA_MANAJER = 'tanpa-manajer'

export function FormulirProyek({
  awal, pesanan, pengguna,
}: {
  awal: NilaiAwalProyek
  pesanan: PilihanPesanan[]
  pengguna: PilihanPengguna[]
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()
  const [soId, setSoId] = useState(awal.soId)
  const [manajerId, setManajerId] = useState(awal.manajerId || TANPA_MANAJER)

  const pesananTerpilih = pesanan.find((p) => p.id === soId)

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanProyek(awal.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        soId,
        tanggalMulai: String(data.get('tanggalMulai') ?? ''),
        tanggalTarget: String(data.get('tanggalTarget') ?? '') || null,
        manajerId: manajerId === TANPA_MANAJER ? null : manajerId,
        tarifPerJam: String(data.get('tarifPerJam') ?? '') || '0',
        catatan: String(data.get('catatan') ?? '') || null,
      })

      if (hasil.berhasil) {
        toast.success('Proyek berhasil disimpan')
        router.push(`/proyek/${hasil.id}`)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <form action={simpan} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="kode">Kode Proyek</Label>
          <Input id="kode" name="kode" required defaultValue={awal.kode} placeholder="PRJ-001" />
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="nama">Nama Proyek</Label>
          <Input id="nama" name="nama" required defaultValue={awal.nama} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="soId">Pesanan Penjualan</Label>
          <Select value={soId} onValueChange={setSoId} required>
            <SelectTrigger id="soId" className="w-full">
              <SelectValue placeholder="Pilih pesanan" />
            </SelectTrigger>
            <SelectContent>
              {pesanan.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nomor} — {p.namaPelanggan}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="tanggalMulai">Tanggal Mulai</Label>
          <Input
            id="tanggalMulai" name="tanggalMulai" type="date" required
            defaultValue={awal.tanggalMulai}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tanggalTarget">Target Selesai</Label>
          <Input
            id="tanggalTarget" name="tanggalTarget" type="date"
            defaultValue={awal.tanggalTarget}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manajerId">Manajer Proyek</Label>
          <Select value={manajerId} onValueChange={setManajerId}>
            <SelectTrigger id="manajerId" className="w-full">
              <SelectValue placeholder="Opsional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TANPA_MANAJER}>Belum ditentukan</SelectItem>
              {pengguna.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tarifPerJam">Tarif per Jam</Label>
          <Input
            id="tarifPerJam" name="tarifPerJam" type="number" step="0.01" min="0"
            defaultValue={awal.tarifPerJam} className="text-right tabular-nums"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="catatan">Catatan</Label>
        <Textarea id="catatan" name="catatan" rows={2} defaultValue={awal.catatan} />
      </div>

      <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
        {pesananTerpilih ? (
          <p>
            Proyek ini memegang {pesananTerpilih.nomor} untuk {pesananTerpilih.namaPelanggan}.
            Apa pun yang difakturkan atas pesanan itu menjadi pendapatan proyek ini, tanpa
            alokasi.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Satu proyek memegang tepat satu pesanan penjualan. Pesanan yang sudah dipegang
            proyek lain tidak muncul di daftar.
          </p>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Tarif per jam dibekukan ke setiap baris timesheet saat dicatat, sehingga menaikkannya
        tidak mengubah biaya pekerjaan yang sudah lewat.
      </p>

      <div className="flex gap-3">
        <Button type="submit" disabled={bekerja}>
          {bekerja ? 'Menyimpan…' : 'Simpan Proyek'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
      </div>
    </form>
  )
}
