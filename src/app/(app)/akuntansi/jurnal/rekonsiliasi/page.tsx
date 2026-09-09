import { wajibIzin } from '@/lib/sesi'
import {
  itemTerbuka, akunDapatDirekonsiliasi, daftarRekonsiliasi,
} from '@/modules/akuntansi/layanan/rekonsiliasi'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelRekonsiliasi } from './panel-rekonsiliasi'
import { TombolBatalRekonsiliasi } from './tombol-batal'

export const metadata = { title: 'Rekonsiliasi' }

export default async function HalamanRekonsiliasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.rekonsiliasi.kelola')
  const params = await searchParams
  const akunId = Array.isArray(params.akun) ? params.akun[0] : params.akun

  const [item, akun, kelompok] = await Promise.all([
    itemTerbuka(akunId ? { akunId } : {}),
    akunDapatDirekonsiliasi(),
    daftarRekonsiliasi(),
  ])

  return (
    <>
      <KepalaHalaman
        judul="Rekonsiliasi"
        deskripsi="Menandai item jurnal yang saling menutup pada akun piutang, utang, dan penerimaan barang belum ditagih, sehingga yang tersisa benar-benar masih terbuka."
      />

      <PanelRekonsiliasi
        item={item}
        akun={akun.map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }))}
        akunTerpilih={akunId ?? 'semua'}
      />

      {kelompok.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Rekonsiliasi Tercatat
          </h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                  <th className="px-4 py-2 text-left font-medium">Asal</th>
                  <th className="px-4 py-2 text-right font-medium">Jumlah Item</th>
                  <th className="px-4 py-2 text-right font-medium">Nilai</th>
                  <th className="w-28 px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {kelompok.map((k) => (
                  <tr key={k.id} className="border-b">
                    <td className="px-4 py-1.5">{k.tanggal}</td>
                    <td className="px-4 py-1.5">
                      <Badge variant={k.asal === 'otomatis' ? 'secondary' : 'outline'}>
                        {k.asal === 'otomatis' ? 'Otomatis' : 'Manual'}
                      </Badge>
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{k.jumlahItem}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(k.nilai)}</td>
                    <td className="px-4 py-1.5 text-right">
                      <TombolBatalRekonsiliasi id={k.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
