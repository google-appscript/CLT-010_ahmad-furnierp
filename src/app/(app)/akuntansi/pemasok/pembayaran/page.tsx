import Link from 'next/link'
import { asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { partners, accounts, vendorPaymentAllocations, vendorBills } from '@/db/schema'
import { daftarPembayaran, akunKasDanBank } from '@/modules/pembelian/layanan/pembayaran'
import { tagihanBelumLunas } from '@/modules/pembelian/layanan/tagihan'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DialogPembayaran } from './dialog-pembayaran'

export const metadata = { title: 'Pembayaran Keluar' }

export default async function HalamanPembayaran({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.pembayaran-keluar.lihat')
  const params = await searchParams
  const tagihanAwal = Array.isArray(params.tagihan) ? params.tagihan[0] : params.tagihan

  const [pembayaran, terbuka, akunKas, semuaMitra, semuaAkun, semuaAlokasi, semuaTagihan] =
    await Promise.all([
      daftarPembayaran(),
      tagihanBelumLunas(),
      akunKasDanBank(),
      db.select({ id: partners.id, nama: partners.nama }).from(partners)
        .where(eq(partners.isPemasok, true)).orderBy(asc(partners.nama)),
      db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama }).from(accounts),
      db.select().from(vendorPaymentAllocations),
      db.select({ id: vendorBills.id, nomor: vendorBills.nomor }).from(vendorBills),
    ])

  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))
  const akunLewatId = new Map(semuaAkun.map((a) => [a.id, `${a.kode} — ${a.nama}`]))
  const tagihanLewatId = new Map(semuaTagihan.map((t) => [t.id, t.nomor]))

  const alokasiLewatPembayaran = new Map<string, typeof semuaAlokasi>()
  for (const a of semuaAlokasi) {
    alokasiLewatPembayaran.set(
      a.pembayaranId, [...(alokasiLewatPembayaran.get(a.pembayaranId) ?? []), a],
    )
  }

  return (
    <>
      <KepalaHalaman
        judul="Pembayaran Keluar"
        deskripsi="Mendebit utang usaha sebesar yang dialokasikan ke tagihan dan mengkredit kas atau bank sebesar seluruh pembayaran."
        aksi={
          <DialogPembayaran
            tagihan={terbuka.map((t) => ({
              id: t.id, nomor: t.nomor ?? '—', partnerId: t.partnerId,
              namaPemasok: mitraLewatId.get(t.partnerId) ?? '—',
              tanggal: t.tanggal, sisa: t.sisa,
            }))}
            akunKas={akunKas.map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }))}
            pemasok={semuaMitra}
            tagihanAwal={tagihanAwal}
          />
        }
      />

      {pembayaran.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          {terbuka.length === 0
            ? 'Belum ada tagihan terbuka yang perlu dibayar.'
            : 'Belum ada pembayaran tercatat.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nomor</th>
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left font-medium">Pemasok</th>
                <th className="px-4 py-2 text-left font-medium">Dibayar Dari</th>
                <th className="px-4 py-2 text-left font-medium">Tagihan Dilunasi</th>
                <th className="px-4 py-2 text-right font-medium">Jumlah</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pembayaran.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{p.nomor ?? '—'}</td>
                  <td className="px-4 py-1.5">{p.tanggal}</td>
                  <td className="px-4 py-1.5">{mitraLewatId.get(p.partnerId) ?? '—'}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {akunLewatId.get(p.akunKasId) ?? '—'}
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {(alokasiLewatPembayaran.get(p.id) ?? [])
                      .map((a) => tagihanLewatId.get(a.billId) ?? '—').join(', ') || '—'}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(p.jumlah)}</td>
                  <td className="px-4 py-1.5">
                    <Badge variant={p.status === 'diposting' ? 'default' : 'secondary'}>
                      {p.status === 'diposting' ? 'Diposting' : 'Draft'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {terbuka.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Tagihan Belum Lunas</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Nomor</th>
                  <th className="px-4 py-2 text-left font-medium">Pemasok</th>
                  <th className="px-4 py-2 text-left font-medium">Jatuh Tempo</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-right font-medium">Terbayar</th>
                  <th className="px-4 py-2 text-right font-medium">Sisa</th>
                </tr>
              </thead>
              <tbody>
                {terbuka.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="px-4 py-1.5">
                      <Link
                        href={`/akuntansi/pemasok/tagihan/${t.id}`}
                        className="font-mono text-xs underline"
                      >
                        {t.nomor}
                      </Link>
                    </td>
                    <td className="px-4 py-1.5">{mitraLewatId.get(t.partnerId) ?? '—'}</td>
                    <td className="px-4 py-1.5 text-muted-foreground">
                      {t.tanggalJatuhTempo ?? '—'}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(t.totalDibayar)}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(t.terbayar)}
                    </td>
                    <td className="px-4 py-1.5 text-right font-medium tabular-nums">
                      {formatAngka(t.sisa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
