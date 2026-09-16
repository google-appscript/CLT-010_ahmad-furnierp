'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatRupiah } from '@/lib/uang'
import { LABEL_SATUAN_TARIF } from '@/modules/proyek/validasi/proyek'
import { aksiCatatTimesheet } from '../aksi'

export type PilihanProyek = { id: string; kode: string; nama: string; status: string }
export type PilihanTugas = { id: string; proyekId: string; nama: string }
export type PilihanPerintahProduksi = {
  id: string; proyekId: string | null; nomor: string | null; status: string
}
export type PilihanPegawai = {
  id: string; nama: string; tarif: string; satuanTarif: 'harian' | 'jam'
}

const TANPA_TUGAS = 'tanpa-tugas'
const TANPA_PRODUKSI = 'tanpa-produksi'

export function FormulirTimesheet({
  proyek, tugas, perintahProduksi, pegawai,
}: {
  proyek: PilihanProyek[]
  tugas: PilihanTugas[]
  perintahProduksi: PilihanPerintahProduksi[]
  pegawai: PilihanPegawai[]
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()
  const [proyekId, setProyekId] = useState('')
  const [tugasId, setTugasId] = useState(TANPA_TUGAS)
  const [woId, setWoId] = useState(TANPA_PRODUKSI)
  const [pegawaiId, setPegawaiId] = useState('')
  const [kuantitas, setKuantitas] = useState('')

  const berjalan = proyek.filter((p) => p.status === 'berjalan')
  const tugasProyek = tugas.filter((t) => t.proyekId === proyekId)
  const produksiProyek = perintahProduksi.filter((w) => w.proyekId === proyekId)
  const pegawaiTerpilih = pegawai.find((p) => p.id === pegawaiId)

  const harian = pegawaiTerpilih?.satuanTarif !== 'jam'
  const biaya = Number(kuantitas || 0) * Number(pegawaiTerpilih?.tarif ?? 0)

  function pilihProyek(id: string) {
    setProyekId(id)
    setTugasId(TANPA_TUGAS)
    setWoId(TANPA_PRODUKSI)
  }

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiCatatTimesheet({
        proyekId,
        tugasId: tugasId === TANPA_TUGAS ? null : tugasId,
        woId: woId === TANPA_PRODUKSI ? null : woId,
        pegawaiId,
        tanggal: String(data.get('tanggal') ?? ''),
        kuantitas: kuantitas || '0',
        deskripsi: String(data.get('deskripsi') ?? ''),
      })

      if (hasil.berhasil) {
        toast.success('Pekerjaan tercatat')
        setKuantitas('')
        router.refresh()
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  if (berjalan.length === 0) {
    return (
      <div className="mb-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Tidak ada proyek yang sedang berjalan. Mulai sebuah proyek lebih dulu sebelum mencatat
        jam kerja.
      </div>
    )
  }

  if (pegawai.length === 0) {
    return (
      <div className="mb-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Belum ada pegawai yang terdaftar. Tambahkan tukang di Kontak → Pegawai beserta
        upahnya lebih dulu, karena tarifnya dibekukan ke setiap baris timesheet.
      </div>
    )
  }

  return (
    <form action={simpan} className="mb-8 space-y-4 rounded-md border p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="proyekId">Proyek</Label>
          <Select value={proyekId} onValueChange={pilihProyek} required>
            <SelectTrigger id="proyekId" className="w-full">
              <SelectValue placeholder="Pilih proyek" />
            </SelectTrigger>
            <SelectContent>
              {berjalan.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.kode} — {p.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tugasId">Tugas</Label>
          <Select value={tugasId} onValueChange={setTugasId} disabled={!proyekId}>
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
        <div className="space-y-2">
          <Label htmlFor="tanggal">Tanggal</Label>
          <Input
            id="tanggal" name="tanggal" type="date" required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="woId">Perintah Produksi</Label>
          <Select value={woId} onValueChange={setWoId} disabled={!proyekId}>
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
          <Label htmlFor="kuantitas">{harian ? 'Hari' : 'Jam'}</Label>
          <Input
            id="kuantitas" type="number"
            step={harian ? '0.5' : '0.25'}
            min={harian ? '0.5' : '0.25'}
            max={harian ? '1' : '24'}
            required
            value={kuantitas} onChange={(e) => setKuantitas(e.target.value)}
            className="text-right tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deskripsi">Uraian Pekerjaan</Label>
          <Input id="deskripsi" name="deskripsi" required />
        </div>
        <div className="flex items-end">
          <Button
            type="submit" disabled={bekerja || !proyekId || !pegawaiId}
            className="w-full"
          >
            {bekerja ? 'Menyimpan…' : 'Catat'}
          </Button>
        </div>
      </div>

      {pegawaiTerpilih && (
        <p className="text-sm text-muted-foreground">
          Upah {formatRupiah(pegawaiTerpilih.tarif)} per{' '}
          {LABEL_SATUAN_TARIF[pegawaiTerpilih.satuanTarif].toLowerCase()}
          {Number(kuantitas) > 0 && <> · biaya {formatRupiah(biaya.toFixed(2))}</>}
          . Tarif dibekukan pada baris ini saat disimpan.{' '}
          {woId === TANPA_PRODUKSI
            ? 'Tanpa perintah produksi, upah ini hanya masuk laba bersih proyek.'
            : 'Upah ini akan diserap ke harga pokok lewat perintah produksinya.'}
        </p>
      )}
    </form>
  )
}
