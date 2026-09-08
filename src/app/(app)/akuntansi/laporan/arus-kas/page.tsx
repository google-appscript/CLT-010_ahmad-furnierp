import { AlertTriangle } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { laporanArusKas } from '@/modules/akuntansi/layanan/laporan'
import { formatRupiah } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { TabelLaporan } from '@/components/laporan/tabel-laporan'
import { periodeBawaan, tanggalPanjang } from '../periode'

export const metadata = { title: 'Arus Kas' }

export default async function HalamanArusKas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.laporan.arus-kas')
  const { dari, sampai } = periodeBawaan(await searchParams)
  const ak = await laporanArusKas(dari, sampai)

  const penutup = [
    { label: 'Kenaikan (Penurunan) Kas Bersih', nilai: ak.kenaikanKas, tegas: true },
    { label: 'Kas dan Setara Kas Awal Periode', nilai: ak.kasAwal },
    { label: 'Kas dan Setara Kas Akhir Periode', nilai: ak.kasAkhir, tegas: true },
  ]

  return (
    <>
      <KepalaHalaman
        judul="Laporan Arus Kas"
        deskripsi={`Metode tidak langsung · ${tanggalPanjang(dari)} sampai ${tanggalPanjang(sampai)}`}
      />
      <PenyaringPeriode dari={dari} sampai={sampai} />

      <div className="space-y-6">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Arus Kas dari Aktivitas Operasi
          </h2>
          <TabelLaporan baris={ak.operasi} rincian={false} />
        </section>
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Arus Kas dari Aktivitas Investasi
          </h2>
          <TabelLaporan baris={ak.investasi} rincian={false} />
        </section>
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Arus Kas dari Aktivitas Pendanaan
          </h2>
          <TabelLaporan baris={ak.pendanaan} rincian={false} />
        </section>
        <section>
          <TabelLaporan baris={penutup} rincian={false} />
        </section>
      </div>

      {ak.cocok ? (
        <p className="mt-6 rounded-md border bg-muted/40 p-4 text-sm">
          Kas Akhir hasil perhitungan {formatRupiah(ak.kasAkhir)} cocok dengan saldo akun kas
          dan bank yang sesungguhnya.
        </p>
      ) : (
        <p className="mt-6 flex items-start gap-3 rounded-md border border-destructive bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            <strong className="text-destructive">Selisih Belum Teridentifikasi{' '}
            {formatRupiah(ak.selisihTakTeridentifikasi)}.</strong> Kas Akhir hasil perhitungan{' '}
            {formatRupiah(ak.kasAkhir)} tidak sama dengan saldo kas dan bank yang sesungguhnya{' '}
            {formatRupiah(ak.kasAkhirAktual)}. Angka di atas belum dapat dipercaya sepenuhnya.
          </span>
        </p>
      )}
    </>
  )
}
