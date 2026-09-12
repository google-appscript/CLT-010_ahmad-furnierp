import Link from 'next/link'
import { asc, eq } from 'drizzle-orm'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { products, productCategories, uoms } from '@/db/schema'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { LABEL_TIPE_PRODUK } from '@/modules/gudang/validasi/produk'
import { DialogProduk, TombolStatusProduk } from './dialog-produk'

export const metadata = { title: 'Produk' }

export default async function HalamanProduk() {
  await wajibIzin('gudang.produk.kelola')

  const [daftar, kategori, uom] = await Promise.all([
    db
      .select({
        id: products.id,
        kode: products.kode,
        nama: products.nama,
        tipe: products.tipe,
        kategoriId: products.kategoriId,
        uomId: products.uomId,
        namaKategori: productCategories.nama,
        namaUom: uoms.nama,
        barcode: products.barcode,
        hargaJual: products.hargaJual,
        hargaPokokRataRata: products.hargaPokokRataRata,
        catatan: products.catatan,
        isActive: products.isActive,
      })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.kategoriId))
      .innerJoin(uoms, eq(uoms.id, products.uomId))
      .orderBy(asc(products.kode)),
    db.select({ id: productCategories.id, kode: productCategories.kode, nama: productCategories.nama })
      .from(productCategories).where(eq(productCategories.isActive, true))
      .orderBy(asc(productCategories.kode)),
    db.select({ id: uoms.id, kode: uoms.kode, nama: uoms.nama })
      .from(uoms).where(eq(uoms.isActive, true)).orderBy(asc(uoms.kode)),
  ])

  return (
    <>
      <KepalaHalaman
        judul="Produk"
        deskripsi="Harga pokok rata-rata diperbarui otomatis setiap kali barang diterima."
        aksi={<DialogProduk kategori={kategori} uom={uom} pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Produk</Button>} />}
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
              <th className="w-40 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {daftar.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  Belum ada produk. Jalankan seed data awal atau tambahkan produk secara manual.
                </td>
              </tr>
            )}
            {daftar.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="px-4 py-1.5 font-mono text-xs">{p.kode}</td>
                <td className="px-4 py-1.5">{p.nama}</td>
                <td className="px-4 py-1.5">{p.namaKategori}</td>
                <td className="px-4 py-1.5">{p.namaUom}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{LABEL_TIPE_PRODUK[p.tipe]}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(p.hargaJual)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(p.hargaPokokRataRata, 2)}
                </td>
                <td className="px-4 py-1.5">
                  <Badge variant={p.isActive ? 'secondary' : 'outline'}>
                    {p.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </td>
                <td className="px-4 py-1.5 text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/gudang/laporan/kartu-stok?produk=${p.id}`}>Kartu Stok</Link>
                  </Button>
                  <DialogProduk
                    produk={p}
                    kategori={kategori}
                    uom={uom}
                    pemicu={<Button variant="ghost" size="sm">Ubah</Button>}
                  />
                  <TombolStatusProduk id={p.id} isActive={p.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
