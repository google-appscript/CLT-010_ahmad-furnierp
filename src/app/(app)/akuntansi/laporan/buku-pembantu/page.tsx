import { wajibIzin } from '@/lib/sesi'
import { saldoPerPartner } from '@/modules/akuntansi/layanan/laporan'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { periodeBawaan, tanggalPanjang } from '../periode'

export const metadata = { title: 'Buku Besar Pembantu' }

export default async function HalamanBukuPembantu({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.laporan.buku-pembantu')
  const { dari, sampai } = periodeBawaan(await searchParams)

  const [piutang, utang] = await Promise.all([
    saldoPerPartner(['aset_piutang'], sampai),
    saldoPerPartner(['liabilitas_utang_usaha'], sampai),
  ])

  return (
    <>
      <KepalaHalaman
        judul="Buku Besar Pembantu"
        deskripsi={`Saldo piutang dan utang per mitra usaha, per ${tanggalPanjang(sampai)}`}
      />
      <PenyaringPeriode dari={dari} sampai={sampai} hanyaSampai />

      <div className="grid gap-6 lg:grid-cols-2">
        <Bagian judul="Piutang Usaha" baris={piutang} balikTanda={false} />
        <Bagian judul="Utang Usaha" baris={utang} balikTanda />
      </div>
    </>
  )
}

function Bagian({
  judul, baris, balikTanda,
}: {
  judul: string
  baris: { partnerId: string; kode: string; nama: string; saldo: string }[]
  balikTanda: boolean
}) {
  const total = baris.reduce((t, b) => t + Number(b.saldo), 0)

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">{judul}</h2>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kode</th>
              <th className="px-4 py-2 text-left font-medium">Mitra Usaha</th>
              <th className="px-4 py-2 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {baris.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                  Belum ada saldo.
                </td>
              </tr>
            )}
            {baris.map((b) => (
              <tr key={b.partnerId} className="border-b">
                <td className="px-4 py-1.5 font-mono text-xs">{b.kode}</td>
                <td className="px-4 py-1.5">{b.nama}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(balikTanda ? String(-Number(b.saldo)) : b.saldo)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/40 font-semibold">
            <tr>
              <td colSpan={2} className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatAngka((balikTanda ? -total : total).toFixed(2))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
