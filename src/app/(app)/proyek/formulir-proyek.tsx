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
import { formatAngka } from '@/lib/uang'
import { FormulirNotebook } from '@/components/formulir/formulir-notebook'
import { aksiSimpanProyek } from './aksi'

export type PilihanPesanan = {
  id: string
  nomor: string
  tanggal: string
  namaPelanggan: string
  /** Target selesai yang dijanjikan marketing pada pesanannya. */
  tanggalPengiriman: string | null
  baris: { deskripsi: string; kuantitas: string; namaSatuan: string }[]
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
  catatan: string
}

/**
 * Ringkasan pesanan yang dipilih, tampil di antara pemilihan pesanan dan nama
 * proyek. Pembuat proyek perlu memastikan ia memegang pesanan yang benar —
 * pembeli, barang yang dipesan, dan kapan marketing menjanjikannya — sebelum
 * menamai proyeknya, tanpa harus membuka pesanan itu di layar lain.
 */
function RincianPesanan({ pesanan }: { pesanan?: PilihanPesanan }) {
  if (!pesanan) {
    return (
      <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        Pilih pesanan penjualan untuk melihat pembeli dan barang yang dipesan.
      </p>
    )
  }

  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Pembeli</dt>
        <dd className="font-medium">{pesanan.namaPelanggan}</dd>
        <dt className="text-muted-foreground">Tanggal pesanan</dt>
        <dd>{pesanan.tanggal}</dd>
        <dt className="text-muted-foreground">Target dari marketing</dt>
        <dd>{pesanan.tanggalPengiriman ?? 'Belum ditentukan'}</dd>
      </dl>

      <p className="mt-3 mb-1 text-muted-foreground">Barang yang dipesan</p>
      {pesanan.baris.length === 0 ? (
        <p className="text-muted-foreground">Pesanan ini belum punya baris produk.</p>
      ) : (
        <ul className="space-y-0.5">
          {pesanan.baris.map((b, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>{b.deskripsi}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatAngka(b.kuantitas, 2)} {b.namaSatuan}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const TANPA_MANAJER = 'tanpa-manajer'

export function FormulirProyek({
  awal, pesanan, pengguna,
  readOnly = false, nomor, statusBadge, aksiTambahan, menu, bannerTambahan, tabTambahan,
}: {
  awal: NilaiAwalProyek
  pesanan: PilihanPesanan[]
  pengguna: PilihanPengguna[]
  readOnly?: boolean
  nomor?: string
  statusBadge?: React.ReactNode
  aksiTambahan?: React.ReactNode
  /** Menu roda gigi dokumen. */
  menu?: React.ReactNode
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
        nama: String(data.get('nama') ?? ''),
        soId,
        tanggalMulai: String(data.get('tanggalMulai') ?? ''),
        tanggalTarget: String(data.get('tanggalTarget') ?? '') || null,
        manajerId: manajerId === TANPA_MANAJER ? null : manajerId,
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
            <FormulirField label="Kode Proyek" readOnly valueTampilan={awal.kode || 'Otomatis'}>
              <span />
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

            {!readOnly && <RincianPesanan pesanan={pesananTerpilih} />}

            <FormulirField label="Nama Proyek" htmlFor="nama" readOnly={readOnly} valueTampilan={awal.nama}>
              <Input id="nama" name="nama" required defaultValue={awal.nama} />
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
            Upah tukang berasal dari master Pegawai, bukan dari proyek — tarif beserta
            satuannya dibekukan ke setiap baris timesheet saat dicatat, sehingga
            menaikkan upah tidak mengubah biaya pekerjaan yang sudah lewat.
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
        menu={menu}
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
