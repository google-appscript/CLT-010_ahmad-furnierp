import { asc } from 'drizzle-orm'
import { db } from '@/db/klien'
import { partners } from '@/db/schema'
import { daftarFaktur, ringkasanFaktur, type Faktur } from '@/modules/penjualan/layanan/faktur'
import { LABEL_STATUS_FAKTUR } from '@/modules/penjualan/validasi/pesanan'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import type { ParameterDaftar } from '@/lib/daftar'

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  diposting: 'default', draft: 'secondary', dibatalkan: 'outline',
}

export async function DaftarFaktur({
  tipe, param,
}: {
  tipe: Faktur['tipe']
  param: ParameterDaftar
}) {
  const [{ data: daftar, totalBaris }, semuaMitra] = await Promise.all([
    daftarFaktur({ ...param, tipe }),
    db.select({ id: partners.id, nama: partners.nama }).from(partners).orderBy(asc(partners.nama)),
  ])
  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))
  const dengan = await Promise.all(daftar.map(async (f) => (await ringkasanFaktur(f.id))!))

  const kolom: Kolom<(typeof dengan)[number]>[] = [
    { kunci: 'nomor', judul: 'Nomor', render: (f) => <span className="font-mono text-xs">{f.nomor ?? '—'}</span> },
    { kunci: 'tanggal', judul: 'Tanggal', render: (f) => f.tanggal },
    { kunci: 'pelanggan', judul: 'Pelanggan', render: (f) => mitraLewatId.get(f.partnerId) ?? '—' },
    { kunci: 'jatuhTempo', judul: 'Jatuh Tempo', render: (f) => <span className="text-muted-foreground">{f.tanggalJatuhTempo ?? '—'}</span> },
    { kunci: 'total', judul: 'Total', rataKanan: true, render: (f) => formatAngka(f.totalTagihan) },
    {
      kunci: 'sisa', judul: 'Sisa', rataKanan: true,
      render: (f) => (f.status === 'diposting' ? formatAngka(f.sisa) : '—'),
    },
    {
      kunci: 'status', judul: 'Status',
      render: (f) => <Badge variant={VARIAN[f.status]}>{LABEL_STATUS_FAKTUR[f.status]}</Badge>,
    },
  ]

  const pengelompokan = param.kelompokkan === 'status'
    ? {
        kelompokkanDari: (f: (typeof dengan)[number]) => f.status,
        label: (nilaiGrup: string) => LABEL_STATUS_FAKTUR[nilaiGrup] ?? nilaiGrup,
      }
    : param.kelompokkan === 'partnerId'
      ? {
          kelompokkanDari: (f: (typeof dengan)[number]) => f.partnerId,
          label: (nilaiGrup: string) => mitraLewatId.get(nilaiGrup) ?? '—',
        }
      : undefined

  return (
    <TabelData
      kolom={kolom}
      baris={dengan}
      kunciBaris={(f) => f.id}
      pesanKosong="Belum ada dokumen."
      hrefBaris={(f) => `/akuntansi/pelanggan/faktur/${f.id}`}
      pagination={{ halaman: param.halaman, ukuranHalaman: param.ukuranHalaman, totalBaris }}
      pengelompokan={pengelompokan}
    />
  )
}
