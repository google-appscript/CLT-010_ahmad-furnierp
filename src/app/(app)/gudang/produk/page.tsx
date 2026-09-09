import { asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { products, productCategories, uoms } from '@/db/schema'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Produk' }

const LABEL_TIPE: Record<string, string> = {
  disimpan: 'Disimpan', jasa: 'Jasa', konsumsi: 'Konsumsi',
}

export default async function HalamanProduk() {
  await wajibIzin('gudang.produk.lihat')

  const daftar = await db
    .select({
      id: products.id,
      kode: products.kode,
      nama: products.nama,
      tipe: products.tipe,
      namaKategori: productCategories.nama,
      namaUom: uoms.nama,
      hargaJual: products.hargaJual,
      hargaPokokRataRata: products.hargaPokokRataRata,
      isActive: products.isActive,
    })
    .from(products)
    .innerJoin(productCategories, eq(productCategories.id, products.kategoriId))
    .innerJoin(uoms, eq(uoms.id, products.uomId))
    .orderBy(asc(products.kode))

  return (
    <>
      <KepalaHalaman
        judul="Produk"
        deskripsi="Harga pokok rata-rata diperbarui otomatis setiap kali barang diterima."
      />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kode</th>
              <th className="px-4 py-2 text-left font-medium">Nama</th>
              <th className="px-4 py-2 text-left font-medium">Kategori</th>
              <th className="px-4 py-2 text-left font-medium">Satuan</th>
              <th className="px-4 py-2 text-left font-medium">Tipe</th>
              <th className="px-4 py-2 text-right font-medium">Harga Jual</th>
              <th className="px-4 py-2 text-right font-medium">Harga Pokok</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {daftar.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  Belum ada produk. Jalankan seed data awal untuk memuat produk contoh.
                </td>
              </tr>
            )}
            {daftar.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="px-4 py-1.5 font-mono text-xs">{p.kode}</td>
                <td className="px-4 py-1.5">{p.nama}</td>
                <td className="px-4 py-1.5">{p.namaKategori}</td>
                <td className="px-4 py-1.5">{p.namaUom}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{LABEL_TIPE[p.tipe]}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(p.hargaJual)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(p.hargaPokokRataRata, 2)}
                </td>
                <td className="px-4 py-1.5">
                  <Badge variant={p.isActive ? 'secondary' : 'outline'}>
                    {p.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
