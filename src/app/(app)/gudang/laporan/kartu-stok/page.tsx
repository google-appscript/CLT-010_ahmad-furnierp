import { asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { products } from '@/db/schema'
import { kartuStok, stokProdukPerLokasi } from '@/modules/gudang/repositori/stok'
import { labelTipeOperasi } from '@/modules/gudang/validasi/operasi'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { periodeBawaan, tanggalPanjang } from '@/app/(app)/akuntansi/laporan/periode'
import { PilihProduk } from './pilih-produk'

export const metadata = { title: 'Kartu Stok' }

export default async function HalamanKartuStok({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('gudang.laporan.kartu-stok')
  const params = await searchParams
  const { dari, sampai } = periodeBawaan(params)
  const produkId = Array.isArray(params.produk) ? params.produk[0] : params.produk

  const daftarProduk = await db
    .select({ id: products.id, kode: products.kode, nama: products.nama })
    .from(products).where(eq(products.tipe, 'disimpan')).orderBy(asc(products.kode))

  const terpilih = daftarProduk.find((p) => p.id === produkId)
  const [baris, perLokasi] = terpilih
    ? await Promise.all([
        kartuStok(terpilih.id, dari, sampai),
        stokProdukPerLokasi(terpilih.id),
      ])
    : [[], []]

  // Saldo berjalan dihitung di muka agar tidak ada mutasi variabel saat render.
  const denganSaldo = baris.reduce<{ b: typeof baris[number]; saldo: string }[]>((hasil, b) => {
    const sebelumnya = hasil.length === 0 ? 0 : Number(hasil[hasil.length - 1].saldo)
    const saldo = (sebelumnya + Number(b.masuk) - Number(b.keluar)).toFixed(6)
    return [...hasil, { b, saldo }]
  }, [])

  return (
    <>
      <KepalaHalaman
        judul="Kartu Stok"
        deskripsi={`Riwayat pergerakan ${tanggalPanjang(dari)} sampai ${tanggalPanjang(sampai)}`}
      />
      <PenyaringPeriode dari={dari} sampai={sampai} />
      <PilihProduk produk={daftarProduk} terpilih={produkId} />

      {!terpilih ? (
        <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Pilih produk terlebih dahulu untuk menampilkan kartu stoknya.
        </p>
      ) : (
        <>
          {perLokasi.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {perLokasi.map((l) => (
                <span key={l.lokasiId} className="rounded-md border px-3 py-1.5 text-sm">
                  {l.namaLokasi}: <span className="tabular-nums">{formatAngka(l.stok, 2)}</span>
                </span>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                  <th className="px-4 py-2 text-left font-medium">Dokumen</th>
                  <th className="px-4 py-2 text-left font-medium">Operasi</th>
                  <th className="px-4 py-2 text-left font-medium">Dari</th>
                  <th className="px-4 py-2 text-left font-medium">Ke</th>
                  <th className="px-4 py-2 text-right font-medium">Masuk</th>
                  <th className="px-4 py-2 text-right font-medium">Keluar</th>
                  <th className="px-4 py-2 text-right font-medium">Saldo</th>
                  <th className="px-4 py-2 text-right font-medium">Harga Pokok</th>
                  <th className="px-4 py-2 text-right font-medium">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {denganSaldo.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                      Belum ada pergerakan pada periode yang dipilih.
                    </td>
                  </tr>
                )}
                {denganSaldo.map(({ b, saldo }) => (
                  <tr key={b.moveId} className="border-b">
                    <td className="px-4 py-1.5">{b.tanggal}</td>
                    <td className="px-4 py-1.5 font-mono text-xs">{b.nomorOperasi ?? '—'}</td>
                    <td className="px-4 py-1.5 text-muted-foreground">
                      {b.tipeOperasi ? labelTipeOperasi(b.tipeOperasi) : '—'}
                    </td>
                    <td className="px-4 py-1.5 text-muted-foreground">{b.namaAsal}</td>
                    <td className="px-4 py-1.5 text-muted-foreground">{b.namaTujuan}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {Number(b.masuk) === 0 ? '—' : formatAngka(b.masuk, 2)}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {Number(b.keluar) === 0 ? '—' : formatAngka(b.keluar, 2)}
                    </td>
                    <td className="px-4 py-1.5 text-right font-medium tabular-nums">
                      {formatAngka(saldo, 2)}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(b.hargaPokokSatuan, 2)}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(b.nilaiTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Kolom saldo dihitung dari nol pada awal periode; transfer antar lokasi internal
            tidak mengubahnya karena tidak menambah maupun mengurangi stok perusahaan.
          </p>
        </>
      )}
    </>
  )
}
