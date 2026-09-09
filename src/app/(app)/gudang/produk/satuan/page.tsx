import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { uoms } from '@/db/schema'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Satuan' }

const LABEL_KATEGORI: Record<string, string> = {
  satuan: 'Satuan', berat: 'Berat', panjang: 'Panjang',
  luas: 'Luas', volume: 'Volume', waktu: 'Waktu',
}

export default async function HalamanSatuan() {
  await wajibIzin('gudang.satuan.kelola')
  const daftar = await db.select().from(uoms)
    .orderBy(asc(uoms.kategori), asc(uoms.kode))

  return (
    <>
      <KepalaHalaman
        judul="Satuan"
        deskripsi="Faktor menyatakan berapa satuan acuan yang setara dengan satu satuan ini. Konversi hanya diizinkan di dalam kategori yang sama."
      />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kode</th>
              <th className="px-4 py-2 text-left font-medium">Nama</th>
              <th className="px-4 py-2 text-left font-medium">Kategori</th>
              <th className="px-4 py-2 text-right font-medium">Faktor</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {daftar.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="px-4 py-1.5 font-mono text-xs">{u.kode}</td>
                <td className="px-4 py-1.5">{u.nama}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{LABEL_KATEGORI[u.kategori]}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(u.faktor, 3)}</td>
                <td className="px-4 py-1.5">
                  <Badge variant={u.isActive ? 'secondary' : 'outline'}>
                    {u.isActive ? 'Aktif' : 'Nonaktif'}
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
