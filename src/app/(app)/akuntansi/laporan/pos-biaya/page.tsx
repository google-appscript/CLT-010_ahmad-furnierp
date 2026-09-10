import { wajibIzin } from '@/lib/sesi'
import { labaRugiPerPos } from '@/modules/akuntansi/layanan/pos-biaya'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { periodeBawaan, tanggalPanjang } from '@/app/(app)/akuntansi/laporan/periode'

export const metadata = { title: 'Laba Rugi per Pos Biaya' }

export default async function HalamanLabaRugiPos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.laporan.pos-biaya')
  const { dari, sampai } = periodeBawaan(await searchParams)

  const baris = await labaRugiPerPos(dari, sampai)

  const total = baris.reduce(
    (t, b) => ({
      pendapatan: t.pendapatan + Number(b.pendapatan),
      beban: t.beban + Number(b.beban),
      laba: t.laba + Number(b.laba),
    }),
    { pendapatan: 0, beban: 0, laba: 0 },
  )

  const belumDialokasi = baris.find((b) => b.costCenterId === null)

  return (
    <>
      <KepalaHalaman
        judul="Laba Rugi per Pos Biaya"
        deskripsi={`Periode ${tanggalPanjang(dari)} sampai ${tanggalPanjang(sampai)}. Satu pengeluaran dapat dibagi ke beberapa pos; yang ditampilkan di sini adalah bagian masing-masing.`}
      />
      <PenyaringPeriode dari={dari} sampai={sampai} />

      {baris.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Belum ada transaksi laba rugi pada periode ini.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Pos Biaya</th>
                <th className="px-4 py-2 text-right font-medium">Pendapatan</th>
                <th className="px-4 py-2 text-right font-medium">Beban</th>
                <th className="px-4 py-2 text-right font-medium">Laba</th>
                <th className="px-4 py-2 text-right font-medium">Porsi Beban</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => {
                const porsi = total.beban === 0 ? null : (Number(b.beban) / total.beban) * 100
                const tanpaPos = b.costCenterId === null
                return (
                  <tr key={b.costCenterId ?? 'tanpa-pos'} className="border-b">
                    <td className="px-4 py-1.5">
                      {tanpaPos ? (
                        <span className="text-muted-foreground">{b.nama}</span>
                      ) : (
                        <>
                          <span className="font-mono text-xs">{b.kode}</span>
                          <span className="ml-2">{b.nama}</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(b.pendapatan)}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(b.beban)}
                    </td>
                    <td className={`px-4 py-1.5 text-right font-medium tabular-nums ${
                      Number(b.laba) < 0 ? 'text-destructive' : ''
                    }`}>
                      {formatAngka(b.laba)}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">
                      {porsi === null ? '—' : `${porsi.toFixed(1)}%`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 bg-muted/40 font-semibold">
              <tr>
                <td className="px-4 py-2 text-right">Total</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(total.pendapatan.toFixed(2))}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(total.beban.toFixed(2))}
                </td>
                <td className={`px-4 py-2 text-right tabular-nums ${
                  total.laba < 0 ? 'text-destructive' : ''
                }`}>
                  {formatAngka(total.laba.toFixed(2))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="mt-3 text-sm text-muted-foreground">
        Baris <span className="font-medium">Belum dialokasikan</span> memuat transaksi laba rugi
        yang belum ditandai ke pos mana pun. Angka itu sengaja dibiarkan terlihat alih-alih
        dibagi rata: ia menandakan pekerjaan pencatatan yang belum dilakukan, bukan biaya yang
        benar-benar tersebar.
        {belumDialokasi && Number(belumDialokasi.beban) > 0 && (
          <span className="ml-1 font-medium text-destructive">
            Saat ini {formatAngka(belumDialokasi.beban)} beban belum berpos.
          </span>
        )}
      </p>

      <p className="mt-2 text-sm text-muted-foreground">
        Jumlah seluruh baris di sini selalu sama dengan Laba Rugi keseluruhan pada periode yang
        sama — pembagian ke pos tidak pernah menciptakan atau menghilangkan nilai.
      </p>
    </>
  )
}
