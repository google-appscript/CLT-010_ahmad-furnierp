import { asc } from 'drizzle-orm'
import { db } from '@/db/klien'
import { products, uoms, bomLines } from '@/db/schema'
import { daftarBom } from '@/modules/manufaktur/layanan/bom'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import type { ParameterDaftar } from '@/lib/daftar'

export async function DaftarBom({ param }: { param: ParameterDaftar }) {
  const [{ data: resep, totalBaris }, semuaProduk, semuaSatuan] = await Promise.all([
    daftarBom(param),
    db.select({ id: products.id, kode: products.kode, nama: products.nama })
      .from(products).orderBy(asc(products.kode)),
    db.select({ id: uoms.id, nama: uoms.nama }).from(uoms),
  ])

  const idResep = resep.map((r) => r.id)
  const semuaBaris = idResep.length > 0
    ? await db.select({ bomId: bomLines.bomId }).from(bomLines)
    : []

  const produkLewatId = new Map(semuaProduk.map((p) => [p.id, `${p.kode} — ${p.nama}`]))
  const satuanLewatId = new Map(semuaSatuan.map((s) => [s.id, s.nama]))
  const jumlahBahan = new Map<string, number>()
  for (const b of semuaBaris) jumlahBahan.set(b.bomId, (jumlahBahan.get(b.bomId) ?? 0) + 1)

  const kolom: Kolom<(typeof resep)[number]>[] = [
    { kunci: 'kode', judul: 'Kode', render: (r) => <span className="font-mono text-xs">{r.kode}</span> },
    { kunci: 'nama', judul: 'Nama', render: (r) => r.nama },
    { kunci: 'produkHasil', judul: 'Produk Hasil', render: (r) => <span className="text-muted-foreground">{produkLewatId.get(r.produkId) ?? '—'}</span> },
    {
      kunci: 'menghasilkan', judul: 'Menghasilkan', rataKanan: true,
      render: (r) => `${formatAngka(r.kuantitas, 2)} ${satuanLewatId.get(r.uomId) ?? ''}`,
    },
    { kunci: 'jumlahBahan', judul: 'Jumlah Bahan', rataKanan: true, render: (r) => jumlahBahan.get(r.id) ?? 0 },
    {
      kunci: 'status', judul: 'Status',
      render: (r) => <Badge variant={r.isActive ? 'default' : 'outline'}>{r.isActive ? 'Aktif' : 'Nonaktif'}</Badge>,
    },
  ]

  return (
    <TabelData
      kolom={kolom}
      baris={resep}
      kunciBaris={(r) => r.id}
      pesanKosong="Belum ada resep."
      hrefBaris={(r) => `/manufaktur/bom/${r.id}`}
      pagination={{ halaman: param.halaman, ukuranHalaman: param.ukuranHalaman, totalBaris }}
    />
  )
}
