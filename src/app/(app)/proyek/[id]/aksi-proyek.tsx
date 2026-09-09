'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LABEL_STATUS_TUGAS } from '@/modules/proyek/validasi/proyek'
import {
  aksiMulaiProyek, aksiSelesaikanProyek, aksiBatalkanProyek, aksiHapusProyek,
  aksiSimpanTugas, aksiUbahStatusTugas, aksiHapusTugas,
} from '../aksi'

type Hasil = { berhasil: boolean; pesan?: string }

function useJalankan() {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  function jalankan(fn: () => Promise<Hasil>, sukses: string, keDaftar = false) {
    mulai(async () => {
      const hasil = await fn()
      if (!hasil.berhasil) {
        toast.error(hasil.pesan!)
        return
      }
      toast.success(sukses)
      if (keDaftar) router.push('/proyek')
      else router.refresh()
    })
  }

  return { bekerja, jalankan }
}

export function AksiProyek({ id, status }: { id: string; status: string }) {
  const { bekerja, jalankan } = useJalankan()
  const [tanggalSelesai, setTanggalSelesai] = useState(new Date().toISOString().slice(0, 10))

  return (
    <div className="flex flex-wrap items-end gap-3">
      {status === 'draft' && (
        <>
          <Button
            disabled={bekerja}
            onClick={() => jalankan(() => aksiMulaiProyek(id), 'Proyek dimulai')}
          >
            {bekerja ? 'Memproses…' : 'Mulai Proyek'}
          </Button>
          <Button
            variant="outline" disabled={bekerja}
            onClick={() => jalankan(() => aksiHapusProyek(id), 'Draft proyek dihapus', true)}
          >
            Hapus
          </Button>
        </>
      )}

      {status === 'berjalan' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="tanggalSelesai">Tanggal Selesai</Label>
            <Input
              id="tanggalSelesai" type="date" className="w-44"
              value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)}
            />
          </div>
          <Button
            disabled={bekerja}
            onClick={() => jalankan(
              () => aksiSelesaikanProyek(id, tanggalSelesai), 'Proyek ditutup',
            )}
          >
            {bekerja ? 'Memproses…' : 'Selesaikan Proyek'}
          </Button>
        </>
      )}

      {(status === 'draft' || status === 'berjalan') && (
        <Button
          variant="outline" disabled={bekerja}
          onClick={() => jalankan(() => aksiBatalkanProyek(id), 'Proyek dibatalkan')}
        >
          Batalkan
        </Button>
      )}
    </div>
  )
}

export type PilihanPengguna = { id: string; nama: string }

const TANPA_PJ = 'tanpa-pj'

export function DialogTugas({
  proyekId, pengguna,
}: {
  proyekId: string
  pengguna: PilihanPengguna[]
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [bekerja, mulai] = useTransition()
  const [penanggungJawabId, setPenanggungJawabId] = useState(TANPA_PJ)

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanTugas(null, {
        proyekId,
        nama: String(data.get('nama') ?? ''),
        deskripsi: String(data.get('deskripsi') ?? '') || null,
        penanggungJawabId: penanggungJawabId === TANPA_PJ ? null : penanggungJawabId,
        tanggalMulai: String(data.get('tanggalMulai') ?? '') || null,
        tenggat: String(data.get('tenggat') ?? '') || null,
        estimasiJam: String(data.get('estimasiJam') ?? '') || '0',
      })

      if (hasil.berhasil) {
        toast.success('Tugas ditambahkan')
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
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />Tambah Tugas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Tambah Tugas</DialogTitle></DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama Tugas</Label>
            <Input id="nama" name="nama" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deskripsi">Deskripsi</Label>
            <Textarea id="deskripsi" name="deskripsi" rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="penanggungJawabId">Penanggung Jawab</Label>
              <Select value={penanggungJawabId} onValueChange={setPenanggungJawabId}>
                <SelectTrigger id="penanggungJawabId" className="w-full">
                  <SelectValue placeholder="Opsional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TANPA_PJ}>Belum ditentukan</SelectItem>
                  {pengguna.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimasiJam">Estimasi Jam</Label>
              <Input
                id="estimasiJam" name="estimasiJam" type="number" step="0.01" min="0"
                defaultValue="0" className="text-right tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tanggalMulai">Tanggal Mulai</Label>
              <Input id="tanggalMulai" name="tanggalMulai" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenggat">Tenggat</Label>
              <Input id="tenggat" name="tenggat" type="date" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={bekerja}>
              {bekerja ? 'Menyimpan…' : 'Simpan Tugas'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const STATUS_BERIKUT: Record<string, { ke: string; label: string } | undefined> = {
  belum_mulai: { ke: 'berjalan', label: 'Mulai' },
  berjalan: { ke: 'selesai', label: 'Selesaikan' },
}

export function AksiTugas({
  id, status, dapatDihapus,
}: {
  id: string
  status: string
  dapatDihapus: boolean
}) {
  const { bekerja, jalankan } = useJalankan()
  const berikut = STATUS_BERIKUT[status]

  return (
    <div className="flex justify-end gap-1">
      {berikut && (
        <Button
          variant="ghost" size="sm" disabled={bekerja}
          onClick={() => jalankan(
            () => aksiUbahStatusTugas(id, berikut.ke as never),
            `Tugas ${LABEL_STATUS_TUGAS[berikut.ke].toLowerCase()}`,
          )}
        >
          {berikut.label}
        </Button>
      )}
      {status !== 'dibatalkan' && status !== 'selesai' && (
        <Button
          variant="ghost" size="sm" disabled={bekerja}
          onClick={() => jalankan(
            () => aksiUbahStatusTugas(id, 'dibatalkan'), 'Tugas dibatalkan',
          )}
        >
          Batalkan
        </Button>
      )}
      {dapatDihapus && (
        <Button
          variant="ghost" size="sm" disabled={bekerja}
          onClick={() => jalankan(() => aksiHapusTugas(id), 'Tugas dihapus')}
        >
          Hapus
        </Button>
      )}
    </div>
  )
}
