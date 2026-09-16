'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TombolUbah } from '@/components/data/tombol-aksi'
import { aksiUbahTimesheet } from '../aksi'
import type {
  PilihanTugas, PilihanPegawai, PilihanPerintahProduksi,
} from './formulir-timesheet'

const TANPA_TUGAS = 'tanpa-tugas'
const TANPA_PRODUKSI = 'tanpa-produksi'

export type TimesheetUntukDiubah = {
  id: string
  proyekId: string
  tugasId: string | null
  woId: string | null
  pegawaiId: string
  tanggal: string
  kuantitas: string
  satuanTarif: 'harian' | 'jam'
  deskripsi: string
}

export function DialogUbahTimesheet({
  baris, tugas, perintahProduksi, pegawai,
}: {
  baris: TimesheetUntukDiubah
  tugas: PilihanTugas[]
  perintahProduksi: PilihanPerintahProduksi[]
  pegawai: PilihanPegawai[]
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [bekerja, mulai] = useTransition()
  const [tugasId, setTugasId] = useState(baris.tugasId ?? TANPA_TUGAS)
  const [woId, setWoId] = useState(baris.woId ?? TANPA_PRODUKSI)
  const [pegawaiId, setPegawaiId] = useState(baris.pegawaiId)

  const tugasProyek = tugas.filter((t) => t.proyekId === baris.proyekId)
  const produksiProyek = perintahProduksi.filter((w) => w.proyekId === baris.proyekId)

  // Satuan mengikuti pegawai yang sedang dipilih; mengganti pelaksana berarti
  // upahnya memang upah orang lain, beserta satuannya.
  const pegawaiTerpilih = pegawai.find((p) => p.id === pegawaiId)
  const satuan = pegawaiId === baris.pegawaiId
    ? baris.satuanTarif
    : pegawaiTerpilih?.satuanTarif ?? baris.satuanTarif
  const harian = satuan !== 'jam'

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiUbahTimesheet(baris.id, {
        proyekId: baris.proyekId,
        tugasId: tugasId === TANPA_TUGAS ? null : tugasId,
        woId: woId === TANPA_PRODUKSI ? null : woId,
        pegawaiId,
        tanggal: String(data.get('tanggal') ?? ''),
        kuantitas: String(data.get('kuantitas') ?? '0'),
        deskripsi: String(data.get('deskripsi') ?? ''),
      })
      if (hasil.berhasil) {
        toast.success('Timesheet diperbarui')
        setTerbuka(false)
        router.refresh()
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        <TombolUbah />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah Timesheet</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tugasId">Tugas</Label>
            <Select value={tugasId} onValueChange={setTugasId}>
              <SelectTrigger id="tugasId" className="w-full">
                <SelectValue placeholder="Opsional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TANPA_TUGAS}>Tanpa tugas</SelectItem>
                {tugasProyek.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="woId">Perintah Produksi</Label>
            <Select value={woId} onValueChange={setWoId}>
              <SelectTrigger id="woId" className="w-full">
                <SelectValue placeholder="Opsional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TANPA_PRODUKSI}>Di luar produksi</SelectItem>
                {produksiProyek.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.nomor ?? 'Draft'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pegawaiId">Pegawai</Label>
            <Select value={pegawaiId} onValueChange={setPegawaiId} required>
              <SelectTrigger id="pegawaiId" className="w-full">
                <SelectValue placeholder="Pilih pegawai" />
              </SelectTrigger>
              <SelectContent>
                {pegawai.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tanggal">Tanggal</Label>
              <Input id="tanggal" name="tanggal" type="date" required defaultValue={baris.tanggal} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kuantitas">{harian ? 'Hari' : 'Jam'}</Label>
              <Input
                id="kuantitas" name="kuantitas" type="number"
                step={harian ? '0.5' : '0.25'}
                min={harian ? '0.5' : '0.25'}
                max={harian ? '1' : '24'}
                required
                defaultValue={baris.kuantitas} className="text-right tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deskripsi">Uraian Pekerjaan</Label>
            <Input id="deskripsi" name="deskripsi" required defaultValue={baris.deskripsi} />
          </div>

          <p className="text-xs text-muted-foreground">
            Tarif yang sudah dibekukan pada baris ini tidak ikut berubah, kecuali
            pegawainya diganti.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={bekerja}>
              {bekerja ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
