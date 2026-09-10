'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { aksiUbahPemetaan, aksiSimpanAkunOtomatis } from './aksi'

export type PilihanJurnal = { id: string; kode: string; nama: string }
export type PilihanAkun = { id: string; kode: string; nama: string }

export type BarisPemetaan = {
  id: string
  kode: string
  nama: string
  deskripsi: string | null
  journalId: string
}

export function PemilihJurnal({
  baris, jurnal,
}: {
  baris: BarisPemetaan
  jurnal: PilihanJurnal[]
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()
  const [nilai, setNilai] = useState(baris.journalId)

  function ubah(journalId: string) {
    const sebelumnya = nilai
    setNilai(journalId)
    mulai(async () => {
      const hasil = await aksiUbahPemetaan(baris.id, journalId)
      if (hasil.berhasil) {
        toast.success(`${baris.nama} dipindahkan ke jurnal baru`)
        router.refresh()
      } else {
        setNilai(sebelumnya)
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Select value={nilai} onValueChange={ubah} disabled={bekerja}>
      <SelectTrigger className="w-full min-w-52">
        <SelectValue placeholder="Pilih jurnal" />
      </SelectTrigger>
      <SelectContent>
        {jurnal.map((j) => (
          <SelectItem key={j.id} value={j.id}>{j.kode} — {j.nama}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export type BarisAkun = {
  bidang: string
  label: string
  keterangan: string
  akunId: string | null
}

const KOSONG = 'belum-diatur'

export function FormulirAkunOtomatis({
  baris, akun,
}: {
  baris: BarisAkun[]
  akun: PilihanAkun[]
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()
  const [nilai, setNilai] = useState<Record<string, string>>(
    Object.fromEntries(baris.map((b) => [b.bidang, b.akunId ?? KOSONG])),
  )

  const berubah = baris.some((b) => (nilai[b.bidang] ?? KOSONG) !== (b.akunId ?? KOSONG))

  function simpan() {
    mulai(async () => {
      const muatan = Object.fromEntries(
        Object.entries(nilai).map(([k, v]) => [k, v === KOSONG ? null : v]),
      )
      const hasil = await aksiSimpanAkunOtomatis(muatan)
      if (hasil.berhasil) {
        toast.success('Akun otomatis disimpan')
        router.refresh()
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Akun</th>
              <th className="px-4 py-2 text-left font-medium">Dipakai untuk</th>
              <th className="w-72 px-4 py-2 text-left font-medium">Akun yang Dipilih</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.bidang} className="border-b">
                <td className="px-4 py-1.5 font-medium">{b.label}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{b.keterangan}</td>
                <td className="px-4 py-1.5">
                  <Select
                    value={nilai[b.bidang] ?? KOSONG}
                    onValueChange={(v) => setNilai((l) => ({ ...l, [b.bidang]: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Belum diatur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={KOSONG}>Belum diatur</SelectItem>
                      {akun.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={simpan} disabled={bekerja || !berubah}>
          {bekerja ? 'Menyimpan…' : 'Simpan Akun Otomatis'}
        </Button>
        {berubah && (
          <Label className="text-sm text-muted-foreground">Ada perubahan yang belum disimpan.</Label>
        )}
      </div>
    </div>
  )
}
