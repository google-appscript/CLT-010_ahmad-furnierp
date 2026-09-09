import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { locations, warehouses } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Gudang & Lokasi' }

const LABEL_TIPE: Record<string, string> = {
  internal: 'Internal', pemasok: 'Pemasok', pelanggan: 'Pelanggan',
  penyesuaian: 'Penyesuaian', rusak: 'Barang Rusak',
  produksi: 'Produksi', transit: 'Transit',
}

export default async function HalamanLokasi() {
  await wajibIzin('gudang.lokasi.kelola')

  const [gudang, lokasi] = await Promise.all([
    db.select().from(warehouses).orderBy(asc(warehouses.kode)),
    db.select().from(locations).orderBy(asc(locations.tipe), asc(locations.kode)),
  ])
  const gudangLewatId = new Map(gudang.map((g) => [g.id, g.nama]))

  return (
    <>
      <KepalaHalaman
        judul="Gudang & Lokasi"
        deskripsi="Setiap pergerakan stok selalu antara dua lokasi. Lokasi virtual membuat penerimaan, pengiriman, barang rusak, dan stock opname memakai satu mekanisme yang sama."
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Gudang</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Kode</th>
                <th className="px-4 py-2 text-left font-medium">Nama</th>
                <th className="px-4 py-2 text-left font-medium">Alamat</th>
              </tr>
            </thead>
            <tbody>
              {gudang.map((g) => (
                <tr key={g.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{g.kode}</td>
                  <td className="px-4 py-1.5">{g.nama}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">{g.alamat ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Lokasi</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Kode</th>
                <th className="px-4 py-2 text-left font-medium">Nama</th>
                <th className="px-4 py-2 text-left font-medium">Tipe</th>
                <th className="px-4 py-2 text-left font-medium">Gudang</th>
              </tr>
            </thead>
            <tbody>
              {lokasi.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{l.kode}</td>
                  <td className="px-4 py-1.5">{l.nama}</td>
                  <td className="px-4 py-1.5">
                    <Badge variant={l.tipe === 'internal' ? 'default' : 'outline'}>
                      {LABEL_TIPE[l.tipe]}
                    </Badge>
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {l.warehouseId ? gudangLewatId.get(l.warehouseId) ?? '—' : '—'}
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
