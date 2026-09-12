import { asc, eq, inArray } from 'drizzle-orm'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { accounts } from '@/db/schema'
import { daftarPemilik, daftarSusunan } from '@/modules/kepemilikan/layanan/pemilik'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import {
  DialogPemilik, TombolStatusPemilik, DialogSusunan, TombolHapusSusunan,
} from './panel-pemilik'

export const metadata = { title: 'Pemilik & Porsi' }

export default async function HalamanPemilik() {
  await wajibIzin('akuntansi.bagi-hasil.kelola')

  const [pemilik, susunan, akunEkuitas] = await Promise.all([
    daftarPemilik(),
    daftarSusunan(),
    db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama })
      .from(accounts)
      .where(inArray(accounts.tipeAkun, ['ekuitas']))
      .orderBy(asc(accounts.kode)),
  ])

  const semuaAkun = await db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama })
    .from(accounts).where(eq(accounts.isActive, true))
  const akunLewatId = new Map(semuaAkun.map((a) => [a.id, `${a.kode} — ${a.nama}`]))
  const pemilikAktif = pemilik.filter((p) => p.isActive)

  const hariIni = new Date().toISOString().slice(0, 10)

  return (
    <>
      <KepalaHalaman
        judul="Pemilik & Porsi"
        deskripsi="Kepemilikan bersama beserta persentase yang berlaku. Persentase disimpan per susunan agar pembagian periode lampau tidak ikut berubah ketika komposisinya diperbarui."
        aksi={
          <DialogPemilik
            akun={akunEkuitas}
            pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Pemilik</Button>}
          />
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">Pemilik</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Kode</th>
                <th className="px-4 py-2 text-left font-medium">Nama</th>
                <th className="px-4 py-2 text-left font-medium">Akun Modal</th>
                <th className="px-4 py-2 text-left font-medium">Akun Prive</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="w-52 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {pemilik.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Belum ada pemilik terdaftar.
                  </td>
                </tr>
              )}
              {pemilik.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{p.kode}</td>
                  <td className="px-4 py-1.5">{p.nama}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {akunLewatId.get(p.akunModalId) ?? '—'}
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {p.akunPriveId ? akunLewatId.get(p.akunPriveId) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-1.5">
                    <Badge variant={p.isActive ? 'default' : 'outline'}>
                      {p.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <DialogPemilik
                      pemilik={{
                        id: p.id, kode: p.kode, nama: p.nama,
                        akunModalId: p.akunModalId, akunPriveId: p.akunPriveId,
                        catatan: p.catatan ?? '',
                      }}
                      akun={akunEkuitas}
                      pemicu={<Button variant="ghost" size="sm">Ubah</Button>}
                    />
                    <TombolStatusPemilik id={p.id} isActive={p.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Susunan Kepemilikan</h2>
          {pemilikAktif.length > 0 && (
            <DialogSusunan
              pemilik={pemilikAktif.map((p) => ({ id: p.id, kode: p.kode, nama: p.nama }))}
              pemicu={
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />Susunan Baru
                </Button>
              }
            />
          )}
        </div>

        {susunan.length === 0 ? (
          <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
            Belum ada susunan kepemilikan. Bagi hasil tidak dapat dikunci sebelum susunannya
            ditetapkan.
          </div>
        ) : (
          <div className="space-y-4">
            {susunan.map((s) => {
              const berlaku = s.tanggalMulai <= hariIni
                && (s.tanggalSelesai === null || s.tanggalSelesai >= hariIni)
              return (
                <div key={s.id} className="rounded-md border">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2">
                    <div>
                      <span className="font-medium">{s.nama}</span>
                      <span className="ml-3 text-sm text-muted-foreground">
                        {s.tanggalMulai} sampai {s.tanggalSelesai ?? 'seterusnya'}
                      </span>
                      {berlaku && <Badge className="ml-3">Berlaku</Badge>}
                      {Number(s.totalPersentase) !== 100 && (
                        <Badge variant="outline" className="ml-2 text-destructive">
                          Total {formatAngka(s.totalPersentase, 2)}%
                        </Badge>
                      )}
                    </div>
                    <div>
                      {s.dipakaiBagiHasil ? (
                        <span className="text-xs text-muted-foreground">
                          Sudah dipakai membagi laba periode terkunci — tidak dapat diubah
                        </span>
                      ) : (
                        <>
                          <DialogSusunan
                            susunan={{
                              id: s.id, nama: s.nama,
                              tanggalMulai: s.tanggalMulai,
                              tanggalSelesai: s.tanggalSelesai ?? '',
                              catatan: s.catatan ?? '',
                              porsi: s.porsi.map((p) => ({
                                ownerId: p.ownerId, persentase: String(Number(p.persentase)),
                              })),
                            }}
                            pemilik={pemilikAktif.map((p) => ({
                              id: p.id, kode: p.kode, nama: p.nama,
                            }))}
                            pemicu={<Button variant="ghost" size="sm">Ubah</Button>}
                          />
                          <TombolHapusSusunan id={s.id} />
                        </>
                      )}
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {s.porsi.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="px-4 py-1.5">
                            <span className="font-mono text-xs">{p.kodePemilik}</span>
                            <span className="ml-2">{p.namaPemilik}</span>
                          </td>
                          <td className="px-4 py-1.5 text-right tabular-nums">
                            {formatAngka(p.persentase, 2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
