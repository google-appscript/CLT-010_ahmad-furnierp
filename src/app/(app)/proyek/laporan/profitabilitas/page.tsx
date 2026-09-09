import Link from 'next/link'
import { wajibIzin } from '@/lib/sesi'
import { profitabilitasSeluruhProyek } from '@/modules/proyek/layanan/laporan'
import { LABEL_STATUS_PROYEK } from '@/modules/proyek/validasi/proyek'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Profitabilitas Proyek' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  berjalan: 'default', selesai: 'default', draft: 'secondary', dibatalkan: 'outline',
}

export default async function HalamanProfitabilitas() {
  await wajibIzin('proyek.laporan.profitabilitas')

  const semua = await profitabilitasSeluruhProyek()
  const baris = semua.filter((p) => p.status !== 'dibatalkan')

  const total = baris.reduce(
    (t, b) => ({
      pendapatan: t.pendapatan + Number(b.pendapatan),
      hargaPokok: t.hargaPokok + Number(b.hargaPokok),
      labaKotor: t.labaKotor + Number(b.labaKotor),
      bebanLain: t.bebanLain + Number(b.bebanLain),
      biayaTenagaKerja: t.biayaTenagaKerja + Number(b.biayaTenagaKerja),
      jam: t.jam + Number(b.totalJam),
      laba: t.laba + Number(b.laba),
    }),
    {
      pendapatan: 0, hargaPokok: 0, labaKotor: 0,
      bebanLain: 0, biayaTenagaKerja: 0, jam: 0, laba: 0,
    },
  )

  return (
    <>
      <KepalaHalaman
        judul="Profitabilitas Proyek"
        deskripsi="Pendapatan dan harga pokok diturunkan dari pesanan penjualan yang dipegang setiap proyek, tanpa alokasi. Proyek yang dibatalkan tidak dihitung."
      />

      {baris.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Belum ada proyek yang dapat dihitung.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Proyek</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Pendapatan</th>
                <th className="px-4 py-2 text-right font-medium">Harga Pokok</th>
                <th className="px-4 py-2 text-right font-medium">Laba Kotor</th>
                <th className="px-4 py-2 text-right font-medium">Beban Proyek</th>
                <th className="px-4 py-2 text-right font-medium">Jam</th>
                <th className="px-4 py-2 text-right font-medium">Biaya Tenaga Kerja</th>
                <th className="px-4 py-2 text-right font-medium">Laba Proyek</th>
                <th className="px-4 py-2 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.proyekId} className="border-b">
                  <td className="px-4 py-1.5">
                    <Link href={`/proyek/${b.proyekId}`} className="font-mono text-xs underline">
                      {b.kode}
                    </Link>
                    <span className="ml-2">{b.nama}</span>
                  </td>
                  <td className="px-4 py-1.5">
                    <Badge variant={VARIAN[b.status]}>{LABEL_STATUS_PROYEK[b.status]}</Badge>
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(b.pendapatan)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(b.hargaPokok)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(b.labaKotor)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(b.bebanLain)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(b.totalJam, 2)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(b.biayaTenagaKerja)}
                  </td>
                  <td className={`px-4 py-1.5 text-right font-medium tabular-nums ${
                    Number(b.laba) < 0 ? 'text-destructive' : ''
                  }`}>
                    {formatAngka(b.laba)}
                  </td>
                  <td className={`px-4 py-1.5 text-right tabular-nums ${
                    b.marginPersen !== null && Number(b.marginPersen) < 0 ? 'text-destructive' : ''
                  }`}>
                    {b.marginPersen === null ? '—' : `${formatAngka(b.marginPersen, 2)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 bg-muted/40 font-semibold">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-right">Total</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(total.pendapatan.toFixed(2))}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(total.hargaPokok.toFixed(2))}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(total.labaKotor.toFixed(2))}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(total.bebanLain.toFixed(2))}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(total.jam.toFixed(2), 2)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(total.biayaTenagaKerja.toFixed(2))}
                </td>
                <td className={`px-4 py-2 text-right tabular-nums ${
                  total.laba < 0 ? 'text-destructive' : ''
                }`}>
                  {formatAngka(total.laba.toFixed(2))}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {total.pendapatan === 0
                    ? '—'
                    : `${formatAngka(((total.laba / total.pendapatan) * 100).toFixed(2), 2)}%`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="mt-3 text-sm text-muted-foreground">
        Laba kotor murni angka buku besar: pendapatan dari faktur terposting dan harga pokok
        dari pengiriman. Beban proyek berasal dari item jurnal yang ditandai ke proyek, dan
        biaya tenaga kerja dari timesheet yang belum menyentuh buku besar — laba proyek adalah
        pandangan manajerial di atas laba kotor.
      </p>
    </>
  )
}
