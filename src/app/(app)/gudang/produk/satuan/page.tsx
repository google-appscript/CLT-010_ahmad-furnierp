import { asc } from 'drizzle-orm'

import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { uoms } from '@/db/schema'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TombolBuat, TombolUbah } from '@/components/data/tombol-aksi'
import { LencanaStatus } from '@/components/data/lencana-status'
import { LABEL_KATEGORI_UOM } from '@/modules/gudang/validasi/uom'
import { DialogUom, TombolStatusUom } from './dialog-satuan'

export const metadata = { title: 'Satuan' }

export default async function HalamanSatuan() {
  await wajibIzin('gudang.satuan.kelola')
  const daftar = await db.select().from(uoms)
    .orderBy(asc(uoms.kategori), asc(uoms.kode))

  return (
    <>
      <KepalaHalaman
        judul="Satuan"
        deskripsi="Faktor menyatakan berapa satuan acuan yang setara dengan satu satuan ini. Konversi hanya diizinkan di dalam kategori yang sama."
        aksi={<DialogUom pemicu={<TombolBuat>Tambah Satuan</TombolBuat>} />}
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
              <th className="w-40 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {daftar.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="px-4 py-1.5 font-mono text-xs">{u.kode}</td>
                <td className="px-4 py-1.5">{u.nama}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{LABEL_KATEGORI_UOM[u.kategori]}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(u.faktor, 3)}</td>
                <td className="px-4 py-1.5">
                  <LencanaStatus status={u.isActive ? 'aktif' : 'nonaktif'} label={u.isActive ? 'Aktif' : 'Nonaktif'} />
                </td>
                <td className="px-4 py-1.5 text-right">
                  <DialogUom uom={u} pemicu={<TombolUbah />} />
                  <TombolStatusUom id={u.id} isActive={u.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
