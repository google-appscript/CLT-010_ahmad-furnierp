import Link from 'next/link'
import { Plus } from 'lucide-react'
import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { partners, salesOrders, users } from '@/db/schema'
import { daftarProyek } from '@/modules/proyek/layanan/proyek'
import { profitabilitasProyek } from '@/modules/proyek/layanan/laporan'
import { LABEL_STATUS_PROYEK } from '@/modules/proyek/validasi/proyek'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Daftar Proyek' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  berjalan: 'default', selesai: 'default', draft: 'secondary', dibatalkan: 'outline',
}

export default async function HalamanDaftarProyek() {
  await wajibIzin('proyek.proyek.kelola')

  const [proyek, semuaMitra, semuaPesanan, semuaPengguna] = await Promise.all([
    daftarProyek(),
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

  return (
    <>
      <KepalaHalaman
        judul="Daftar Proyek"
        deskripsi="Satu proyek memegang tepat satu pesanan penjualan, sehingga pendapatannya dapat dihitung tanpa alokasi."
        aksi={
          <Button asChild>
            <Link href="/proyek/baru"><Plus className="mr-2 h-4 w-4" />Buat Proyek</Link>
          </Button>
        }
      />

      {proyek.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Belum ada proyek. Konfirmasikan sebuah pesanan penjualan lebih dulu, lalu buka
          proyeknya di sini.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Kode</th>
                <th className="px-4 py-2 text-left font-medium">Nama</th>
                <th className="px-4 py-2 text-left font-medium">Pesanan</th>
                <th className="px-4 py-2 text-left font-medium">Pelanggan</th>
                <th className="px-4 py-2 text-left font-medium">Manajer</th>
                <th className="px-4 py-2 text-left font-medium">Mulai</th>
                <th className="px-4 py-2 text-right font-medium">Pendapatan</th>
                <th className="px-4 py-2 text-right font-medium">Laba</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="w-24 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {dengan.map(({ p, laba }) => (
                <tr key={p.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{p.kode}</td>
                  <td className="px-4 py-1.5">{p.nama}</td>
                  <td className="px-4 py-1.5 font-mono text-xs">
                    <Link href={`/penjualan/pesanan/${p.soId}`} className="underline">
                      {pesanan.get(p.soId) ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-1.5">{mitra.get(p.partnerId) ?? '—'}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {p.manajerId ? pengguna.get(p.manajerId) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">{p.tanggalMulai}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(laba.pendapatan)}
                  </td>
                  <td className={`px-4 py-1.5 text-right font-medium tabular-nums ${
                    Number(laba.laba) < 0 ? 'text-destructive' : ''
                  }`}>
                    {formatAngka(laba.laba)}
                  </td>
                  <td className="px-4 py-1.5">
                    <Badge variant={VARIAN[p.status]}>{LABEL_STATUS_PROYEK[p.status]}</Badge>
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/proyek/${p.id}`}>Buka</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
