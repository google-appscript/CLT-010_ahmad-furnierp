import { wajibIzin } from '@/lib/sesi'
import { laporanNeracaSaldo } from '@/modules/akuntansi/layanan/laporan'
import { labelTipeAkun } from '@/modules/akuntansi/validasi/akun'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { periodeBawaan, tanggalPanjang } from '../periode'

export const metadata = { title: 'Neraca Saldo' }

export default async function HalamanNeracaSaldo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.laporan.neraca-saldo')
  const { dari, sampai } = periodeBawaan(await searchParams)
  const ns = await laporanNeracaSaldo(dari, sampai)

  return (
    <>
      <KepalaHalaman
        judul="Neraca Saldo"
        deskripsi={`Periode ${tanggalPanjang(dari)} sampai ${tanggalPanjang(sampai)}`}
      />
      <PenyaringPeriode dari={dari} sampai={sampai} />

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kode</th>
              <th className="px-4 py-2 text-left font-medium">Nama Akun</th>
              <th className="px-4 py-2 text-left font-medium">Tipe</th>
              <th className="px-4 py-2 text-right font-medium">Saldo Awal</th>
              <th className="px-4 py-2 text-right font-medium">Mutasi Debit</th>
              <th className="px-4 py-2 text-right font-medium">Mutasi Kredit</th>
              <th className="px-4 py-2 text-right font-medium">Saldo Akhir</th>
            </tr>
          </thead>
          <tbody>
            {ns.baris.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  Belum ada mutasi pada periode ini.
                </td>
              </tr>
            )}
            {ns.baris.map((b) => (
              <tr key={b.akunId} className="border-b">
                <td className="px-4 py-1.5 font-mono text-xs">{b.kode}</td>
                <td className="px-4 py-1.5">{b.nama}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{labelTipeAkun(b.tipeAkun)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.saldoAwal)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.debit)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.kredit)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.saldoAkhir)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/40 font-semibold">
            <tr>
              <td colSpan={4} className="px-4 py-2">Total Mutasi</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatAngka(ns.totalDebit)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatAngka(ns.totalKredit)}</td>
              <td className="px-4 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {ns.seimbang
          ? 'Total debit sama dengan total kredit. Pembukuan seimbang.'
          : 'Total debit tidak sama dengan total kredit. Data jurnal perlu diperiksa.'}
      </p>
    </>
  )
}
