import { asc } from 'drizzle-orm'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { accounts } from '@/db/schema'
import { daftarKategoriAset } from '@/modules/aset/layanan/kategori'
import { LABEL_METODE } from '@/modules/aset/validasi/aset'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DialogKategoriAset, TombolStatusKategoriAset } from './dialog-kategori'

export const metadata = { title: 'Kategori Aset' }

export default async function HalamanKategoriAset() {
  await wajibIzin('akuntansi.kategori-aset.kelola')

  const [kategori, semuaAkun] = await Promise.all([
    daftarKategoriAset(),
    db.select({
      id: accounts.id, kode: accounts.kode, nama: accounts.nama,
      tipeAkun: accounts.tipeAkun, isActive: accounts.isActive,
    }).from(accounts).orderBy(asc(accounts.kode)),
  ])
  const akunAktif = semuaAkun.filter((a) => a.isActive)
  const akunLewatId = new Map(semuaAkun.map((a) => [a.id, `${a.kode} — ${a.nama}`]))

  return (
    <>
      <KepalaHalaman
        judul="Kategori Aset"
        deskripsi="Kategori memasangkan akun aset, akumulasi depresiasi, dan bebannya, sehingga aset baru tidak perlu dikonfigurasi satu per satu. Kategori yang tidak disusutkan — tanah, misalnya — cukup punya akun asetnya saja."
        aksi={
          <DialogKategoriAset
            akun={akunAktif}
            pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Kategori</Button>}
          />
        }
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
              <th className="w-52 px-4 py-2" />
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
                  {!k.isActive && <Badge variant="outline" className="ml-2">Nonaktif</Badge>}
                </td>
                <td className="px-4 py-1.5 text-right">
                  <DialogKategoriAset
                    kategori={{
                      id: k.id, kode: k.kode, nama: k.nama,
                      akunAsetId: k.akunAsetId,
                      akunAkumulasiId: k.akunAkumulasiId,
                      akunBebanId: k.akunBebanId,
                      dapatDidepresiasi: k.dapatDidepresiasi,
                      metodeBawaan: k.metodeBawaan,
                      masaManfaatBulanBawaan: k.masaManfaatBulanBawaan,
                    }}
                    akun={akunAktif}
                    pemicu={<Button variant="ghost" size="sm">Ubah</Button>}
                  />
                  <TombolStatusKategoriAset id={k.id} isActive={k.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
