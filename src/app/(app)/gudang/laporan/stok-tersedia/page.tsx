import { wajibIzin } from '@/lib/sesi'
import { stokSeluruhProduk } from '@/modules/gudang/repositori/stok'
import { formatAngka, formatRupiah } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Stok Tersedia' }

export default async function HalamanStokTersedia() {
  await wajibIzin('gudang.laporan.stok')
  const stok = await stokSeluruhProduk()
  const total = stok.reduce((t, s) => t + Number(s.nilai), 0).toFixed(2)

  return (
    <>
      <KepalaHalaman
        judul="Stok Tersedia"
        deskripsi="Dihitung dari riwayat pergerakan, bukan angka yang disimpan terpisah, sehingga tidak pernah menyimpang dari kartu stok."
      />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kode</th>
              <th className="px-4 py-2 text-left font-medium">Produk</th>
              <th className="px-4 py-2 text-left font-medium">Satuan</th>
              <th className="px-4 py-2 text-right font-medium">Stok</th>
              <th className="px-4 py-2 text-right font-medium">Harga Pokok</th>
              <th className="px-4 py-2 text-right font-medium">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {stok.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  Belum ada produk yang disimpan.
                </td>
              </tr>
            )}
            {stok.map((s) => (
              <tr key={s.produkId} className="border-b">
                <td className="px-4 py-1.5 font-mono text-xs">{s.kode}</td>
                <td className="px-4 py-1.5">{s.nama}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{s.namaUom}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(s.stok, 2)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(s.hargaPokokRataRata, 2)}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(s.nilai)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/40 font-semibold">
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right">Total Nilai Persediaan</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatAngka(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Total nilai persediaan {formatRupiah(total)} harus sama dengan saldo akun persediaan
        pada Neraca.
      </p>
    </>
  )
}
