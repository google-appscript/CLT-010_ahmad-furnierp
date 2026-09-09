import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { productCategories, accounts } from '@/db/schema'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Kategori Produk' }

export default async function HalamanKategoriProduk() {
  await wajibIzin('gudang.kategori.kelola')

  const [kategori, semuaAkun] = await Promise.all([
    db.select().from(productCategories).orderBy(asc(productCategories.kode)),
    db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama }).from(accounts),
  ])
  const akunLewatId = new Map(semuaAkun.map((a) => [a.id, `${a.kode} — ${a.nama}`]))

  return (
    <>
      <KepalaHalaman
        judul="Kategori Produk"
        deskripsi="Kategori menentukan akun yang dipakai saat pergerakan stok memposting jurnal, sehingga produk baru tidak perlu dikonfigurasi satu per satu."
      />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kode</th>
              <th className="px-4 py-2 text-left font-medium">Nama</th>
              <th className="px-4 py-2 text-left font-medium">Akun Persediaan</th>
              <th className="px-4 py-2 text-left font-medium">Akun HPP</th>
              <th className="px-4 py-2 text-left font-medium">Akun Selisih Opname</th>
              <th className="px-4 py-2 text-left font-medium">Akun Barang Rusak</th>
            </tr>
          </thead>
          <tbody>
            {kategori.map((k) => (
              <tr key={k.id} className="border-b">
                <td className="px-4 py-1.5 font-mono text-xs">{k.kode}</td>
                <td className="px-4 py-1.5">{k.nama}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{akunLewatId.get(k.akunPersediaanId)}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{akunLewatId.get(k.akunHppId)}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{akunLewatId.get(k.akunSelisihId)}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{akunLewatId.get(k.akunBarangRusakId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
