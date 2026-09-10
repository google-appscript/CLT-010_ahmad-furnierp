import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { partners } from '@/db/schema'
import { daftarPesanan, totalPesanan } from '@/modules/pembelian/layanan/pesanan'
import { LABEL_STATUS_PEMBELIAN } from '@/modules/pembelian/validasi/pesanan'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { periodeBawaan, tanggalPanjang } from '@/app/(app)/akuntansi/laporan/periode'

export const metadata = { title: 'Laporan Pembelian' }

export default async function HalamanLaporanPembelian({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('pembelian.laporan.lihat')
  const { dari, sampai } = periodeBawaan(await searchParams)

  const [{ data: semua }, semuaMitra] = await Promise.all([
    daftarPesanan({ halaman: 1, ukuranHalaman: 100000 }),
    db.select({ id: partners.id, nama: partners.nama }).from(partners).orderBy(asc(partners.nama)),
  ])
  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))

  // Pesanan yang dibatalkan tidak dihitung sebagai pembelian.
  const dalamPeriode = semua.filter(
    (p) => p.tanggal >= dari && p.tanggal <= sampai && p.status !== 'dibatalkan',
  )

  const dengan = await Promise.all(
    dalamPeriode.map(async (p) => ({ p, total: await totalPesanan(p.id) })),
  )

  const perPemasok = new Map<string, { nama: string; jumlah: number; nilai: number }>()
  for (const { p, total } of dengan) {
    const nama = mitraLewatId.get(p.partnerId) ?? '—'
    const sudahAda = perPemasok.get(p.partnerId) ?? { nama, jumlah: 0, nilai: 0 }
    sudahAda.jumlah += 1
    sudahAda.nilai += Number(total.totalTagihan)
    perPemasok.set(p.partnerId, sudahAda)
  }

  const ringkasan = [...perPemasok.values()].sort((a, b) => b.nilai - a.nilai)
  const totalNilai = ringkasan.reduce((t, r) => t + r.nilai, 0)

  return (
    <>
      <KepalaHalaman
        judul="Laporan Pembelian"
        deskripsi={`Periode ${tanggalPanjang(dari)} sampai ${tanggalPanjang(sampai)}. Pesanan yang dibatalkan tidak dihitung.`}
      />
      <PenyaringPeriode dari={dari} sampai={sampai} />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Pembelian per Pemasok</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Pemasok</th>
                <th className="px-4 py-2 text-right font-medium">Jumlah Dokumen</th>
                <th className="px-4 py-2 text-right font-medium">Nilai Pembelian</th>
              </tr>
            </thead>
            <tbody>
              {ringkasan.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                    Belum ada pembelian pada periode ini.
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

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Rincian Dokumen</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nomor</th>
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left font-medium">Pemasok</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {dengan.map(({ p, total }) => (
                <tr key={p.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{p.nomor ?? 'Permintaan'}</td>
                  <td className="px-4 py-1.5">{p.tanggal}</td>
                  <td className="px-4 py-1.5">{mitraLewatId.get(p.partnerId) ?? '—'}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {LABEL_STATUS_PEMBELIAN[p.status]}
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
