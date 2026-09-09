import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { db } from '@/db/klien'
import { partners } from '@/db/schema'
import { daftarPesanan, totalPesanan, type Pesanan } from '@/modules/pembelian/layanan/pesanan'
import { LABEL_STATUS_PEMBELIAN } from '@/modules/pembelian/validasi/pesanan'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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
    pesanan.map(async (p) => ({ p, total: await totalPesanan(p.id) })),
  )

  if (pesanan.length === 0) {
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
            <th className="px-4 py-2 text-left font-medium">Referensi</th>
            <th className="px-4 py-2 text-right font-medium">Total Tagihan</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="w-24 px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {dengan.map(({ p, total }) => (
            <tr key={p.id} className="border-b">
              <td className="px-4 py-1.5 font-mono text-xs">{p.nomor ?? '—'}</td>
              <td className="px-4 py-1.5">{p.tanggal}</td>
              <td className="px-4 py-1.5">{mitraLewatId.get(p.partnerId) ?? '—'}</td>
              <td className="px-4 py-1.5 text-muted-foreground">{p.referensi ?? '—'}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">
                {formatAngka(total.totalTagihan)}
              </td>
              <td className="px-4 py-1.5">
                <Badge variant={VARIAN[p.status]}>{LABEL_STATUS_PEMBELIAN[p.status]}</Badge>
              </td>
              <td className="px-4 py-1.5 text-right">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/pembelian/pesanan/${p.id}`}>Buka</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
