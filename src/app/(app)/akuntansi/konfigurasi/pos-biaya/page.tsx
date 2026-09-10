import { asc, eq } from 'drizzle-orm'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { locations } from '@/db/schema'
import { daftarPosBiaya, daftarPosBawaanLokasi } from '@/modules/akuntansi/layanan/pos-biaya'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { DialogPosBiaya, TombolStatusPos, PemilihPosLokasi } from './panel-pos'

export const metadata = { title: 'Pos Biaya' }

export default async function HalamanPosBiaya() {
  await wajibIzin('akuntansi.pos-biaya.kelola')

  const [pos, bawaan, gudang] = await Promise.all([
    daftarPosBiaya(),
    daftarPosBawaanLokasi(),
    db.select({ id: locations.id, kode: locations.kode, nama: locations.nama })
      .from(locations).where(eq(locations.tipe, 'internal')).orderBy(asc(locations.kode)),
  ])

  const posAktif = pos.filter((p) => p.isActive)
  const bawaanLewatLokasi = new Map(bawaan.map((b) => [b.lokasiId, b.costCenterId]))

  return (
    <>
      <KepalaHalaman
        judul="Pos Biaya"
        deskripsi="Unit kerja yang menanggung beban operasional. Berbeda dari proyek yang punya awal dan akhir, pos biaya adalah pembagian permanen perusahaan — keduanya berdampingan sebagai dua dimensi terpisah pada item jurnal."
        aksi={
          <DialogPosBiaya
            pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Pos Biaya</Button>}
          />
        }
      />

      <section className="mb-8">
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Kode</th>
                <th className="px-4 py-2 text-left font-medium">Nama</th>
                <th className="px-4 py-2 text-left font-medium">Deskripsi</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="w-52 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {pos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    Belum ada pos biaya.
                  </td>
                </tr>
              )}
              {pos.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{p.kode}</td>
                  <td className="px-4 py-1.5">{p.nama}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">{p.deskripsi ?? '—'}</td>
                  <td className="px-4 py-1.5">
                    <Badge variant={p.isActive ? 'default' : 'outline'}>
                      {p.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <DialogPosBiaya
                      pos={{
                        id: p.id, kode: p.kode, nama: p.nama, deskripsi: p.deskripsi ?? '',
                      }}
                      pemicu={<Button variant="ghost" size="sm">Ubah</Button>}
                    />
                    <TombolStatusPos id={p.id} isActive={p.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium">Pos Bawaan Gudang</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Pergerakan stok mewarisi pos ini, sehingga operator tidak perlu memilihnya pada setiap
          transaksi. Pilihan manual pada entri jurnal tetap mengalahkan bawaan ini.
        </p>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Gudang</th>
                <th className="w-72 px-4 py-2 text-left font-medium">Pos Biaya Bawaan</th>
              </tr>
            </thead>
            <tbody>
              {gudang.map((g) => (
                <tr key={g.id} className="border-b">
                  <td className="px-4 py-1.5">
                    <span className="font-mono text-xs">{g.kode}</span>
                    <span className="ml-2">{g.nama}</span>
                  </td>
                  <td className="px-4 py-1.5">
                    <PemilihPosLokasi
                      lokasiId={g.id}
                      terpilih={bawaanLewatLokasi.get(g.id) ?? null}
                      pos={posAktif.map((p) => ({ id: p.id, kode: p.kode, nama: p.nama }))}
                    />
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
