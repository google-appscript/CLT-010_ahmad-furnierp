'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatRupiah } from '@/lib/uang'
import { aksiCatatTimesheet } from '../aksi'

export type PilihanProyek = {
  id: string; kode: string; nama: string; status: string; tarifPerJam: string
}
export type PilihanTugas = { id: string; proyekId: string; nama: string }
export type PilihanPengguna = { id: string; nama: string }

const TANPA_TUGAS = 'tanpa-tugas'

export function FormulirTimesheet({
  proyek, tugas, pengguna, penggunaAktifId,
}: {
  proyek: PilihanProyek[]
  tugas: PilihanTugas[]
  pengguna: PilihanPengguna[]
  penggunaAktifId: string
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()
  const [proyekId, setProyekId] = useState('')
  const [tugasId, setTugasId] = useState(TANPA_TUGAS)
  const [penggunaId, setPenggunaId] = useState(penggunaAktifId)
  const [jam, setJam] = useState('')

  const berjalan = proyek.filter((p) => p.status === 'berjalan')
  const proyekTerpilih = berjalan.find((p) => p.id === proyekId)
  const tugasProyek = tugas.filter((t) => t.proyekId === proyekId)
  const biaya = Number(jam || 0) * Number(proyekTerpilih?.tarifPerJam ?? 0)

  function pilihProyek(id: string) {
    setProyekId(id)
    setTugasId(TANPA_TUGAS)
  }

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiCatatTimesheet({
        proyekId,
        tugasId: tugasId === TANPA_TUGAS ? null : tugasId,
        penggunaId,
        tanggal: String(data.get('tanggal') ?? ''),
        jam: jam || '0',
        deskripsi: String(data.get('deskripsi') ?? ''),
      })

      if (hasil.berhasil) {
        toast.success('Jam kerja tercatat')
        setJam('')
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
          <Label htmlFor="penggunaId">Pelaksana</Label>
          <Select value={penggunaId} onValueChange={setPenggunaId} required>
            <SelectTrigger id="penggunaId" className="w-full">
              <SelectValue placeholder="Pilih pelaksana" />
            </SelectTrigger>
            <SelectContent>
              {pengguna.map((p) => (
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
          <Label htmlFor="jam">Jam</Label>
          <Input
            id="jam" type="number" step="0.25" min="0.25" max="24" required
            value={jam} onChange={(e) => setJam(e.target.value)}
            className="text-right tabular-nums"
          />
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="deskripsi">Uraian Pekerjaan</Label>
          <Input id="deskripsi" name="deskripsi" required />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={bekerja || !proyekId} className="w-full">
            {bekerja ? 'Menyimpan…' : 'Catat Jam'}
          </Button>
        </div>
      </div>

      {proyekTerpilih && (
        <p className="text-sm text-muted-foreground">
          Tarif {formatRupiah(proyekTerpilih.tarifPerJam)} per jam
          {Number(jam) > 0 && <> · biaya {formatRupiah(biaya.toFixed(2))}</>}
          . Tarif dibekukan pada baris ini saat disimpan.
        </p>
      )}
    </form>
  )
}
