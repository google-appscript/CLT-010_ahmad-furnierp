import Link from 'next/link'
import { wajibIzin } from '@/lib/sesi'
import { daftarJadwal } from '@/modules/aset/layanan/depresiasi'
import { formatAngka, bulatkan, tambah } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelPostingBerkala } from './panel-berkala'

export const metadata = { title: 'Jadwal Depresiasi' }

export default async function HalamanJadwalDepresiasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.depresiasi.lihat')
  const params = await searchParams
  const diminta = Array.isArray(params.sampai) ? params.sampai[0] : params.sampai

  // Bawaannya akhir bulan berjalan — itu yang biasanya dibebankan saat tutup
  // buku bulanan.
  const kini = new Date()
  const akhirBulanIni = new Date(Date.UTC(kini.getUTCFullYear(), kini.getUTCMonth() + 1, 0))
    .toISOString().slice(0, 10)
  const sampai = diminta ?? akhirBulanIni

  const [jatuhTempo, seluruhJadwal] = await Promise.all([
    daftarJadwal({ status: 'draft', sampaiTanggal: sampai }),
    daftarJadwal({}),
  ])

  const totalJatuhTempo = jatuhTempo.length > 0
    ? bulatkan(tambah(...jatuhTempo.map((b) => b.nilai)), 2)
    : '0.00'

  // Yang ditampilkan: seluruh yang sudah jatuh tempo ditambah beberapa bulan
  // ke depan, agar rencana terdekat ikut terlihat tanpa memuat seluruh jadwal.
  const tampil = seluruhJadwal
    .filter((b) => b.status === 'diposting' || b.tanggal <= sampai)
    .concat(seluruhJadwal.filter((b) => b.status === 'draft' && b.tanggal > sampai).slice(0, 20))

  return (
    <>
      <KepalaHalaman
        judul="Jadwal Depresiasi"
        deskripsi="Beban depresiasi seluruh aset, bulan demi bulan. Posting berkala membebankan semua yang sudah jatuh tempo sekaligus dalam satu transaksi."
      />

      <PanelPostingBerkala
        sampaiTanggal={sampai}
        jumlahJatuhTempo={jatuhTempo.length}
        totalJatuhTempo={totalJatuhTempo}
      />

      {tampil.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Belum ada aset yang dijalankan, jadi belum ada jadwal depresiasi.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left font-medium">Aset</th>
                <th className="px-4 py-2 text-right font-medium">Bulan Ke</th>
                <th className="px-4 py-2 text-right font-medium">Beban</th>
                <th className="px-4 py-2 text-right font-medium">Akumulasi</th>
                <th className="px-4 py-2 text-right font-medium">Nilai Buku</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((b) => (
                <tr
                  key={b.id}
                  className={`border-b ${
                    b.status === 'draft' && b.tanggal <= sampai ? 'bg-muted/30' : ''
                  }`}
                >
                  <td className="px-4 py-1.5">{b.tanggal}</td>
                  <td className="px-4 py-1.5">
                    <Link href={`/akuntansi/aset/${b.asetId}`} className="underline">
                      {b.kodeAset}
                    </Link>
                    <span className="ml-2 text-muted-foreground">{b.namaAset}</span>
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{b.urutan}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.nilai)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(b.akumulasi)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(b.nilaiBuku)}
                  </td>
                  <td className="px-4 py-1.5">
                    <Badge variant={b.status === 'diposting' ? 'default' : 'secondary'}>
                      {b.status === 'diposting'
                        ? 'Diposting'
                        : b.tanggal <= sampai ? 'Jatuh Tempo' : 'Rencana'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
