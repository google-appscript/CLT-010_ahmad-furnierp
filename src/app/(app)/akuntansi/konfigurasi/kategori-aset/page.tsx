import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { assetCategories, accounts } from '@/db/schema'
import { LABEL_METODE } from '@/modules/aset/validasi/aset'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Kategori Aset' }

export default async function HalamanKategoriAset() {
  await wajibIzin('akuntansi.kategori-aset.kelola')

  const [kategori, semuaAkun] = await Promise.all([
    db.select().from(assetCategories).orderBy(asc(assetCategories.kode)),
    db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama }).from(accounts),
  ])
  const akunLewatId = new Map(semuaAkun.map((a) => [a.id, `${a.kode} — ${a.nama}`]))

  return (
    <>
      <KepalaHalaman
        judul="Kategori Aset"
        deskripsi="Kategori memasangkan akun aset, akumulasi depresiasi, dan bebannya, sehingga aset baru tidak perlu dikonfigurasi satu per satu. Kategori yang tidak disusutkan — tanah, misalnya — cukup punya akun asetnya saja."
      />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kode</th>
              <th className="px-4 py-2 text-left font-medium">Nama</th>
              <th className="px-4 py-2 text-left font-medium">Akun Aset</th>
              <th className="px-4 py-2 text-left font-medium">Akumulasi Depresiasi</th>
              <th className="px-4 py-2 text-left font-medium">Beban Depresiasi</th>
              <th className="px-4 py-2 text-left font-medium">Metode Bawaan</th>
              <th className="px-4 py-2 text-right font-medium">Masa Manfaat</th>
              <th className="px-4 py-2 text-left font-medium">Disusutkan</th>
            </tr>
          </thead>
          <tbody>
            {kategori.map((k) => (
              <tr key={k.id} className="border-b">
                <td className="px-4 py-1.5 font-mono text-xs">{k.kode}</td>
                <td className="px-4 py-1.5">{k.nama}</td>
                <td className="px-4 py-1.5 text-muted-foreground">
                  {akunLewatId.get(k.akunAsetId)}
                </td>
                <td className="px-4 py-1.5 text-muted-foreground">
                  {k.akunAkumulasiId ? akunLewatId.get(k.akunAkumulasiId) : '—'}
                </td>
                <td className="px-4 py-1.5 text-muted-foreground">
                  {k.akunBebanId ? akunLewatId.get(k.akunBebanId) : '—'}
                </td>
                <td className="px-4 py-1.5 text-muted-foreground">
                  {LABEL_METODE[k.metodeBawaan]}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {k.masaManfaatBulanBawaan} bulan
                </td>
                <td className="px-4 py-1.5">
                  <Badge variant={k.dapatDidepresiasi ? 'default' : 'outline'}>
                    {k.dapatDidepresiasi ? 'Ya' : 'Tidak'}
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
