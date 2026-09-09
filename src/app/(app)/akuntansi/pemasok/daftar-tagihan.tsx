import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { db } from '@/db/klien'
import { partners } from '@/db/schema'
import { daftarTagihan, ringkasanTagihan, type Tagihan } from '@/modules/pembelian/layanan/tagihan'
import { LABEL_STATUS_TAGIHAN } from '@/modules/pembelian/validasi/pesanan'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  diposting: 'default', draft: 'secondary', dibatalkan: 'outline',
}

export async function DaftarTagihan({ tipe }: { tipe: Tagihan['tipe'] }) {
  const [daftar, semuaMitra] = await Promise.all([
    daftarTagihan({ tipe }),
    db.select({ id: partners.id, nama: partners.nama }).from(partners).orderBy(asc(partners.nama)),
  ])
  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))

  const dengan = await Promise.all(
    daftar.map(async (t) => (await ringkasanTagihan(t.id))!),
  )

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
            <th className="px-4 py-2 text-left font-medium">Pemasok</th>
            <th className="px-4 py-2 text-left font-medium">Faktur Pemasok</th>
            <th className="px-4 py-2 text-left font-medium">Jatuh Tempo</th>
            <th className="px-4 py-2 text-right font-medium">Total</th>
            <th className="px-4 py-2 text-right font-medium">Sisa</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="w-24 px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {dengan.map((t) => (
            <tr key={t.id} className="border-b">
              <td className="px-4 py-1.5 font-mono text-xs">{t.nomor ?? '—'}</td>
              <td className="px-4 py-1.5">{t.tanggal}</td>
              <td className="px-4 py-1.5">{mitraLewatId.get(t.partnerId) ?? '—'}</td>
              <td className="px-4 py-1.5 text-muted-foreground">{t.referensiPemasok ?? '—'}</td>
              <td className="px-4 py-1.5 text-muted-foreground">{t.tanggalJatuhTempo ?? '—'}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(t.totalTagihan)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">
                {t.status === 'diposting' ? formatAngka(t.sisa) : '—'}
              </td>
              <td className="px-4 py-1.5">
                <Badge variant={VARIAN[t.status]}>{LABEL_STATUS_TAGIHAN[t.status]}</Badge>
              </td>
              <td className="px-4 py-1.5 text-right">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/akuntansi/pemasok/tagihan/${t.id}`}>Buka</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
