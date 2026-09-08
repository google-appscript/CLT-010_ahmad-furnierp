import { wajibIzin } from '@/lib/sesi'
import { rekapPajak } from '@/modules/akuntansi/layanan/laporan'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { periodeBawaan, tanggalPanjang } from '../periode'

export const metadata = { title: 'Laporan Pajak' }

export default async function HalamanLaporanPajak({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.laporan.pajak')
  const { dari, sampai } = periodeBawaan(await searchParams)
  const baris = await rekapPajak(dari, sampai)

  const keluaran = baris.filter((b) => b.ruangLingkup === 'penjualan')
  const masukan = baris.filter((b) => b.ruangLingkup === 'pembelian')
  const total = (d: typeof baris) => d.reduce((t, b) => t + Number(b.pajak), 0).toFixed(2)

  return (
    <>
      <KepalaHalaman
        judul="Laporan Pajak"
        deskripsi={`Rekap pajak per masa · ${tanggalPanjang(dari)} sampai ${tanggalPanjang(sampai)}`}
      />
      <PenyaringPeriode dari={dari} sampai={sampai} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Bagian judul="Pajak Keluaran (Penjualan)" baris={keluaran} total={total(keluaran)} />
        <Bagian judul="Pajak Masukan (Pembelian)" baris={masukan} total={total(masukan)} />
      </div>

      <p className="mt-6 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
        Kolom dasar pengenaan pajak baru terisi setelah modul Faktur Penjualan dan Tagihan
        Pembelian dibangun pada Fase 3 dan 4. Saat ini rekap hanya menampilkan nilai pajaknya.
      </p>
    </>
  )
}

function Bagian({
  judul, baris, total,
}: {
  judul: string
  baris: { kodePajak: string; namaPajak: string; pajak: string }[]
  total: string
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">{judul}</h2>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kode</th>
              <th className="px-4 py-2 text-left font-medium">Jenis Pajak</th>
              <th className="px-4 py-2 text-right font-medium">Nilai Pajak</th>
            </tr>
          </thead>
          <tbody>
            {baris.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                  Belum ada transaksi berpajak pada periode ini.
                </td>
              </tr>
            )}
            {baris.map((b) => (
              <tr key={b.kodePajak} className="border-b">
                <td className="px-4 py-1.5 font-mono text-xs">{b.kodePajak}</td>
                <td className="px-4 py-1.5">{b.namaPajak}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.pajak)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/40 font-semibold">
            <tr>
              <td colSpan={2} className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatAngka(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
