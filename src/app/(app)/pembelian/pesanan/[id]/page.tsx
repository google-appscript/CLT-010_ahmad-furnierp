import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { partners, locations, taxes, vendorBills } from '@/db/schema'
import { ambilPesanan, barisDenganSisa, totalPesanan } from '@/modules/pembelian/layanan/pesanan'
import { penerimaanPesanan } from '@/modules/pembelian/layanan/penerimaan'
import { LABEL_STATUS_PEMBELIAN } from '@/modules/pembelian/validasi/pesanan'
import { formatAngka, formatRupiah } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirPesanan } from '../../formulir-pesanan'
import { ambilDataPilihanPembelian } from '../../data-pilihan'
import { AksiPermintaan, DialogTerimaBarang } from './aksi-pesanan'

export const metadata = { title: 'Detail Pesanan Pembelian' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  dikonfirmasi: 'default', selesai: 'default',
  permintaan: 'secondary', dibatalkan: 'outline',
}

export default async function HalamanDetailPesanan({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await wajibIzin('pembelian.pesanan.lihat')
  const { id } = await params
  const pesanan = await ambilPesanan(id)
  if (!pesanan) notFound()

  const pilihan = await ambilDataPilihanPembelian()

  // Permintaan masih dapat diubah, jadi ditampilkan sebagai formulir.
  if (pesanan.status === 'permintaan') {
    return (
      <>
        <KepalaHalaman
          judul="Permintaan Penawaran"
          deskripsi="Belum bernomor dan belum menjadi komitmen sampai dikonfirmasi."
        />
        <div className="mb-6"><AksiPermintaan id={pesanan.id} /></div>
        <FormulirPesanan
          awal={{
            id: pesanan.id,
            partnerId: pesanan.partnerId,
            tanggal: pesanan.tanggal,
            tanggalDiharapkan: pesanan.tanggalDiharapkan ?? '',
            lokasiTujuanId: pesanan.lokasiTujuanId,
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

  const [sisa, total, penerimaan, semuaMitra, semuaLokasi, semuaPajak, tagihanTerkait] =
    await Promise.all([
      barisDenganSisa(id),
      totalPesanan(id),
      penerimaanPesanan(id),
      db.select({ id: partners.id, nama: partners.nama }).from(partners),
      db.select({ id: locations.id, nama: locations.nama }).from(locations),
      db.select({ id: taxes.id, nama: taxes.nama }).from(taxes),
      db.select({ id: vendorBills.id, nomor: vendorBills.nomor, status: vendorBills.status })
        .from(vendorBills).where(eq(vendorBills.poId, id)),
    ])

  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))
  const lokasiLewatId = new Map(semuaLokasi.map((l) => [l.id, l.nama]))
  const pajakLewatId = new Map(semuaPajak.map((p) => [p.id, p.nama]))

  const adaSisaDitagih = sisa.some((b) => Number(b.sisaDitagih) > 0)

  return (
    <>
      <KepalaHalaman
        judul={pesanan.nomor ?? 'Pesanan Pembelian'}
        deskripsi={pesanan.catatan ?? undefined}
        aksi={
          pesanan.status === 'dikonfirmasi' ? (
            <div className="flex gap-3">
              <DialogTerimaBarang
                poId={id}
                baris={sisa.map((b) => ({
                  poLineId: b.id, namaProduk: b.namaProduk,
                  namaUom: b.namaUom, sisaDiterima: b.sisaDiterima,
                }))}
              />
              {adaSisaDitagih && (
                <Button asChild variant="outline">
                  <Link href={`/akuntansi/pemasok/tagihan/baru?po=${id}`}>Buat Tagihan</Link>
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <dl className="mb-6 grid gap-4 rounded-md border p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Bidang label="Status">
          <Badge variant={VARIAN[pesanan.status]}>{LABEL_STATUS_PEMBELIAN[pesanan.status]}</Badge>
        </Bidang>
        <Bidang label="Tanggal">{pesanan.tanggal}</Bidang>
        <Bidang label="Diharapkan">{pesanan.tanggalDiharapkan ?? '—'}</Bidang>
        <Bidang label="Pemasok">{mitraLewatId.get(pesanan.partnerId) ?? '—'}</Bidang>
        <Bidang label="Gudang Tujuan">{lokasiLewatId.get(pesanan.lokasiTujuanId) ?? '—'}</Bidang>
        <Bidang label="Total Tagihan">{formatRupiah(total.totalTagihan)}</Bidang>
      </dl>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Baris Pesanan</h2>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Produk</th>
              <th className="px-4 py-2 text-right font-medium">Dipesan</th>
              <th className="px-4 py-2 text-right font-medium">Diterima</th>
              <th className="px-4 py-2 text-right font-medium">Ditagih</th>
              <th className="px-4 py-2 text-right font-medium">Harga Satuan</th>
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
                  {formatAngka(b.kuantitasDiterima, 2)}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(b.kuantitasDitagih, 2)}
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
              <td colSpan={6} className="px-4 py-1.5 text-right">PPN Masukan</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(total.totalPpn)}</td>
            </tr>
            <tr className="font-semibold">
              <td colSpan={6} className="px-4 py-2 text-right">Total Tagihan</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatAngka(total.totalTagihan)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Penerimaan Barang</h2>
          {penerimaan.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Belum ada penerimaan.
            </p>
          ) : (
            <ul className="space-y-2">
              {penerimaan.map((p) => (
                <li key={p.operasiId} className="flex items-center justify-between rounded-md border px-4 py-2 text-sm">
                  <Link
                    href={`/gudang/operasi/penerimaan/${p.operasiId}`}
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
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Tagihan Pemasok</h2>
          {tagihanTerkait.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Belum ada tagihan.
            </p>
          ) : (
            <ul className="space-y-2">
              {tagihanTerkait.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-md border px-4 py-2 text-sm">
                  <Link
                    href={`/akuntansi/pemasok/tagihan/${t.id}`}
                    className="font-mono text-xs underline"
                  >
                    {t.nomor ?? 'Draft'}
                  </Link>
                  <span className="text-muted-foreground">{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/pembelian/pesanan">Kembali ke Daftar</Link>
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
