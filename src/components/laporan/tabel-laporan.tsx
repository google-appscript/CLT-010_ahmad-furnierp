import { formatRupiah, type Uang } from '@/lib/uang'
import { cn } from '@/lib/utils'
import type { BarisLaporan } from '@/modules/akuntansi/layanan/laporan'

/**
 * Menyajikan baris laporan beserta rincian akunnya. Baris bertanda `tegas`
 * adalah baris ringkasan seperti Laba Kotor, dicetak tebal dan bergaris.
 */
export function TabelLaporan({
  baris, rincian = true,
}: {
  baris: BarisLaporan[]
  rincian?: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <tbody>
          {baris.map((b) => (
            <BlokBaris key={b.label} baris={b} rincian={rincian} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BlokBaris({ baris, rincian }: { baris: BarisLaporan; rincian: boolean }) {
  // Akun bersaldo nol disembunyikan; menampilkan seluruh bagan akun membuat
  // laporan panjang tanpa menambah informasi.
  const akunBersaldo = baris.akun?.filter((a) => Number(a.saldo) !== 0) ?? []
  const punyaRincian = rincian && akunBersaldo.length > 0

  return (
    <>
      {punyaRincian && akunBersaldo.map((a) => (
        <tr key={a.akunId} className="border-b text-muted-foreground">
          <td className="py-1.5 pl-10 pr-4">
            <span className="font-mono text-xs">{a.kode}</span> {a.nama}
          </td>
          <td className="w-56 py-1.5 pr-4 text-right tabular-nums">
            {formatRupiah(nilaiTampil(a.saldo, baris.label))}
          </td>
        </tr>
      ))}
      <tr className={cn('border-b', baris.tegas && 'border-t-2 bg-muted/40 font-semibold')}>
        <td className={cn('py-2 pr-4', baris.tegas ? 'pl-4' : 'pl-6')}>{baris.label}</td>
        <td className="w-56 py-2 pr-4 text-right tabular-nums">{formatRupiah(baris.nilai)}</td>
      </tr>
    </>
  )
}

/**
 * Saldo akun disimpan sebagai debit dikurangi kredit. Pada baris pendapatan,
 * liabilitas, dan ekuitas tandanya dibalik agar angkanya tampil positif
 * sebagaimana lazimnya laporan keuangan.
 */
function nilaiTampil(saldo: Uang, labelBaris: string): Uang {
  const dibalik = ['Pendapatan', 'Pendapatan Lain-lain', 'Liabilitas', 'Modal', 'Laba Ditahan']
  return dibalik.some((k) => labelBaris.startsWith(k)) ? String(-Number(saldo)) : saldo
}
