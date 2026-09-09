import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { partners, locations, taxes, customerInvoices } from '@/db/schema'
import { ambilPesanan, barisDenganSisa, totalPesanan } from '@/modules/penjualan/layanan/pesanan'
import { pengirimanPesanan } from '@/modules/penjualan/layanan/pengiriman'
import { LABEL_STATUS_PENJUALAN } from '@/modules/penjualan/validasi/pesanan'
import { formatAngka, formatRupiah } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirPesanan } from '../../formulir-pesanan'
import { ambilDataPilihanPenjualan } from '../../data-pilihan'
import { AksiPenawaran, DialogKirimBarang } from './aksi-pesanan'

export const metadata = { title: 'Detail Pesanan Penjualan' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  dikonfirmasi: 'default', selesai: 'default',
  penawaran: 'secondary', dibatalkan: 'outline',
}

export default async function HalamanDetailPesanan({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await wajibIzin('penjualan.pesanan.lihat')
  const { id } = await params
  const pesanan = await ambilPesanan(id)
  if (!pesanan) notFound()

  const pilihan = await ambilDataPilihanPenjualan()

  if (pesanan.status === 'penawaran') {
    return (
      <>
        <KepalaHalaman
          judul="Penawaran"
          deskripsi="Belum bernomor dan belum menjadi komitmen sampai dikonfirmasi."
        />
        <div className="mb-6"><AksiPenawaran id={pesanan.id} /></div>
        <FormulirPesanan
          awal={{
            id: pesanan.id,
            partnerId: pesanan.partnerId,
            tanggal: pesanan.tanggal,
            tanggalPengiriman: pesanan.tanggalPengiriman ?? '',
            lokasiAsalId: pesanan.lokasiAsalId,
            syaratPembayaranId: pesanan.syaratPembayaranId ?? '',
            referensi: pesanan.referensi ?? '',
            catatan: pesanan.catatan ?? '',
            baris: pesanan.baris.map((b) => ({
              produkId: b.produkId,
              deskripsi: b.deskripsi,
              kuantitas: String(Number(b.kuantitas)),
              uomId: b.uomId,
              hargaSatuan: String(Number(b.hargaSatuan)),
              taxId: b.taxId ?? '',
            })),
          }}
          {...pilihan}
        />
      </>
    )
  }

  const [sisa, total, pengiriman, semuaMitra, semuaLokasi, semuaPajak, fakturTerkait] =
    await Promise.all([
      barisDenganSisa(id),
      totalPesanan(id),
      pengirimanPesanan(id),
      db.select({ id: partners.id, nama: partners.nama }).from(partners),
      db.select({ id: locations.id, nama: locations.nama }).from(locations),
      db.select({ id: taxes.id, nama: taxes.nama }).from(taxes),
      db.select({ id: customerInvoices.id, nomor: customerInvoices.nomor, status: customerInvoices.status })
        .from(customerInvoices).where(eq(customerInvoices.soId, id)),
    ])

  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))
  const lokasiLewatId = new Map(semuaLokasi.map((l) => [l.id, l.nama]))
  const pajakLewatId = new Map(semuaPajak.map((p) => [p.id, p.nama]))
  const adaSisaDifakturkan = sisa.some((b) => Number(b.sisaDifakturkan) > 0)

  return (
    <>
      <KepalaHalaman
        judul={pesanan.nomor ?? 'Pesanan Penjualan'}
        deskripsi={pesanan.catatan ?? undefined}
        aksi={
          pesanan.status === 'dikonfirmasi' ? (
            <div className="flex gap-3">
              <DialogKirimBarang
                soId={id}
                baris={sisa.map((b) => ({
                  soLineId: b.id, namaProduk: b.namaProduk,
                  namaUom: b.namaUom, sisaDikirim: b.sisaDikirim,
                }))}
              />
              {adaSisaDifakturkan && (
                <Button asChild variant="outline">
                  <Link href={`/akuntansi/pelanggan/faktur/baru?so=${id}`}>Buat Faktur</Link>
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <dl className="mb-6 grid gap-4 rounded-md border p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Bidang label="Status">
          <Badge variant={VARIAN[pesanan.status]}>{LABEL_STATUS_PENJUALAN[pesanan.status]}</Badge>
        </Bidang>
        <Bidang label="Tanggal">{pesanan.tanggal}</Bidang>
        <Bidang label="Pengiriman">{pesanan.tanggalPengiriman ?? '—'}</Bidang>
        <Bidang label="Pelanggan">{mitraLewatId.get(pesanan.partnerId) ?? '—'}</Bidang>
        <Bidang label="Gudang Asal">{lokasiLewatId.get(pesanan.lokasiAsalId) ?? '—'}</Bidang>
        <Bidang label="Total Faktur">{formatRupiah(total.totalTagihan)}</Bidang>
      </dl>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Baris Pesanan</h2>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Produk</th>
              <th className="px-4 py-2 text-right font-medium">Dipesan</th>
              <th className="px-4 py-2 text-right font-medium">Dikirim</th>
              <th className="px-4 py-2 text-right font-medium">Difakturkan</th>
              <th className="px-4 py-2 text-right font-medium">Harga Jual</th>
              <th className="px-4 py-2 text-left font-medium">Pajak</th>
              <th className="px-4 py-2 text-right font-medium">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {sisa.map((b, i) => (
              <tr key={b.id} className="border-b">
                <td className="px-4 py-1.5">{b.deskripsi}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(b.kuantitas, 2)} {b.namaUom}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(b.kuantitasDikirim, 2)}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(b.kuantitasDifakturkan, 2)}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(b.hargaSatuan, 2)}
                </td>
                <td className="px-4 py-1.5 text-muted-foreground">
                  {b.taxId ? pajakLewatId.get(b.taxId) ?? '—' : '—'}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(total.baris[i].totalBaris)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/40">
            <tr>
              <td colSpan={6} className="px-4 py-1.5 text-right">Dasar Pengenaan Pajak</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(total.totalDpp)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="px-4 py-1.5 text-right">PPN Keluaran</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(total.totalPpn)}</td>
            </tr>
            <tr className="font-semibold">
              <td colSpan={6} className="px-4 py-2 text-right">Total Faktur</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatAngka(total.totalTagihan)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Pengiriman</h2>
          {pengiriman.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Belum ada pengiriman.
            </p>
          ) : (
            <ul className="space-y-2">
              {pengiriman.map((p) => (
                <li key={p.operasiId} className="flex items-center justify-between rounded-md border px-4 py-2 text-sm">
                  <Link
                    href={`/gudang/operasi/pengiriman/${p.operasiId}`}
                    className="font-mono text-xs underline"
                  >
                    {p.nomor}
                  </Link>
                  <span className="text-muted-foreground">{p.tanggal}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Faktur Penjualan</h2>
          {fakturTerkait.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Belum ada faktur.
            </p>
          ) : (
            <ul className="space-y-2">
              {fakturTerkait.map((f) => (
                <li key={f.id} className="flex items-center justify-between rounded-md border px-4 py-2 text-sm">
                  <Link
                    href={`/akuntansi/pelanggan/faktur/${f.id}`}
                    className="font-mono text-xs underline"
                  >
                    {f.nomor ?? 'Draft'}
                  </Link>
                  <span className="text-muted-foreground">{f.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/penjualan/pesanan">Kembali ke Daftar</Link>
        </Button>
      </div>
    </>
  )
}

function Bidang({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  )
}
