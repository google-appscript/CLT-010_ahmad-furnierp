import { and, asc, desc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { products, stockOperations, packingLists, packingListItems } from '@/db/schema'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DialogPackingList } from './dialog-packing'

export const metadata = { title: 'Packing List' }

export default async function HalamanPackingList() {
  await wajibIzin('gudang.packing.kelola')

  const [daftar, pengiriman, daftarProduk, semuaItem] = await Promise.all([
    db.select({
      id: packingLists.id,
      nomor: packingLists.nomor,
      tanggal: packingLists.tanggal,
      catatan: packingLists.catatan,
      nomorPengiriman: stockOperations.nomor,
    })
      .from(packingLists)
      .innerJoin(stockOperations, eq(stockOperations.id, packingLists.operasiId))
      .orderBy(desc(packingLists.tanggal), desc(packingLists.nomor)),
    db.select({ id: stockOperations.id, nomor: stockOperations.nomor, tanggal: stockOperations.tanggal })
      .from(stockOperations)
      .where(and(eq(stockOperations.tipe, 'pengiriman'), eq(stockOperations.status, 'selesai')))
      .orderBy(desc(stockOperations.tanggal)),
    db.select({ id: products.id, kode: products.kode, nama: products.nama })
      .from(products).where(eq(products.tipe, 'disimpan')).orderBy(asc(products.kode)),
    db.select().from(packingListItems).orderBy(asc(packingListItems.urutan)),
  ])

  const produkLewatId = new Map(daftarProduk.map((p) => [p.id, p]))
  const itemLewatList = new Map<string, typeof semuaItem>()
  for (const i of semuaItem) {
    itemLewatList.set(i.packingListId, [...(itemLewatList.get(i.packingListId) ?? []), i])
  }

  return (
    <>
      <KepalaHalaman
        judul="Packing List"
        deskripsi="Dokumen pendamping pengiriman yang merinci pembagian barang ke dalam koli. Tidak menghasilkan pergerakan stok maupun jurnal tersendiri."
        aksi={
          <DialogPackingList
            pengiriman={pengiriman.map((p) => ({ id: p.id, nomor: p.nomor!, tanggal: p.tanggal }))}
            produk={daftarProduk}
          />
        }
      />

      {daftar.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          {pengiriman.length === 0
            ? 'Belum ada dokumen pengiriman yang selesai. Selesaikan pengiriman terlebih dahulu.'
            : 'Belum ada packing list.'}
        </div>
      ) : (
        <div className="space-y-6">
          {daftar.map((pl) => {
            const item = itemLewatList.get(pl.id) ?? []
            const totalBerat = item.reduce((t, i) => t + Number(i.beratKg ?? 0), 0)
            return (
              <section key={pl.id} className="overflow-hidden rounded-md border">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
                  <div>
                    <span className="font-mono text-sm font-medium">{pl.nomor}</span>
                    <span className="ml-3 text-sm text-muted-foreground">
                      Pengiriman {pl.nomorPengiriman} · {pl.tanggal}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {item.length} koli · {formatAngka(totalBerat.toFixed(3), 3)} kg
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Nomor Koli</th>
                      <th className="px-4 py-2 text-left font-medium">Produk</th>
                      <th className="px-4 py-2 text-right font-medium">Kuantitas</th>
                      <th className="px-4 py-2 text-right font-medium">Berat (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.map((i) => (
                      <tr key={i.id} className="border-b last:border-0">
                        <td className="px-4 py-1.5 font-mono text-xs">{i.nomorKoli}</td>
                        <td className="px-4 py-1.5">{produkLewatId.get(i.produkId)?.nama ?? '—'}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums">
                          {formatAngka(i.kuantitas, 2)}
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums">
                          {i.beratKg ? formatAngka(i.beratKg, 3) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pl.catatan && (
                  <p className="border-t px-4 py-2 text-sm text-muted-foreground">{pl.catatan}</p>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
