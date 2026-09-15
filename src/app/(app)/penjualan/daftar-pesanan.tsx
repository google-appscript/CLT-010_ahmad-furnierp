import { asc } from 'drizzle-orm'
import { db } from '@/db/klien'
import { partners } from '@/db/schema'
import { daftarPesanan, totalPesanan, type Pesanan } from '@/modules/penjualan/layanan/pesanan'
import { LABEL_STATUS_PENJUALAN } from '@/modules/penjualan/validasi/pesanan'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import type { ParameterDaftar } from '@/lib/daftar'

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  dikonfirmasi: 'default', selesai: 'default',
  penawaran: 'secondary', dibatalkan: 'outline',
}

type BarisPesanan = Pesanan & { totalTagihan: string }

export async function DaftarPesanan({
  param,
  basisRute = '/penjualan/pesanan',
  labelDitolak = false,
}: {
  param: ParameterDaftar & {
    status?: Pesanan['status']
    statusTermasuk?: Pesanan['status'][]
    bernomor?: boolean
  }
  /** Rute detail dokumen; penawaran dan pesanan dibuka di layar berbeda. */
  basisRute?: string
  /** Pada daftar penawaran, status `dibatalkan` dibaca sebagai penawaran yang ditolak. */
  labelDitolak?: boolean
}) {
  const labelStatus = (status: string) =>
    labelDitolak && status === 'dibatalkan' ? 'Ditolak' : LABEL_STATUS_PENJUALAN[status] ?? status

  const [{ data: pesanan, totalBaris }, semuaMitra] = await Promise.all([
    daftarPesanan(param),
    db.select({ id: partners.id, nama: partners.nama }).from(partners).orderBy(asc(partners.nama)),
  ])
  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))
  const baris: BarisPesanan[] = await Promise.all(
    pesanan.map(async (p) => ({ ...p, totalTagihan: (await totalPesanan(p.id)).totalTagihan })),
  )

  const kolom: Kolom<BarisPesanan>[] = [
    {
      kunci: 'nomor',
      judul: 'Nomor',
      render: (p) => <span className="font-mono text-xs">{p.nomor ?? '—'}</span>,
    },
    { kunci: 'tanggal', judul: 'Tanggal', render: (p) => p.tanggal },
    { kunci: 'pelanggan', judul: 'Pelanggan', render: (p) => mitraLewatId.get(p.partnerId) ?? '—' },
    {
      kunci: 'referensi',
      judul: 'Referensi',
      render: (p) => <span className="text-muted-foreground">{p.referensi ?? '—'}</span>,
    },
    {
      kunci: 'total',
      judul: 'Total Faktur',
      rataKanan: true,
      render: (p) => formatAngka(p.totalTagihan),
    },
    {
      kunci: 'status',
      judul: 'Status',
      render: (p) => <Badge variant={VARIAN[p.status]}>{labelStatus(p.status)}</Badge>,
    },
  ]

  const pengelompokan = param.kelompokkan === 'status'
    ? {
        kelompokkanDari: (p: BarisPesanan) => p.status,
        label: labelStatus,
      }
    : param.kelompokkan === 'partnerId'
      ? {
          kelompokkanDari: (p: BarisPesanan) => p.partnerId,
          label: (nilaiGrup: string) => mitraLewatId.get(nilaiGrup) ?? '—',
        }
      : undefined

  return (
    <TabelData
      kolom={kolom}
      baris={baris}
      kunciBaris={(p) => p.id}
      pesanKosong="Belum ada dokumen."
      hrefBaris={(p) => `${basisRute}/${p.id}`}
      pagination={{ halaman: param.halaman, ukuranHalaman: param.ukuranHalaman, totalBaris }}
      pengelompokan={pengelompokan}
    />
  )
}
