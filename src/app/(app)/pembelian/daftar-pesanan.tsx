import { asc } from 'drizzle-orm'
import { db } from '@/db/klien'
import { partners } from '@/db/schema'
import { daftarPesanan, totalPesanan, type Pesanan } from '@/modules/pembelian/layanan/pesanan'
import { LABEL_STATUS_PEMBELIAN } from '@/modules/pembelian/validasi/pesanan'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { TabelData, type Kolom } from '@/components/data/tabel-data'

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  dikonfirmasi: 'default', selesai: 'default',
  permintaan: 'secondary', dibatalkan: 'outline',
}

export async function DaftarPesanan({ status }: { status?: Pesanan['status'] }) {
  const [pesanan, semuaMitra] = await Promise.all([
    daftarPesanan(status ? { status } : {}),
    db.select({ id: partners.id, nama: partners.nama }).from(partners).orderBy(asc(partners.nama)),
  ])
  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))

  const dengan = await Promise.all(
    pesanan.map(async (p) => ({ ...p, totalTagihan: (await totalPesanan(p.id)).totalTagihan })),
  )

  const kolom: Kolom<(typeof dengan)[number]>[] = [
    { kunci: 'nomor', judul: 'Nomor', render: (p) => <span className="font-mono text-xs">{p.nomor ?? '—'}</span> },
    { kunci: 'tanggal', judul: 'Tanggal', render: (p) => p.tanggal },
    { kunci: 'pemasok', judul: 'Pemasok', render: (p) => mitraLewatId.get(p.partnerId) ?? '—' },
    { kunci: 'referensi', judul: 'Referensi', render: (p) => <span className="text-muted-foreground">{p.referensi ?? '—'}</span> },
    { kunci: 'total', judul: 'Total Tagihan', rataKanan: true, render: (p) => formatAngka(p.totalTagihan) },
    {
      kunci: 'status', judul: 'Status',
      render: (p) => <Badge variant={VARIAN[p.status]}>{LABEL_STATUS_PEMBELIAN[p.status]}</Badge>,
    },
  ]

  return (
    <TabelData
      kolom={kolom}
      baris={dengan}
      kunciBaris={(p) => p.id}
      pesanKosong="Belum ada dokumen."
      hrefBaris={(p) => `/pembelian/pesanan/${p.id}`}
    />
  )
}
