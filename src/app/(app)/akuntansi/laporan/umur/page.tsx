import { wajibIzin } from '@/lib/sesi'
import { umurPerPartner, type BarisUmur } from '@/modules/akuntansi/layanan/laporan'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { periodeBawaan, tanggalPanjang } from '../periode'

export const metadata = { title: 'Umur Piutang & Utang' }

const EMBER = ['0-30', '31-60', '61-90', '90+'] as const

export default async function HalamanUmur({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.laporan.umur')
  const { dari, sampai } = periodeBawaan(await searchParams)

  const [piutang, utang] = await Promise.all([
    umurPerPartner(['aset_piutang'], sampai),
    umurPerPartner(['liabilitas_utang_usaha'], sampai),
  ])

  return (
    <>
      <KepalaHalaman
        judul="Umur Piutang & Utang"
        deskripsi={`Dihitung dari tanggal entri jurnal, per ${tanggalPanjang(sampai)}`}
      />
      <PenyaringPeriode dari={dari} sampai={sampai} hanyaSampai />

      <div className="space-y-8">
        <Tabel judul="Umur Piutang" baris={piutang} balikTanda={false} />
        <Tabel judul="Umur Utang" baris={utang} balikTanda />
      </div>
    </>
  )
}

function Tabel({
  judul, baris, balikTanda,
}: {
  judul: string
  baris: BarisUmur[]
  balikTanda: boolean
}) {
  const tanda = (v: string) => formatAngka(balikTanda ? String(-Number(v)) : v)

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">{judul}</h2>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Mitra Usaha</th>
              <th className="px-4 py-2 text-right font-medium">0–30 hari</th>
              <th className="px-4 py-2 text-right font-medium">31–60 hari</th>
              <th className="px-4 py-2 text-right font-medium">61–90 hari</th>
              <th className="px-4 py-2 text-right font-medium">Di atas 90 hari</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {baris.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  Belum ada saldo.
                </td>
              </tr>
            )}
            {baris.map((b) => (
              <tr key={b.partnerId} className="border-b">
                <td className="px-4 py-1.5">
                  <span className="font-mono text-xs">{b.kode}</span> {b.nama}
                </td>
                {EMBER.map((e) => (
                  <td key={e} className="px-4 py-1.5 text-right tabular-nums">
                    {tanda(b.ember[e])}
                  </td>
                ))}
                <td className="px-4 py-1.5 text-right font-medium tabular-nums">
                  {tanda(b.saldo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
