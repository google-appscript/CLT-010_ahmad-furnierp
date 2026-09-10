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
  readOnly = false, nomor, statusBadge, aksiTambahan, bannerTambahan, tabTambahan,
}: {
  awal: NilaiAwalProyek
  pesanan: PilihanPesanan[]
  pengguna: PilihanPengguna[]
  readOnly?: boolean
  nomor?: string
  statusBadge?: React.ReactNode
  aksiTambahan?: React.ReactNode
  bannerTambahan?: React.ReactNode
  tabTambahan?: { id: string; label: string; children: React.ReactNode }[]
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()
  const [soId, setSoId] = useState(awal.soId)
  const [manajerId, setManajerId] = useState(awal.manajerId || TANPA_MANAJER)

  const pesananLewatId = new Map(pesanan.map((p) => [p.id, p]))
  const penggunaLewatId = new Map(pengguna.map((p) => [p.id, p]))
  const pesananTerpilih = pesananLewatId.get(soId)

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

  const informasi = (
    <div className="space-y-4">
      <FormulirGrid
        kiri={
          <>
            <FormulirField label="Kode Proyek" htmlFor="kode" readOnly={readOnly} valueTampilan={awal.kode}>
              <Input id="kode" name="kode" required defaultValue={awal.kode} placeholder="PRJ-001" />
            </FormulirField>
            <FormulirField label="Nama Proyek" htmlFor="nama" readOnly={readOnly} valueTampilan={awal.nama}>
              <Input id="nama" name="nama" required defaultValue={awal.nama} />
            </FormulirField>
            <FormulirField
              label="Pesanan Penjualan" htmlFor="soId" readOnly={readOnly}
              valueTampilan={pesananTerpilih ? `${pesananTerpilih.nomor} — ${pesananTerpilih.namaPelanggan}` : '—'}
            >
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
            </FormulirField>
          </>
        }
        kanan={
          <>
            <FormulirField label="Tanggal Mulai" htmlFor="tanggalMulai" readOnly={readOnly} valueTampilan={awal.tanggalMulai}>
              <Input id="tanggalMulai" name="tanggalMulai" type="date" required defaultValue={awal.tanggalMulai} />
            </FormulirField>
            <FormulirField label="Target Selesai" htmlFor="tanggalTarget" readOnly={readOnly} valueTampilan={awal.tanggalTarget || '—'}>
              <Input id="tanggalTarget" name="tanggalTarget" type="date" defaultValue={awal.tanggalTarget} />
            </FormulirField>
            <FormulirField
              label="Manajer Proyek" htmlFor="manajerId" readOnly={readOnly}
              valueTampilan={manajerId !== TANPA_MANAJER ? penggunaLewatId.get(manajerId)?.nama ?? '—' : '—'}
            >
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
            </FormulirField>
            <FormulirField label="Tarif per Jam" htmlFor="tarifPerJam" readOnly={readOnly} valueTampilan={awal.tarifPerJam}>
              <Input
                id="tarifPerJam" name="tarifPerJam" type="number" step="0.01" min="0"
                defaultValue={awal.tarifPerJam} className="text-right tabular-nums"
              />
            </FormulirField>
          </>
        }
      />

      <FormulirField label="Catatan" htmlFor="catatan" readOnly={readOnly} valueTampilan={awal.catatan || '—'}>
        <Textarea id="catatan" name="catatan" rows={2} defaultValue={awal.catatan} />
      </FormulirField>

      {!readOnly && (
        <>
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
        </>
      )}
    </div>
  )

  return (
    <form action={simpan}>
      <FormulirBingkai
        breadcrumb={[
          { label: 'Proyek', href: '/proyek' },
          { label: nomor ?? 'Proyek Baru' },
        ]}
        nomor={nomor ?? 'Proyek Baru'}
        status={statusBadge}
        aksi={
          <div className="flex gap-3">
            {aksiTambahan}
            {!readOnly && (
              <>
                <Button type="submit" disabled={bekerja}>
                  {bekerja ? 'Menyimpan…' : 'Simpan Proyek'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.back()}>Batal</Button>
              </>
            )}
          </div>
        }
      >
        {bannerTambahan}
        <FormulirNotebook
          tab={[
            { id: 'informasi', label: 'Informasi', children: informasi },
            ...(tabTambahan ?? []),
          ]}
        />
      </FormulirBingkai>
    </form>
  )
}
