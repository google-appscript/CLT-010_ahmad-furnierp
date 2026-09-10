import { asc } from 'drizzle-orm'
import { db } from '@/db/klien'
import { partners } from '@/db/schema'
import { daftarTagihan, ringkasanTagihan, type Tagihan } from '@/modules/pembelian/layanan/tagihan'
import { LABEL_STATUS_TAGIHAN } from '@/modules/pembelian/validasi/pesanan'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import type { ParameterDaftar } from '@/lib/daftar'

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  diposting: 'default', draft: 'secondary', dibatalkan: 'outline',
}

export async function DaftarTagihan({
  tipe, param,
}: {
  tipe: Tagihan['tipe']
  param: ParameterDaftar
}) {
  const [{ data: daftar, totalBaris }, semuaMitra] = await Promise.all([
    daftarTagihan({ ...param, tipe }),
    db.select({ id: partners.id, nama: partners.nama }).from(partners).orderBy(asc(partners.nama)),
  ])
  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))
  const dengan = await Promise.all(daftar.map(async (t) => (await ringkasanTagihan(t.id))!))

  const kolom: Kolom<(typeof dengan)[number]>[] = [
    { kunci: 'nomor', judul: 'Nomor', render: (t) => <span className="font-mono text-xs">{t.nomor ?? '—'}</span> },
    { kunci: 'tanggal', judul: 'Tanggal', render: (t) => t.tanggal },
    { kunci: 'pemasok', judul: 'Pemasok', render: (t) => mitraLewatId.get(t.partnerId) ?? '—' },
    { kunci: 'referensiPemasok', judul: 'Faktur Pemasok', render: (t) => <span className="text-muted-foreground">{t.referensiPemasok ?? '—'}</span> },
    { kunci: 'jatuhTempo', judul: 'Jatuh Tempo', render: (t) => <span className="text-muted-foreground">{t.tanggalJatuhTempo ?? '—'}</span> },
    { kunci: 'total', judul: 'Total', rataKanan: true, render: (t) => formatAngka(t.totalTagihan) },
    {
      kunci: 'sisa', judul: 'Sisa', rataKanan: true,
      render: (t) => (t.status === 'diposting' ? formatAngka(t.sisa) : '—'),
    },
    {
      kunci: 'status', judul: 'Status',
      render: (t) => <Badge variant={VARIAN[t.status]}>{LABEL_STATUS_TAGIHAN[t.status]}</Badge>,
    },
  ]

  const pengelompokan = param.kelompokkan === 'status'
    ? {
        kelompokkanDari: (t: (typeof dengan)[number]) => t.status,
        label: (nilaiGrup: string) => LABEL_STATUS_TAGIHAN[nilaiGrup] ?? nilaiGrup,
      }
    : param.kelompokkan === 'partnerId'
      ? {
          kelompokkanDari: (t: (typeof dengan)[number]) => t.partnerId,
          label: (nilaiGrup: string) => mitraLewatId.get(nilaiGrup) ?? '—',
        }
      : undefined

  return (
    <TabelData
      kolom={kolom}
      baris={dengan}
      kunciBaris={(t) => t.id}
      pesanKosong="Belum ada dokumen."
      hrefBaris={(t) => `/akuntansi/pemasok/tagihan/${t.id}`}
      pagination={{ halaman: param.halaman, ukuranHalaman: param.ukuranHalaman, totalBaris }}
      pengelompokan={pengelompokan}
    />
  )
}
