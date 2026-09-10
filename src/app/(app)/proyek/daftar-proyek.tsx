import { asc } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db/klien'
import { partners, salesOrders, users } from '@/db/schema'
import { daftarProyekBerhalaman } from '@/modules/proyek/layanan/proyek'
import { profitabilitasProyek } from '@/modules/proyek/layanan/laporan'
import { LABEL_STATUS_PROYEK } from '@/modules/proyek/validasi/proyek'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import type { ParameterDaftar } from '@/lib/daftar'

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  berjalan: 'default', selesai: 'default', terkunci: 'default',
  draft: 'secondary', dibatalkan: 'outline',
}

export async function DaftarProyek({ param }: { param: ParameterDaftar }) {
  const [{ data: proyek, totalBaris }, semuaMitra, semuaPesanan, semuaPengguna] = await Promise.all([
    daftarProyekBerhalaman(param),
    db.select({ id: partners.id, nama: partners.nama }).from(partners),
    db.select({ id: salesOrders.id, nomor: salesOrders.nomor }).from(salesOrders),
    db.select({ id: users.id, nama: users.nama }).from(users).orderBy(asc(users.nama)),
  ])

  const mitra = new Map(semuaMitra.map((m) => [m.id, m.nama]))
  const pesanan = new Map(semuaPesanan.map((s) => [s.id, s.nomor]))
  const pengguna = new Map(semuaPengguna.map((u) => [u.id, u.nama]))

  const dengan = await Promise.all(
    proyek.map(async (p) => ({ p, laba: await profitabilitasProyek(p.id) })),
  )

  const kolom: Kolom<(typeof dengan)[number]>[] = [
    { kunci: 'kode', judul: 'Kode', render: ({ p }) => <span className="font-mono text-xs">{p.kode}</span> },
    { kunci: 'nama', judul: 'Nama', render: ({ p }) => p.nama },
    {
      kunci: 'pesanan', judul: 'Pesanan',
      render: ({ p }) => (
        <Link href={`/penjualan/pesanan/${p.soId}`} className="font-mono text-xs underline">
          {pesanan.get(p.soId) ?? '—'}
        </Link>
      ),
    },
    { kunci: 'pelanggan', judul: 'Pelanggan', render: ({ p }) => mitra.get(p.partnerId) ?? '—' },
    {
      kunci: 'manajer', judul: 'Manajer',
      render: ({ p }) => <span className="text-muted-foreground">{p.manajerId ? pengguna.get(p.manajerId) ?? '—' : '—'}</span>,
    },
    { kunci: 'mulai', judul: 'Mulai', render: ({ p }) => <span className="text-muted-foreground">{p.tanggalMulai}</span> },
    { kunci: 'pendapatan', judul: 'Pendapatan', rataKanan: true, render: ({ laba }) => formatAngka(laba.pendapatan) },
    {
      kunci: 'laba', judul: 'Laba', rataKanan: true,
      render: ({ laba }) => (
        <span className={Number(laba.laba) < 0 ? 'font-medium text-destructive' : 'font-medium'}>
          {formatAngka(laba.laba)}
        </span>
      ),
    },
    {
      kunci: 'status', judul: 'Status',
      render: ({ p }) => <Badge variant={VARIAN[p.status]}>{LABEL_STATUS_PROYEK[p.status]}</Badge>,
    },
  ]

  const pengelompokan = param.kelompokkan === 'status'
    ? {
        kelompokkanDari: (d: (typeof dengan)[number]) => d.p.status,
        label: (nilaiGrup: string) => LABEL_STATUS_PROYEK[nilaiGrup] ?? nilaiGrup,
      }
    : undefined

  return (
    <TabelData
      kolom={kolom}
      baris={dengan}
      kunciBaris={({ p }) => p.id}
      pesanKosong="Belum ada proyek. Konfirmasikan sebuah pesanan penjualan lebih dulu, lalu buka proyeknya di sini."
      hrefBaris={({ p }) => `/proyek/${p.id}`}
      pagination={{ halaman: param.halaman, ukuranHalaman: param.ukuranHalaman, totalBaris }}
      pengelompokan={pengelompokan}
    />
  )
}
