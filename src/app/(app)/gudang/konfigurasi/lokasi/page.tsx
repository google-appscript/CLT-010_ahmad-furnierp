import { asc } from 'drizzle-orm'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { locations, warehouses } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { LABEL_TIPE_LOKASI } from '@/modules/gudang/validasi/lokasi'
import { DialogWarehouse, TombolStatusWarehouse } from './dialog-gudang'
import { DialogLokasi, TombolStatusLokasi } from './dialog-lokasi'

export const metadata = { title: 'Gudang & Lokasi' }

export default async function HalamanLokasi() {
  await wajibIzin('gudang.lokasi.kelola')

  const [gudang, lokasi] = await Promise.all([
    db.select().from(warehouses).orderBy(asc(warehouses.kode)),
    db.select().from(locations).orderBy(asc(locations.tipe), asc(locations.kode)),
  ])
  const gudangLewatId = new Map(gudang.map((g) => [g.id, g.nama]))
  const gudangAktif = gudang.filter((g) => g.isActive)
  const pilihanLokasi = lokasi.map((l) => ({ id: l.id, kode: l.kode, nama: l.nama }))

  return (
    <>
      <KepalaHalaman
        judul="Gudang & Lokasi"
        deskripsi="Setiap pergerakan stok selalu antara dua lokasi. Lokasi virtual membuat penerimaan, pengiriman, barang rusak, dan stock opname memakai satu mekanisme yang sama."
      />

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Gudang</h2>
          <DialogWarehouse pemicu={<Button size="sm"><Plus className="mr-2 h-4 w-4" />Tambah Gudang</Button>} />
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Kode</th>
                <th className="px-4 py-2 text-left font-medium">Nama</th>
                <th className="px-4 py-2 text-left font-medium">Alamat</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="w-40 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {gudang.map((g) => (
                <tr key={g.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{g.kode}</td>
                  <td className="px-4 py-1.5">{g.nama}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">{g.alamat ?? '—'}</td>
                  <td className="px-4 py-1.5">
                    <Badge variant={g.isActive ? 'secondary' : 'outline'}>
                      {g.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <DialogWarehouse gudang={g} pemicu={<Button variant="ghost" size="sm">Ubah</Button>} />
                    <TombolStatusWarehouse id={g.id} isActive={g.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Lokasi</h2>
          <DialogLokasi
            gudang={gudangAktif}
            lokasiLain={pilihanLokasi}
            pemicu={<Button size="sm"><Plus className="mr-2 h-4 w-4" />Tambah Lokasi</Button>}
          />
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Kode</th>
                <th className="px-4 py-2 text-left font-medium">Nama</th>
                <th className="px-4 py-2 text-left font-medium">Tipe</th>
                <th className="px-4 py-2 text-left font-medium">Gudang</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="w-40 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {lokasi.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{l.kode}</td>
                  <td className="px-4 py-1.5">{l.nama}</td>
                  <td className="px-4 py-1.5">
                    <Badge variant={l.tipe === 'internal' ? 'default' : 'outline'}>
                      {LABEL_TIPE_LOKASI[l.tipe] ?? l.tipe}
                    </Badge>
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {l.warehouseId ? gudangLewatId.get(l.warehouseId) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-1.5">
                    <Badge variant={l.isActive ? 'secondary' : 'outline'}>
                      {l.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <DialogLokasi
                      lokasi={l}
                      gudang={gudangAktif}
                      lokasiLain={pilihanLokasi}
                      pemicu={<Button variant="ghost" size="sm">Ubah</Button>}
                    />
                    <TombolStatusLokasi id={l.id} isActive={l.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
