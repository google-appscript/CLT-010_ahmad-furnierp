import Link from 'next/link'
import { Plus } from 'lucide-react'
import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { products, uoms } from '@/db/schema'
import { daftarPerintahProduksi } from '@/modules/manufaktur/layanan/perintah-produksi'
import { LABEL_STATUS_PERINTAH_PRODUKSI } from '@/modules/manufaktur/validasi/produksi'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { BarisKlik } from '@/components/data/tabel-data-interaktif'

export const metadata = { title: 'Perintah Produksi' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  selesai: 'default', dikonfirmasi: 'default', draft: 'secondary', dibatalkan: 'outline',
}

export default async function HalamanPerintahProduksi() {
  await wajibIzin('manufaktur.mo.lihat')

  const [perintah, semuaProduk, semuaSatuan] = await Promise.all([
    daftarPerintahProduksi(),
    db.select({ id: products.id, kode: products.kode, nama: products.nama })
      .from(products).orderBy(asc(products.kode)),
    db.select({ id: uoms.id, nama: uoms.nama }).from(uoms),
  ])

  const produkLewatId = new Map(semuaProduk.map((p) => [p.id, `${p.kode} — ${p.nama}`]))
  const satuanLewatId = new Map(semuaSatuan.map((s) => [s.id, s.nama]))

  return (
    <>
      <KepalaHalaman
        judul="Perintah Produksi"
        deskripsi="Bahan keluar ke lokasi virtual Produksi, biaya konversi diserap, lalu barang jadi masuk gudang senilai seluruh biaya itu."
        aksi={
          <Button asChild>
            <Link href="/manufaktur/perintah-produksi/baru">
              <Plus className="mr-2 h-4 w-4" />Buat Perintah
            </Link>
          </Button>
        }
      />

      {perintah.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Belum ada perintah produksi.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nomor</th>
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left font-medium">Produk</th>
                <th className="px-4 py-2 text-right font-medium">Kuantitas</th>
                <th className="px-4 py-2 text-right font-medium">Harga Pokok Satuan</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {perintah.map((p) => (
                <BarisKlik key={p.id} href={`/manufaktur/perintah-produksi/${p.id}`}>
                  <td className="px-4 py-1.5 font-mono text-xs">{p.nomor ?? '—'}</td>
                  <td className="px-4 py-1.5">{p.tanggal}</td>
                  <td className="px-4 py-1.5">{produkLewatId.get(p.produkId) ?? '—'}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(p.kuantitas, 2)} {satuanLewatId.get(p.uomId) ?? ''}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {p.hargaPokokSatuan ? formatAngka(p.hargaPokokSatuan) : '—'}
                  </td>
                  <td className="px-4 py-1.5">
                    <Badge variant={VARIAN[p.status]}>
                      {LABEL_STATUS_PERINTAH_PRODUKSI[p.status]}
                    </Badge>
                  </td>
                </BarisKlik>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
