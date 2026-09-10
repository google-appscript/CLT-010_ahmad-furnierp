import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus } from 'lucide-react'
import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { locations, partners } from '@/db/schema'
import { daftarOperasi } from '@/modules/gudang/layanan/operasi'
import {
  SLUG_KE_TIPE, labelTipeOperasi, LABEL_STATUS_OPERASI, DESKRIPSI_TIPE,
  dapatDibuatManual,
} from '@/modules/gudang/validasi/operasi'
import { uraikanParameterDaftar, type ParameterDaftar } from '@/lib/daftar'
import { daftarFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelPencarian } from '@/components/data/panel-pencarian'
import { TabelData, type Kolom } from '@/components/data/tabel-data'

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  selesai: 'default', draft: 'secondary', dibatalkan: 'outline',
}

const IZIN: Record<string, string> = {
  penerimaan: 'gudang.penerimaan.kelola',
  pengiriman: 'gudang.pengiriman.kelola',
  transfer: 'gudang.transfer.kelola',
  barang_rusak: 'gudang.scrap.kelola',
  opname: 'gudang.opname.kelola',
  // Operasi produksi hanya dapat dilihat oleh yang berhak atas perintahnya.
  konsumsi_produksi: 'manufaktur.mo.lihat',
  hasil_produksi: 'manufaktur.mo.lihat',
}

export default async function HalamanDaftarOperasi({
  params, searchParams,
}: {
  params: Promise<{ tipe: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tipe: slug } = await params
  const tipe = SLUG_KE_TIPE[slug]
  if (!tipe) notFound()

  const sesi = await wajibIzin(IZIN[tipe])

  const sp = await searchParams
  const urlParams = new URLSearchParams()
  for (const [kunci, nilai] of Object.entries(sp)) {
    if (nilai === undefined) continue
    for (const v of Array.isArray(nilai) ? nilai : [nilai]) urlParams.append(kunci, v)
  }
  const param = uraikanParameterDaftar(urlParams)

  const kunciDaftar = `gudang.operasi.${slug}`
  const favorit = await daftarFilter(sesi.penggunaId, kunciDaftar)

  const [{ data: operasi, totalBaris }, semuaLokasi, semuaMitra] = await Promise.all([
    daftarOperasi({ ...param, tipe }),
    db.select().from(locations).orderBy(asc(locations.kode)),
    db.select({ id: partners.id, nama: partners.nama }).from(partners),
  ])

  const lokasiLewatId = new Map(semuaLokasi.map((l) => [l.id, l.nama]))
  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))

  type BarisOperasi = (typeof operasi)[number]

  const kolom: Kolom<BarisOperasi>[] = [
    { kunci: 'nomor', judul: 'Nomor', render: (o) => <span className="font-mono text-xs">{o.nomor ?? '—'}</span> },
    { kunci: 'tanggal', judul: 'Tanggal', render: (o) => o.tanggal },
    { kunci: 'dari', judul: 'Dari', render: (o) => lokasiLewatId.get(o.lokasiAsalId) ?? '—' },
    { kunci: 'ke', judul: 'Ke', render: (o) => lokasiLewatId.get(o.lokasiTujuanId) ?? '—' },
    {
      kunci: 'mitra', judul: 'Mitra',
      render: (o) => <span className="text-muted-foreground">{o.partnerId ? mitraLewatId.get(o.partnerId) ?? '—' : '—'}</span>,
    },
    { kunci: 'referensi', judul: 'Referensi', render: (o) => <span className="text-muted-foreground">{o.referensi ?? '—'}</span> },
    {
      kunci: 'status', judul: 'Status',
      render: (o) => <Badge variant={VARIAN[o.status]}>{LABEL_STATUS_OPERASI[o.status]}</Badge>,
    },
  ]

  const pengelompokan = param.kelompokkan === 'status'
    ? {
        kelompokkanDari: (o: BarisOperasi) => o.status,
        label: (nilaiGrup: string) => LABEL_STATUS_OPERASI[nilaiGrup] ?? nilaiGrup,
      }
    : undefined

  return (
    <>
      <KepalaHalaman
        judul={labelTipeOperasi(tipe)}
        deskripsi={DESKRIPSI_TIPE[tipe]}
        aksi={dapatDibuatManual(tipe) ? (
          <Button asChild>
            <Link href={`/gudang/operasi/${slug}/baru`}>
              <Plus className="mr-2 h-4 w-4" />Buat {labelTipeOperasi(tipe)}
            </Link>
          </Button>
        ) : undefined}
      />

      <PanelPencarian
        kunciDaftar={kunciDaftar}
        kolomFilter={[
          {
            kunci: 'status',
            label: 'Status',
            opsi: Object.entries(LABEL_STATUS_OPERASI).map(([nilai, label]) => ({ nilai, label })),
          },
        ]}
        kolomGroupBy={[{ kunci: 'status', label: 'Status' }]}
        favorit={favorit.map((f) => ({ ...f, kriteria: f.kriteria as ParameterDaftar }))}
      />

      <TabelData
        kolom={kolom}
        baris={operasi}
        kunciBaris={(o) => o.id}
        pesanKosong={`Belum ada dokumen ${labelTipeOperasi(tipe).toLowerCase()}.`}
        hrefBaris={(o) => `/gudang/operasi/${slug}/${o.id}`}
        pagination={{ halaman: param.halaman, ukuranHalaman: param.ukuranHalaman, totalBaris }}
        pengelompokan={pengelompokan}
      />
    </>
  )
}
