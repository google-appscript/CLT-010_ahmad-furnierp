import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarAset, daftarKategoriAset, ringkasanAset } from '@/modules/aset/layanan/aset'
import { LABEL_STATUS_ASET, LABEL_METODE } from '@/modules/aset/validasi/aset'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Daftar Aset' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  berjalan: 'default', selesai: 'default', draft: 'secondary', dilepas: 'outline',
}

export default async function HalamanDaftarAset() {
  await wajibIzin('akuntansi.aset.lihat')

  const [aset, kategori] = await Promise.all([daftarAset(), daftarKategoriAset()])
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
                <th className="w-24 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {dengan.map((a) => (
                <tr key={a.id} className="border-b">
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
                  <td className="px-4 py-1.5 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/akuntansi/aset/${a.id}`}>Buka</Link>
                    </Button>
                  </td>
                </tr>
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
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
