import Link from 'next/link'
import { asc, eq } from 'drizzle-orm'
import { ambilSesi, wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { users, projects } from '@/db/schema'
import { daftarTimesheet } from '@/modules/proyek/layanan/timesheet'
import { formatAngka, bulatkan, tambah } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { periodeBawaan, tanggalPanjang } from '@/app/(app)/akuntansi/laporan/periode'
import { ambilProyekTerbuka } from '../data-pilihan'
import { FormulirTimesheet } from './formulir-timesheet'
import { TombolHapusTimesheet } from './tombol-hapus'

export const metadata = { title: 'Timesheet' }

export default async function HalamanTimesheet({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('proyek.timesheet.kelola')
  const sesi = await ambilSesi()
  const { dari, sampai } = periodeBawaan(await searchParams)

  const [{ proyek, tugas }, pengguna, baris, statusProyek] = await Promise.all([
    ambilProyekTerbuka(),
    db.select({ id: users.id, nama: users.nama })
      .from(users).where(eq(users.isActive, true)).orderBy(asc(users.nama)),
    daftarTimesheet({ dari, sampai }),
    db.select({ id: projects.id, status: projects.status }).from(projects),
  ])

  const proyekTertutup = new Set(
    statusProyek.filter((p) => p.status === 'selesai' || p.status === 'dibatalkan')
      .map((p) => p.id),
  )

  const totalJam = baris.length > 0
    ? bulatkan(tambah(...baris.map((b) => b.jam)), 2)
    : '0.00'
  const totalBiaya = baris.length > 0
    ? bulatkan(tambah(...baris.map((b) => b.biaya)), 2)
    : '0.00'

  return (
    <>
      <KepalaHalaman
        judul="Timesheet"
        deskripsi="Jam kerja yang tercatat pada proyek. Timesheet tidak memposting jurnal — biayanya muncul sebagai angka manajerial di laporan profitabilitas."
      />

      <FormulirTimesheet
        proyek={proyek}
        tugas={tugas}
        pengguna={pengguna}
        penggunaAktifId={sesi.penggunaId}
      />

      <PenyaringPeriode dari={dari} sampai={sampai} />

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Periode {tanggalPanjang(dari)} sampai {tanggalPanjang(sampai)}
      </h2>

      {baris.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Belum ada jam kerja tercatat pada periode ini.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left font-medium">Proyek</th>
                <th className="px-4 py-2 text-left font-medium">Tugas</th>
                <th className="px-4 py-2 text-left font-medium">Pelaksana</th>
                <th className="px-4 py-2 text-left font-medium">Uraian</th>
                <th className="px-4 py-2 text-right font-medium">Jam</th>
                <th className="px-4 py-2 text-right font-medium">Tarif</th>
                <th className="px-4 py-2 text-right font-medium">Biaya</th>
                <th className="w-20 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.id} className="border-b">
                  <td className="px-4 py-1.5">{b.tanggal}</td>
                  <td className="px-4 py-1.5">
                    <Link href={`/proyek/${b.proyekId}`} className="font-mono text-xs underline">
                      {b.kodeProyek}
                    </Link>
                    <span className="ml-2 text-muted-foreground">{b.namaProyek}</span>
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">{b.namaTugas ?? '—'}</td>
                  <td className="px-4 py-1.5">{b.namaPengguna}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">{b.deskripsi}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.jam, 2)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(b.tarifPerJam)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.biaya)}</td>
                  <td className="px-4 py-1.5 text-right">
                    {!proyekTertutup.has(b.proyekId) && <TombolHapusTimesheet id={b.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 bg-muted/40 font-semibold">
              <tr>
                <td colSpan={5} className="px-4 py-2 text-right">Total</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatAngka(totalJam, 2)}</td>
                <td />
                <td className="px-4 py-2 text-right tabular-nums">{formatAngka(totalBiaya)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
