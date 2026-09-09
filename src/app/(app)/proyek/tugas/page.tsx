import Link from 'next/link'
import { wajibIzin } from '@/lib/sesi'
import { daftarTugas } from '@/modules/proyek/layanan/tugas'
import { LABEL_STATUS_TUGAS } from '@/modules/proyek/validasi/proyek'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Tugas' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  berjalan: 'default', selesai: 'default', belum_mulai: 'secondary', dibatalkan: 'outline',
}

export default async function HalamanTugas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('proyek.tugas.kelola')
  const params = await searchParams
  const status = Array.isArray(params.status) ? params.status[0] : params.status

  const tugas = await daftarTugas(
    status && status !== 'semua' ? { status: status as never } : {},
  )

  const hariIni = new Date().toISOString().slice(0, 10)

  return (
    <>
      <KepalaHalaman
        judul="Tugas"
        deskripsi="Seluruh tugas lintas proyek. Tugas dikelola dari halaman proyeknya masing-masing."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {['semua', 'belum_mulai', 'berjalan', 'selesai', 'dibatalkan'].map((s) => (
          <Link
            key={s}
            href={s === 'semua' ? '/proyek/tugas' : `/proyek/tugas?status=${s}`}
            className={`rounded-md border px-3 py-1 text-sm ${
              (status ?? 'semua') === s ? 'bg-muted font-medium' : 'text-muted-foreground'
            }`}
          >
            {s === 'semua' ? 'Semua' : LABEL_STATUS_TUGAS[s]}
          </Link>
        ))}
      </div>

      {tugas.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Tidak ada tugas pada saringan ini.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Proyek</th>
                <th className="px-4 py-2 text-left font-medium">Tugas</th>
                <th className="px-4 py-2 text-left font-medium">Penanggung Jawab</th>
                <th className="px-4 py-2 text-left font-medium">Tenggat</th>
                <th className="px-4 py-2 text-right font-medium">Estimasi</th>
                <th className="px-4 py-2 text-right font-medium">Tercatat</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tugas.map((t) => {
                const terlambat = t.tenggat !== null
                  && t.tenggat < hariIni
                  && (t.status === 'belum_mulai' || t.status === 'berjalan')
                return (
                  <tr key={t.id} className="border-b">
                    <td className="px-4 py-1.5">
                      <Link href={`/proyek/${t.proyekId}`} className="font-mono text-xs underline">
                        {t.kodeProyek}
                      </Link>
                      <span className="ml-2 text-muted-foreground">{t.namaProyek}</span>
                    </td>
                    <td className="px-4 py-1.5">{t.nama}</td>
                    <td className="px-4 py-1.5 text-muted-foreground">
                      {t.namaPenanggungJawab ?? '—'}
                    </td>
                    <td className={`px-4 py-1.5 ${
                      terlambat ? 'font-medium text-destructive' : 'text-muted-foreground'
                    }`}>
                      {t.tenggat ?? '—'}{terlambat && ' · lewat tenggat'}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(t.estimasiJam, 2)}
                    </td>
                    <td className={`px-4 py-1.5 text-right tabular-nums ${
                      Number(t.jamTercatat) > Number(t.estimasiJam) ? 'font-medium' : ''
                    }`}>
                      {formatAngka(t.jamTercatat, 2)}
                    </td>
                    <td className="px-4 py-1.5">
                      <Badge variant={VARIAN[t.status]}>{LABEL_STATUS_TUGAS[t.status]}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
