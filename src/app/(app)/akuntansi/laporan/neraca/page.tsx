import { AlertTriangle } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { laporanNeraca } from '@/modules/akuntansi/layanan/laporan'
import { formatRupiah } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { TabelLaporan } from '@/components/laporan/tabel-laporan'
import { periodeBawaan, tanggalPanjang } from '../periode'

export const metadata = { title: 'Neraca' }

export default async function HalamanNeraca({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.laporan.neraca')
  const { dari, sampai } = periodeBawaan(await searchParams)
  const n = await laporanNeraca(sampai)

  return (
    <>
      <KepalaHalaman judul="Neraca" deskripsi={`Per ${tanggalPanjang(sampai)}`} />
      <PenyaringPeriode dari={dari} sampai={sampai} hanyaSampai />

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Aset</h2>
          <TabelLaporan baris={n.aset} />
        </section>
        <section className="space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Liabilitas</h2>
            <TabelLaporan baris={n.liabilitas} />
          </div>
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Ekuitas</h2>
            <TabelLaporan baris={n.ekuitas} />
          </div>
        </section>
      </div>

      {n.seimbang ? (
        <p className="mt-6 rounded-md border bg-muted/40 p-4 text-sm">
          Aset {formatRupiah(n.totalAset)} = Liabilitas {formatRupiah(n.totalLiabilitas)} +
          Ekuitas {formatRupiah(n.totalEkuitas)}. Neraca seimbang.
        </p>
      ) : (
        <p className="mt-6 flex items-start gap-3 rounded-md border border-destructive bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            <strong className="text-destructive">Neraca tidak seimbang.</strong> Aset{' '}
            {formatRupiah(n.totalAset)} tidak sama dengan Liabilitas ditambah Ekuitas{' '}
            {formatRupiah(String(Number(n.totalLiabilitas) + Number(n.totalEkuitas)))}, selisih{' '}
            {formatRupiah(n.selisih)}. Ini menandakan data jurnal rusak dan perlu diperiksa.
          </span>
        </p>
      )}
    </>
  )
}
