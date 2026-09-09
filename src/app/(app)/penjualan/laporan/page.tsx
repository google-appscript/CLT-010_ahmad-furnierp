import { asc, eq, inArray } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { partners, products, salesOrderLines } from '@/db/schema'
import { daftarPesanan, totalPesanan } from '@/modules/penjualan/layanan/pesanan'
import { LABEL_STATUS_PENJUALAN } from '@/modules/penjualan/validasi/pesanan'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { periodeBawaan, tanggalPanjang } from '@/app/(app)/akuntansi/laporan/periode'

export const metadata = { title: 'Laporan Penjualan' }

export default async function HalamanLaporanPenjualan({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('penjualan.laporan.lihat')
  const { dari, sampai } = periodeBawaan(await searchParams)

  const [semua, semuaMitra] = await Promise.all([
    daftarPesanan(),
    db.select({ id: partners.id, nama: partners.nama }).from(partners).orderBy(asc(partners.nama)),
  ])
  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))

  // Penawaran yang dibatalkan bukan penjualan; penawaran terbuka pun belum,
  // tetapi tetap ditampilkan agar pipeline terlihat.
  const dalamPeriode = semua.filter(
    (p) => p.tanggal >= dari && p.tanggal <= sampai && p.status !== 'dibatalkan',
  )

  const dengan = await Promise.all(
    dalamPeriode.map(async (p) => ({ p, total: await totalPesanan(p.id) })),
  )

  const perPelanggan = new Map<string, { nama: string; jumlah: number; nilai: number }>()
  for (const { p, total } of dengan) {
    const nama = mitraLewatId.get(p.partnerId) ?? '—'
    const sudahAda = perPelanggan.get(p.partnerId) ?? { nama, jumlah: 0, nilai: 0 }
    sudahAda.jumlah += 1
    sudahAda.nilai += Number(total.totalTagihan)
    perPelanggan.set(p.partnerId, sudahAda)
  }

  const ringkasan = [...perPelanggan.values()].sort((a, b) => b.nilai - a.nilai)
  const totalNilai = ringkasan.reduce((t, r) => t + r.nilai, 0)

  // Peringkat produk memakai dasar pengenaan pajak — kuantitas dikali harga
  // satuan — agar perbandingan antarproduk tidak terganggu tarif pajak berbeda.
  const idPesanan = dalamPeriode.map((p) => p.id)
  const baris = idPesanan.length > 0
    ? await db
        .select({
          produkId: salesOrderLines.produkId,
          namaProduk: products.nama,
          kuantitas: salesOrderLines.kuantitas,
          hargaSatuan: salesOrderLines.hargaSatuan,
        })
        .from(salesOrderLines)
        .innerJoin(products, eq(products.id, salesOrderLines.produkId))
        .where(inArray(salesOrderLines.soId, idPesanan))
    : []

  const perProduk = new Map<string, { nama: string; kuantitas: number; nilai: number }>()
  for (const b of baris) {
    const sudahAda = perProduk.get(b.produkId) ?? { nama: b.namaProduk, kuantitas: 0, nilai: 0 }
    sudahAda.kuantitas += Number(b.kuantitas)
    sudahAda.nilai += Number(b.kuantitas) * Number(b.hargaSatuan)
    perProduk.set(b.produkId, sudahAda)
  }
  const produkTeratas = [...perProduk.values()].sort((a, b) => b.nilai - a.nilai).slice(0, 10)

  return (
    <>
      <KepalaHalaman
        judul="Laporan Penjualan"
        deskripsi={`Periode ${tanggalPanjang(dari)} sampai ${tanggalPanjang(sampai)}. Pesanan yang dibatalkan tidak dihitung.`}
      />
      <PenyaringPeriode dari={dari} sampai={sampai} />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Penjualan per Pelanggan</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Pelanggan</th>
                <th className="px-4 py-2 text-right font-medium">Jumlah Dokumen</th>
                <th className="px-4 py-2 text-right font-medium">Nilai Penjualan</th>
              </tr>
            </thead>
            <tbody>
              {ringkasan.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                    Belum ada penjualan pada periode ini.
                  </td>
                </tr>
              )}
              {ringkasan.map((r) => (
                <tr key={r.nama} className="border-b">
                  <td className="px-4 py-1.5">{r.nama}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{r.jumlah}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(r.nilai.toFixed(2))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 bg-muted/40 font-semibold">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-right">Total</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(totalNilai.toFixed(2))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {produkTeratas.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Produk Terlaris (Dasar Pengenaan Pajak)
          </h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Produk</th>
                  <th className="px-4 py-2 text-right font-medium">Kuantitas</th>
                  <th className="px-4 py-2 text-right font-medium">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {produkTeratas.map((r) => (
                  <tr key={r.nama} className="border-b">
                    <td className="px-4 py-1.5">{r.nama}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(r.kuantitas.toFixed(2), 2)}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(r.nilai.toFixed(2))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Rincian Dokumen</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nomor</th>
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left font-medium">Pelanggan</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {dengan.map(({ p, total }) => (
                <tr key={p.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{p.nomor ?? 'Penawaran'}</td>
                  <td className="px-4 py-1.5">{p.tanggal}</td>
                  <td className="px-4 py-1.5">{mitraLewatId.get(p.partnerId) ?? '—'}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {LABEL_STATUS_PENJUALAN[p.status]}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(total.totalTagihan)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
