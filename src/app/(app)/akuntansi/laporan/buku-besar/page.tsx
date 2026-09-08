import { wajibIzin } from '@/lib/sesi'
import { itemPerAkun } from '@/modules/akuntansi/layanan/laporan'
import { daftarAkun } from '@/modules/akuntansi/layanan/akun'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { PilihAkun } from './pilih-akun'
import { periodeBawaan, tanggalPanjang } from '../periode'

export const metadata = { title: 'Buku Besar' }

export default async function HalamanBukuBesar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.laporan.buku-besar')
  const params = await searchParams
  const { dari, sampai } = periodeBawaan(params)
  const akunId = Array.isArray(params.akun) ? params.akun[0] : params.akun

  const akun = await daftarAkun()
  const terpilih = akun.find((a) => a.id === akunId)
  const item = terpilih ? await itemPerAkun(terpilih.id, dari, sampai) : []

  // Saldo berjalan dihitung sekali di muka, bukan saat render, agar tidak ada
  // mutasi variabel di dalam JSX. Dimulai dari nol; saldo awal periode
  // ditampilkan di Neraca Saldo.
  const denganSaldo = item.reduce<{ baris: typeof item[number]; berjalan: string }[]>(
    (hasil, b) => {
      const sebelumnya = hasil.length === 0 ? 0 : Number(hasil[hasil.length - 1].berjalan)
      const berjalan = (sebelumnya + Number(b.debit) - Number(b.kredit)).toFixed(2)
      return [...hasil, { baris: b, berjalan }]
    },
    [],
  )

  return (
    <>
      <KepalaHalaman
        judul="Buku Besar"
        deskripsi={`Periode ${tanggalPanjang(dari)} sampai ${tanggalPanjang(sampai)}`}
      />
      <PenyaringPeriode dari={dari} sampai={sampai} />
      <PilihAkun
        akun={akun.map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }))}
        terpilih={akunId}
      />

      {!terpilih ? (
        <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Pilih akun terlebih dahulu untuk menampilkan buku besarnya.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left font-medium">Nomor</th>
                <th className="px-4 py-2 text-left font-medium">Jurnal</th>
                <th className="px-4 py-2 text-left font-medium">Keterangan</th>
                <th className="px-4 py-2 text-left font-medium">Mitra</th>
                <th className="px-4 py-2 text-right font-medium">Debit</th>
                <th className="px-4 py-2 text-right font-medium">Kredit</th>
                <th className="px-4 py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {denganSaldo.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Belum ada mutasi pada akun ini dalam periode yang dipilih.
                  </td>
                </tr>
              )}
              {denganSaldo.map(({ baris: b, berjalan }, i) => (
                <tr key={`${b.entryId}-${i}`} className="border-b">
                  <td className="px-4 py-1.5">{b.tanggal}</td>
                  <td className="px-4 py-1.5 font-mono text-xs">{b.nomor}</td>
                  <td className="px-4 py-1.5">{b.jurnalKode}</td>
                  <td className="px-4 py-1.5">{b.label}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">{b.namaPartner ?? '—'}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.debit)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.kredit)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(berjalan)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
