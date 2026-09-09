import Link from 'next/link'
import { asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { partners, accounts, customerPaymentAllocations, customerInvoices } from '@/db/schema'
import { daftarPembayaran, akunKasDanBank } from '@/modules/penjualan/layanan/pembayaran'
import { fakturBelumLunas } from '@/modules/penjualan/layanan/faktur'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DialogPenerimaan } from './dialog-penerimaan'

export const metadata = { title: 'Pembayaran Masuk' }

export default async function HalamanPenerimaan({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.pembayaran-masuk.lihat')
  const params = await searchParams
  const fakturAwal = Array.isArray(params.faktur) ? params.faktur[0] : params.faktur

  const [pembayaran, terbuka, akunKas, semuaMitra, semuaAkun, semuaAlokasi, semuaFaktur] =
    await Promise.all([
      daftarPembayaran(),
      fakturBelumLunas(),
      akunKasDanBank(),
      db.select({ id: partners.id, nama: partners.nama }).from(partners)
        .where(eq(partners.isPelanggan, true)).orderBy(asc(partners.nama)),
      db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama }).from(accounts),
      db.select().from(customerPaymentAllocations),
      db.select({ id: customerInvoices.id, nomor: customerInvoices.nomor }).from(customerInvoices),
    ])

  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))
  const akunLewatId = new Map(semuaAkun.map((a) => [a.id, `${a.kode} — ${a.nama}`]))
  const fakturLewatId = new Map(semuaFaktur.map((f) => [f.id, f.nomor]))

  const alokasiLewatPembayaran = new Map<string, typeof semuaAlokasi>()
  for (const a of semuaAlokasi) {
    alokasiLewatPembayaran.set(
      a.pembayaranId, [...(alokasiLewatPembayaran.get(a.pembayaranId) ?? []), a],
    )
  }

  return (
    <>
      <KepalaHalaman
        judul="Pembayaran Masuk"
        deskripsi="Mendebit kas atau bank sebesar penerimaan dan mengkredit piutang usaha sebesar yang dialokasikan ke faktur."
        aksi={
          <DialogPenerimaan
            faktur={terbuka.map((f) => ({
              id: f.id, nomor: f.nomor ?? '—', partnerId: f.partnerId,
              namaPelanggan: mitraLewatId.get(f.partnerId) ?? '—',
              tanggal: f.tanggal, sisa: f.sisa,
            }))}
            akunKas={akunKas.map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }))}
            pelanggan={semuaMitra}
            fakturAwal={fakturAwal}
          />
        }
      />

      {pembayaran.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          {terbuka.length === 0
            ? 'Belum ada faktur terbuka yang menunggu pembayaran.'
            : 'Belum ada penerimaan tercatat.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nomor</th>
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left font-medium">Pelanggan</th>
                <th className="px-4 py-2 text-left font-medium">Diterima Pada</th>
                <th className="px-4 py-2 text-left font-medium">Faktur Dilunasi</th>
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
                      .map((a) => fakturLewatId.get(a.invoiceId) ?? '—').join(', ') || '—'}
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
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Faktur Belum Lunas</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Nomor</th>
                  <th className="px-4 py-2 text-left font-medium">Pelanggan</th>
                  <th className="px-4 py-2 text-left font-medium">Jatuh Tempo</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-right font-medium">Diterima</th>
                  <th className="px-4 py-2 text-right font-medium">Sisa</th>
                </tr>
              </thead>
              <tbody>
                {terbuka.map((f) => (
                  <tr key={f.id} className="border-b">
                    <td className="px-4 py-1.5">
                      <Link
                        href={`/akuntansi/pelanggan/faktur/${f.id}`}
                        className="font-mono text-xs underline"
                      >
                        {f.nomor}
                      </Link>
                    </td>
                    <td className="px-4 py-1.5">{mitraLewatId.get(f.partnerId) ?? '—'}</td>
                    <td className="px-4 py-1.5 text-muted-foreground">
                      {f.tanggalJatuhTempo ?? '—'}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(f.totalDiterima)}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(f.terbayar)}
                    </td>
                    <td className="px-4 py-1.5 text-right font-medium tabular-nums">
                      {formatAngka(f.sisa)}
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
