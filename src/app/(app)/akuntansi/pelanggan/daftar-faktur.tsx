import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { db } from '@/db/klien'
import { partners } from '@/db/schema'
import { daftarFaktur, ringkasanFaktur, type Faktur } from '@/modules/penjualan/layanan/faktur'
import { LABEL_STATUS_FAKTUR } from '@/modules/penjualan/validasi/pesanan'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  diposting: 'default', draft: 'secondary', dibatalkan: 'outline',
}

export async function DaftarFaktur({ tipe }: { tipe: Faktur['tipe'] }) {
  const [daftar, semuaMitra] = await Promise.all([
    daftarFaktur({ tipe }),
    db.select({ id: partners.id, nama: partners.nama }).from(partners).orderBy(asc(partners.nama)),
  ])
  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))
  const dengan = await Promise.all(daftar.map(async (f) => (await ringkasanFaktur(f.id))!))

  if (daftar.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Belum ada dokumen.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Nomor</th>
            <th className="px-4 py-2 text-left font-medium">Tanggal</th>
            <th className="px-4 py-2 text-left font-medium">Pelanggan</th>
            <th className="px-4 py-2 text-left font-medium">Jatuh Tempo</th>
            <th className="px-4 py-2 text-right font-medium">Total</th>
            <th className="px-4 py-2 text-right font-medium">Sisa</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="w-24 px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {dengan.map((f) => (
            <tr key={f.id} className="border-b">
              <td className="px-4 py-1.5 font-mono text-xs">{f.nomor ?? '—'}</td>
              <td className="px-4 py-1.5">{f.tanggal}</td>
              <td className="px-4 py-1.5">{mitraLewatId.get(f.partnerId) ?? '—'}</td>
              <td className="px-4 py-1.5 text-muted-foreground">{f.tanggalJatuhTempo ?? '—'}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(f.totalTagihan)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">
                {f.status === 'diposting' ? formatAngka(f.sisa) : '—'}
              </td>
              <td className="px-4 py-1.5">
                <Badge variant={VARIAN[f.status]}>{LABEL_STATUS_FAKTUR[f.status]}</Badge>
              </td>
              <td className="px-4 py-1.5 text-right">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/akuntansi/pelanggan/faktur/${f.id}`}>Buka</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
