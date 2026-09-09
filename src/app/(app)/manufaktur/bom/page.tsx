import Link from 'next/link'
import { Plus } from 'lucide-react'
import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { products, uoms, bomLines } from '@/db/schema'
import { daftarBom } from '@/modules/manufaktur/layanan/bom'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Bill of Materials' }

export default async function HalamanBom() {
  await wajibIzin('manufaktur.bom.lihat')

  const [resep, semuaProduk, semuaSatuan, semuaBaris] = await Promise.all([
    daftarBom(),
    db.select({ id: products.id, kode: products.kode, nama: products.nama })
      .from(products).orderBy(asc(products.kode)),
    db.select({ id: uoms.id, nama: uoms.nama }).from(uoms),
    db.select({ bomId: bomLines.bomId }).from(bomLines),
  ])

  const produkLewatId = new Map(semuaProduk.map((p) => [p.id, `${p.kode} — ${p.nama}`]))
  const satuanLewatId = new Map(semuaSatuan.map((s) => [s.id, s.nama]))
  const jumlahBahan = new Map<string, number>()
  for (const b of semuaBaris) jumlahBahan.set(b.bomId, (jumlahBahan.get(b.bomId) ?? 0) + 1)

  return (
    <>
      <KepalaHalaman
        judul="Bill of Materials"
        deskripsi="Resep bahan untuk setiap produk. Perintah produksi menyalin resep saat dibuat, sehingga mengubah resep tidak mengusik perintah yang sudah berjalan."
        aksi={
          <Button asChild>
            <Link href="/manufaktur/bom/baru"><Plus className="mr-2 h-4 w-4" />Buat Resep</Link>
          </Button>
        }
      />

      {resep.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Belum ada resep.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Kode</th>
                <th className="px-4 py-2 text-left font-medium">Nama</th>
                <th className="px-4 py-2 text-left font-medium">Produk Hasil</th>
                <th className="px-4 py-2 text-right font-medium">Menghasilkan</th>
                <th className="px-4 py-2 text-right font-medium">Jumlah Bahan</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="w-24 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {resep.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{r.kode}</td>
                  <td className="px-4 py-1.5">{r.nama}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {produkLewatId.get(r.produkId) ?? '—'}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(r.kuantitas, 2)} {satuanLewatId.get(r.uomId) ?? ''}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {jumlahBahan.get(r.id) ?? 0}
                  </td>
                  <td className="px-4 py-1.5">
                    <Badge variant={r.isActive ? 'default' : 'outline'}>
                      {r.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/manufaktur/bom/${r.id}`}>Buka</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
