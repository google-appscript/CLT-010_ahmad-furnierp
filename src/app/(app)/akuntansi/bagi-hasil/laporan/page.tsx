import { wajibIzin } from '@/lib/sesi'
import { ringkasanPemilik } from '@/modules/kepemilikan/layanan/bagi-hasil'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Transparansi Bagi Hasil' }

export default async function HalamanTransparansi() {
  await wajibIzin('akuntansi.bagi-hasil.lihat')

  const baris = await ringkasanPemilik()

  const total = baris.reduce(
    (t, b) => ({
      bagiHasil: t.bagiHasil + Number(b.totalBagiHasil),
      modal: t.modal + Number(b.saldoModal),
      prive: t.prive + Number(b.totalPrive),
      sisa: t.sisa + Number(b.sisaHak),
    }),
    { bagiHasil: 0, modal: 0, prive: 0, sisa: 0 },
  )

  return (
    <>
      <KepalaHalaman
        judul="Transparansi Bagi Hasil"
        deskripsi="Hak tiap pemilik dibaca langsung dari buku besar — bukan dari catatan tersendiri — sehingga tidak mungkin berselisih dengan neraca."
      />

      {baris.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Belum ada pemilik terdaftar.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Pemilik</th>
                <th className="px-4 py-2 text-right font-medium">Bagi Hasil Diterima</th>
                <th className="px-4 py-2 text-right font-medium">Saldo Modal</th>
                <th className="px-4 py-2 text-right font-medium">Sudah Ditarik</th>
                <th className="px-4 py-2 text-right font-medium">Sisa Hak</th>
                <th className="px-4 py-2 text-right font-medium">Porsi Sisa</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => {
                const porsi = total.sisa === 0 ? null : (Number(b.sisaHak) / total.sisa) * 100
                return (
                  <tr key={b.ownerId} className="border-b">
                    <td className="px-4 py-1.5">
                      <span className="font-mono text-xs">{b.kode}</span>
                      <span className="ml-2">{b.nama}</span>
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(b.totalBagiHasil)}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(b.saldoModal)}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(b.totalPrive)}
                    </td>
                    <td className={`px-4 py-1.5 text-right font-medium tabular-nums ${
                      Number(b.sisaHak) < 0 ? 'text-destructive' : ''
                    }`}>
                      {formatAngka(b.sisaHak)}
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
                  {formatAngka(total.bagiHasil.toFixed(2))}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(total.modal.toFixed(2))}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(total.prive.toFixed(2))}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(total.sisa.toFixed(2))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="mt-3 text-sm text-muted-foreground">
        <span className="font-medium">Bagi Hasil Diterima</span> adalah akumulasi porsi laba
        dari periode yang sudah dikunci. <span className="font-medium">Saldo Modal</span>{' '}
        mencakup itu ditambah setoran modal awal, dan{' '}
        <span className="font-medium">Sisa Hak</span> adalah bagian yang masih tertinggal di
        perusahaan setelah dikurangi penarikan pribadi.
      </p>
    </>
  )
}
