import { asc } from 'drizzle-orm'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { accounts } from '@/db/schema'
import { daftarKategoriProduk } from '@/modules/gudang/layanan/kategori'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DialogKategoriProduk, TombolStatusKategoriProduk } from './dialog-kategori'

export const metadata = { title: 'Kategori Produk' }

export default async function HalamanKategoriProduk() {
  await wajibIzin('gudang.kategori.kelola')

  const [kategori, semuaAkun] = await Promise.all([
    daftarKategoriProduk(),
    db.select({
      id: accounts.id, kode: accounts.kode, nama: accounts.nama, tipeAkun: accounts.tipeAkun,
      isActive: accounts.isActive,
    }).from(accounts).orderBy(asc(accounts.kode)),
  ])
  const akunAktif = semuaAkun.filter((a) => a.isActive)
  const akunLewatId = new Map(semuaAkun.map((a) => [a.id, `${a.kode} — ${a.nama}`]))

  return (
    <>
      <KepalaHalaman
        judul="Kategori Produk"
        deskripsi="Kategori menentukan akun yang dipakai saat pergerakan stok memposting jurnal, sehingga produk baru tidak perlu dikonfigurasi satu per satu."
        aksi={
          <DialogKategoriProduk
            akun={akunAktif}
            pemicu={
              <Button><Plus className="mr-2 h-4 w-4" />Tambah Kategori</Button>
            }
          />
        }
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
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="w-52 px-4 py-2" />
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
                <td className="px-4 py-1.5">
                  <Badge variant={k.isActive ? 'default' : 'outline'}>
                    {k.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </td>
                <td className="px-4 py-1.5 text-right">
                  <DialogKategoriProduk
                    kategori={{
                      id: k.id, kode: k.kode, nama: k.nama,
                      akunPersediaanId: k.akunPersediaanId, akunHppId: k.akunHppId,
                      akunSelisihId: k.akunSelisihId, akunBarangRusakId: k.akunBarangRusakId,
                    }}
                    akun={akunAktif}
                    pemicu={<Button variant="ghost" size="sm">Ubah</Button>}
                  />
                  <TombolStatusKategoriProduk id={k.id} isActive={k.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
