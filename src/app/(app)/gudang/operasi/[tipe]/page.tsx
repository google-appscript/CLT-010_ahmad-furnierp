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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

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
  params,
}: {
  params: Promise<{ tipe: string }>
}) {
  const { tipe: slug } = await params
  const tipe = SLUG_KE_TIPE[slug]
  if (!tipe) notFound()

  await wajibIzin(IZIN[tipe])
  const [operasi, semuaLokasi, semuaMitra] = await Promise.all([
    daftarOperasi({ tipe }),
    db.select().from(locations).orderBy(asc(locations.kode)),
    db.select({ id: partners.id, nama: partners.nama }).from(partners),
  ])

  const lokasiLewatId = new Map(semuaLokasi.map((l) => [l.id, l.nama]))
  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))

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

      {operasi.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Belum ada dokumen {labelTipeOperasi(tipe).toLowerCase()}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nomor</th>
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left font-medium">Dari</th>
                <th className="px-4 py-2 text-left font-medium">Ke</th>
                <th className="px-4 py-2 text-left font-medium">Mitra</th>
                <th className="px-4 py-2 text-left font-medium">Referensi</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="w-24 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {operasi.map((o) => (
                <tr key={o.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{o.nomor ?? '—'}</td>
                  <td className="px-4 py-1.5">{o.tanggal}</td>
                  <td className="px-4 py-1.5">{lokasiLewatId.get(o.lokasiAsalId) ?? '—'}</td>
                  <td className="px-4 py-1.5">{lokasiLewatId.get(o.lokasiTujuanId) ?? '—'}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {o.partnerId ? mitraLewatId.get(o.partnerId) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">{o.referensi ?? '—'}</td>
                  <td className="px-4 py-1.5">
                    <Badge variant={VARIAN[o.status]}>{LABEL_STATUS_OPERASI[o.status]}</Badge>
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/gudang/operasi/${slug}/${o.id}`}>Buka</Link>
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
