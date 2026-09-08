import { wajibIzin } from '@/lib/sesi'
import { laporanLabaRugi } from '@/modules/akuntansi/layanan/laporan'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { TabelLaporan } from '@/components/laporan/tabel-laporan'
import { periodeBawaan, tanggalPanjang } from '../periode'

export const metadata = { title: 'Laba Rugi' }

export default async function HalamanLabaRugi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.laporan.laba-rugi')
  const { dari, sampai } = periodeBawaan(await searchParams)
  const laporan = await laporanLabaRugi(dari, sampai)

  return (
    <>
      <KepalaHalaman
        judul="Laporan Laba Rugi"
        deskripsi={`Periode ${tanggalPanjang(dari)} sampai ${tanggalPanjang(sampai)}`}
      />
      <PenyaringPeriode dari={dari} sampai={sampai} />
      <TabelLaporan baris={laporan.baris} />
    </>
  )
}
