import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarEntri } from '@/modules/akuntansi/layanan/entri'
import { daftarJurnal } from '@/modules/akuntansi/layanan/jurnal'
import { LABEL_STATUS } from '@/modules/akuntansi/validasi/entri'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Entri Jurnal' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  diposting: 'default', draft: 'secondary', dibatalkan: 'outline',
}

export default async function HalamanEntriJurnal() {
  await wajibIzin('akuntansi.jurnal.lihat')
  const [entri, jurnal] = await Promise.all([daftarEntri(), daftarJurnal()])
  const jurnalLewatId = new Map(jurnal.map((j) => [j.id, j.kode]))

  return (
    <>
      <KepalaHalaman
        judul="Entri Jurnal"
        deskripsi="Nomor diberikan saat posting. Entri yang sudah diposting dikoreksi lewat entri pembalik."
        aksi={
          <Button asChild>
            <Link href="/akuntansi/jurnal/entri/baru">
              <Plus className="mr-2 h-4 w-4" />Buat Entri
            </Link>
          </Button>
        }
      />

      {entri.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Belum ada entri jurnal.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nomor</th>
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left font-medium">Jurnal</th>
                <th className="px-4 py-2 text-left font-medium">Keterangan</th>
                <th className="px-4 py-2 text-left font-medium">Referensi</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="w-24 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {entri.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="px-4 py-1.5 font-mono text-xs">{e.nomor ?? '—'}</td>
                  <td className="px-4 py-1.5">{e.tanggal}</td>
                  <td className="px-4 py-1.5">{jurnalLewatId.get(e.journalId) ?? '—'}</td>
                  <td className="px-4 py-1.5">{e.keterangan ?? '—'}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">{e.referensi ?? '—'}</td>
                  <td className="px-4 py-1.5">
                    <Badge variant={VARIAN[e.status]}>{LABEL_STATUS[e.status]}</Badge>
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/akuntansi/jurnal/entri/${e.id}`}>Buka</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
