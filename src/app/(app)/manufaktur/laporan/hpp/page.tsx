import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { products, uoms } from '@/db/schema'
import {
  daftarPerintahProduksi, biayaProduksi,
} from '@/modules/manufaktur/layanan/perintah-produksi'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { periodeBawaan, tanggalPanjang } from '@/app/(app)/akuntansi/laporan/periode'

export const metadata = { title: 'Analisis HPP Produksi' }

export default async function HalamanLaporanHpp({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('manufaktur.laporan.hpp')
  const { dari, sampai } = periodeBawaan(await searchParams)

  const [semua, semuaProduk, semuaSatuan] = await Promise.all([
    daftarPerintahProduksi({ status: 'selesai' }),
    db.select({ id: products.id, kode: products.kode, nama: products.nama })
      .from(products).orderBy(asc(products.kode)),
    db.select({ id: uoms.id, nama: uoms.nama }).from(uoms),
  ])

  const produkLewatId = new Map(semuaProduk.map((p) => [p.id, `${p.kode} — ${p.nama}`]))
  const satuanLewatId = new Map(semuaSatuan.map((s) => [s.id, s.nama]))

  // Hanya perintah yang sudah selesai punya harga pokok; yang masih berjalan
  // belum menyerap biaya apa pun sehingga tidak dapat dibandingkan.
  const dalamPeriode = semua.filter((p) => p.tanggal >= dari && p.tanggal <= sampai)
  const dengan = await Promise.all(
    dalamPeriode.map(async (p) => ({ p, biaya: await biayaProduksi(p.id) })),
  )

  const total = dengan.reduce(
    (t, { biaya }) => ({
      bahan: t.bahan + Number(biaya.bahan),
      tenagaKerja: t.tenagaKerja + Number(biaya.tenagaKerja),
      overhead: t.overhead + Number(biaya.overhead),
      total: t.total + Number(biaya.total),
    }),
    { bahan: 0, tenagaKerja: 0, overhead: 0, total: 0 },
  )

  const perProduk = new Map<string, { nama: string; kuantitas: number; nilai: number }>()
  for (const { p, biaya } of dengan) {
    const nama = produkLewatId.get(p.produkId) ?? '—'
    const sudahAda = perProduk.get(p.produkId) ?? { nama, kuantitas: 0, nilai: 0 }
    sudahAda.kuantitas += Number(p.kuantitas)
    sudahAda.nilai += Number(biaya.total)
    perProduk.set(p.produkId, sudahAda)
  }
  const ringkasan = [...perProduk.values()].sort((a, b) => b.nilai - a.nilai)

  return (
    <>
      <KepalaHalaman
        judul="Analisis HPP Produksi"
        deskripsi={`Periode ${tanggalPanjang(dari)} sampai ${tanggalPanjang(sampai)}. Hanya perintah produksi yang sudah selesai yang memiliki harga pokok.`}
      />
      <PenyaringPeriode dari={dari} sampai={sampai} />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Komposisi Biaya</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kartu label="Bahan" nilai={total.bahan} pembagi={total.total} />
          <Kartu label="Tenaga Kerja Langsung" nilai={total.tenagaKerja} pembagi={total.total} />
          <Kartu label="Overhead Pabrik" nilai={total.overhead} pembagi={total.total} />
          <Kartu label="Total Biaya Produksi" nilai={total.total} pembagi={0} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Produksi per Produk</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Produk</th>
                <th className="px-4 py-2 text-right font-medium">Kuantitas</th>
                <th className="px-4 py-2 text-right font-medium">Total Biaya</th>
                <th className="px-4 py-2 text-right font-medium">Rata-rata per Satuan</th>
              </tr>
            </thead>
            <tbody>
              {ringkasan.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    Belum ada produksi yang selesai pada periode ini.
                  </td>
                </tr>
              )}
              {ringkasan.map((r) => (
                <tr key={r.nama} className="border-b">
                  <td className="px-4 py-1.5">{r.nama}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(r.kuantitas.toFixed(2), 2)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(r.nilai.toFixed(2))}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka((r.nilai / r.kuantitas).toFixed(2))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Rincian Perintah</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nomor</th>
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left font-medium">Produk</th>
                <th className="px-4 py-2 text-right font-medium">Kuantitas</th>
                <th className="px-4 py-2 text-right font-medium">Bahan</th>
                <th className="px-4 py-2 text-right font-medium">Tenaga Kerja</th>
                <th className="px-4 py-2 text-right font-medium">Overhead</th>
                <th className="px-4 py-2 text-right font-medium">Harga Pokok Satuan</th>
              </tr>
            </thead>
            <tbody>
              {dengan.map(({ p, biaya }) => (
                <tr key={p.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{p.nomor}</td>
                  <td className="px-4 py-1.5">{p.tanggal}</td>
                  <td className="px-4 py-1.5">{produkLewatId.get(p.produkId) ?? '—'}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(p.kuantitas, 2)} {satuanLewatId.get(p.uomId) ?? ''}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(biaya.bahan)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(biaya.tenagaKerja)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(biaya.overhead)}
                  </td>
                  <td className="px-4 py-1.5 text-right font-medium tabular-nums">
                    {p.hargaPokokSatuan ? formatAngka(p.hargaPokokSatuan) : '—'}
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

function Kartu({ label, nilai, pembagi }: { label: string; nilai: number; pembagi: number }) {
  const persen = pembagi > 0 ? (nilai / pembagi) * 100 : null
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{formatAngka(nilai.toFixed(2))}</p>
      {persen !== null && (
        <p className="text-xs text-muted-foreground">{persen.toFixed(1)}% dari total</p>
      )}
    </div>
  )
}
