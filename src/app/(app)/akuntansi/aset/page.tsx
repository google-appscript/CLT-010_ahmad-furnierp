import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarAset, daftarKategoriAset, ringkasanAset } from '@/modules/aset/layanan/aset'
import { LABEL_STATUS_ASET, LABEL_METODE } from '@/modules/aset/validasi/aset'
import { uraikanParameterDaftar, type ParameterDaftar } from '@/lib/daftar'
import { daftarFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelPencarian } from '@/components/data/panel-pencarian'
import { BarisKlik } from '@/components/data/tabel-data-interaktif'

export const metadata = { title: 'Daftar Aset' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  berjalan: 'default', selesai: 'default', draft: 'secondary', dilepas: 'outline',
}

const KUNCI_DAFTAR = 'akuntansi.aset'

export default async function HalamanDaftarAset({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesi = await wajibIzin('akuntansi.aset.lihat')

  const sp = await searchParams
  const params = new URLSearchParams()
  for (const [kunci, nilai] of Object.entries(sp)) {
    if (nilai === undefined) continue
    for (const v of Array.isArray(nilai) ? nilai : [nilai]) params.append(kunci, v)
  }
  const param = uraikanParameterDaftar(params)

  const [{ data: aset }, kategori, favorit] = await Promise.all([
    // Total di bawah menjumlahkan seluruh baris yang tampil (bukan satu
    // halaman pager) supaya tetap benar direkonsiliasi terhadap saldo akun.
    daftarAset({ ...param, halaman: 1, ukuranHalaman: 100000 }),
    daftarKategoriAset(),
    daftarFilter(sesi.penggunaId, KUNCI_DAFTAR),
  ])
  const kategoriLewatId = new Map(kategori.map((k) => [k.id, k.nama]))
  const dengan = await Promise.all(aset.map(async (a) => (await ringkasanAset(a.id))!))

  const totalPerolehan = dengan
    .filter((a) => a.status !== 'dilepas')
    .reduce((t, a) => t + Number(a.nilaiPerolehan), 0)
  const totalBuku = dengan
    .filter((a) => a.status !== 'dilepas')
    .reduce((t, a) => t + Number(a.nilaiBuku), 0)

  return (
    <>
      <KepalaHalaman
        judul="Daftar Aset"
        deskripsi="Register aset tetap beserta akumulasi depresiasi dan nilai bukunya. Perolehan aset tidak diposting di sini — nilainya sudah masuk buku besar lewat tagihan pembelian atau saldo awal."
        aksi={
          <Button asChild>
            <Link href="/akuntansi/aset/baru"><Plus className="mr-2 h-4 w-4" />Daftarkan Aset</Link>
          </Button>
        }
      />
      <PanelPencarian
        kunciDaftar={KUNCI_DAFTAR}
        kolomFilter={[
          {
            kunci: 'status',
            label: 'Status',
            opsi: Object.entries(LABEL_STATUS_ASET).map(([nilai, label]) => ({ nilai, label })),
          },
        ]}
        kolomGroupBy={[]}
        favorit={favorit.map((f) => ({ ...f, kriteria: f.kriteria as ParameterDaftar }))}
      />

      {aset.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Belum ada aset terdaftar.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Kode</th>
                <th className="px-4 py-2 text-left font-medium">Nama</th>
                <th className="px-4 py-2 text-left font-medium">Kategori</th>
                <th className="px-4 py-2 text-left font-medium">Perolehan</th>
                <th className="px-4 py-2 text-left font-medium">Metode</th>
                <th className="px-4 py-2 text-right font-medium">Nilai Perolehan</th>
                <th className="px-4 py-2 text-right font-medium">Akumulasi</th>
                <th className="px-4 py-2 text-right font-medium">Nilai Buku</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {dengan.map((a) => (
                <BarisKlik key={a.id} href={`/akuntansi/aset/${a.id}`}>
                  <td className="px-4 py-1.5 font-mono text-xs">{a.kode}</td>
                  <td className="px-4 py-1.5">{a.nama}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {kategoriLewatId.get(a.kategoriId) ?? '—'}
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">{a.tanggalPerolehan}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">{LABEL_METODE[a.metode]}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(a.nilaiPerolehan)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(a.akumulasi)}
                  </td>
                  <td className="px-4 py-1.5 text-right font-medium tabular-nums">
                    {a.status === 'dilepas' ? '—' : formatAngka(a.nilaiBuku)}
                  </td>
                  <td className="px-4 py-1.5">
                    <Badge variant={VARIAN[a.status]}>{LABEL_STATUS_ASET[a.status]}</Badge>
                  </td>
                </BarisKlik>
              ))}
            </tbody>
            <tfoot className="border-t-2 bg-muted/40 font-semibold">
              <tr>
                <td colSpan={5} className="px-4 py-2 text-right">Total aset yang masih dimiliki</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(totalPerolehan.toFixed(2))}
                </td>
                <td />
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAngka(totalBuku.toFixed(2))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
