import Link from 'next/link'
import { desc, inArray } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { companySettings, journalEntries, ownershipPeriods } from '@/db/schema'
import { daftarPeriodeBagiHasil } from '@/modules/kepemilikan/layanan/bagi-hasil'
import { daftarPemilik } from '@/modules/kepemilikan/layanan/pemilik'
import { formatAngka, formatRupiah } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import {
  PemilihPeriodeBagiHasil, PemilihTahun, TombolKunci, TombolBukaKunci,
} from './panel-distribusi'

export const metadata = { title: 'Distribusi Laba' }

export default async function HalamanDistribusi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.bagi-hasil.kelola')
  const params = await searchParams
  const diminta = Array.isArray(params.tahun) ? params.tahun[0] : params.tahun
  const tahun = Number(diminta) || new Date().getUTCFullYear()

  const [pengaturan] = await db.select().from(companySettings).limit(1)
  const tipe = pengaturan?.periodeBagiHasil ?? 'tahunan'

  const [periode, pemilik, susunan] = await Promise.all([
    daftarPeriodeBagiHasil(tahun),
    daftarPemilik({ hanyaAktif: true }),
    db.select().from(ownershipPeriods).orderBy(desc(ownershipPeriods.tanggalMulai)),
  ])

  const idJurnal = periode.map((p) => p.jurnalEntryId).filter((x): x is string => Boolean(x))
  const jurnal = idJurnal.length > 0
    ? await db.select({ id: journalEntries.id, nomor: journalEntries.nomor })
        .from(journalEntries).where(inArray(journalEntries.id, idJurnal))
    : []
  const nomorJurnal = new Map(jurnal.map((j) => [j.id, j.nomor]))

  const belumSiap: string[] = []
  if (pemilik.length === 0) belumSiap.push('belum ada pemilik terdaftar')
  if (susunan.length === 0) belumSiap.push('belum ada susunan kepemilikan')
  if (!pengaturan?.akunLabaBerjalanId) {
    belumSiap.push('akun Laba Tahun Berjalan belum diatur di Pemetaan Jurnal')
  }

  // Penguncian berurutan: hanya periode terbuka paling awal yang boleh dikunci.
  const terbukaPertama = periode.find((p) => p.status === 'terbuka')

  return (
    <>
      <KepalaHalaman
        judul="Distribusi Laba"
        deskripsi="Mengunci laba bersih sebuah periode lalu membagikannya ke akun modal masing-masing pemilik. Laporan Laba Rugi tidak ditutup, sehingga periode itu tetap terbaca utuh."
      />

      <div className="mb-6 flex flex-wrap items-end gap-6 rounded-md border p-4">
        <PemilihPeriodeBagiHasil nilai={tipe} />
        <PemilihTahun tahun={tahun} />
        <p className="flex-1 text-sm text-muted-foreground">
          Panjang periode adalah pengaturan global. Mengubahnya hanya berlaku untuk periode
          yang belum dikunci — yang sudah terkunci menyimpan tipenya sendiri dan tidak ikut
          berubah.
        </p>
      </div>

      {belumSiap.length > 0 && (
        <div className="mb-6 rounded-md border border-dashed p-4 text-sm">
          <span className="font-medium text-destructive">Belum dapat membagi hasil:</span>{' '}
          {belumSiap.join('; ')}.{' '}
          <Link href="/akuntansi/bagi-hasil/pemilik" className="underline">
            Lengkapi pemilik dan susunannya
          </Link>.
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Periode</th>
              <th className="px-4 py-2 text-left font-medium">Rentang</th>
              <th className="px-4 py-2 text-right font-medium">Laba Bersih</th>
              <th className="px-4 py-2 text-left font-medium">Pembagian</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="w-44 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {periode.map((p) => {
              const terkunci = p.status === 'terkunci'
              const giliran = !terkunci && terbukaPertama?.kode === p.kode
              return (
                <tr key={p.kode} className="border-b">
                  <td className="px-4 py-1.5">
                    <span className="font-medium">{p.nama}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{p.kode}</span>
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {p.tanggalMulai} — {p.tanggalSelesai}
                  </td>
                  <td className={`px-4 py-1.5 text-right font-medium tabular-nums ${
                    Number(p.labaBersih) < 0 ? 'text-destructive' : ''
                  }`}>
                    {formatAngka(p.labaBersih)}
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {p.porsi.length === 0 ? '—' : p.porsi.map((x) => (
                      <span key={x.ownerId} className="mr-3 inline-block">
                        {x.nama} {formatAngka(x.persentase, 2)}% ·{' '}
                        <span className="tabular-nums">{formatAngka(x.jumlah)}</span>
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-1.5">
                    <Badge variant={terkunci ? 'default' : 'secondary'}>
                      {terkunci ? 'Terkunci' : 'Terbuka'}
                    </Badge>
                    {terkunci && p.jurnalEntryId && (
                      <Link
                        href={`/akuntansi/jurnal/entri/${p.jurnalEntryId}`}
                        className="ml-2 font-mono text-xs underline"
                      >
                        {nomorJurnal.get(p.jurnalEntryId)}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    {terkunci
                      ? <TombolBukaKunci id={p.profitPeriodId!} />
                      : (
                        <TombolKunci
                          kode={p.kode}
                          nonaktif={
                            belumSiap.length > 0
                            || !giliran
                            || Number(p.labaBersih) === 0
                          }
                        />
                      )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Periode dikunci berurutan — melompati periode yang lebih awal akan membuat laba yang
        belum dibagikan tertinggal tanpa pernah ketahuan. Membuka kunci membalik jurnal
        distribusinya, bukan menghapusnya, sesuai aturan bahwa entri terposting tidak pernah
        diubah.
      </p>

      {periode.some((p) => p.status === 'terkunci') && (
        <p className="mt-2 text-sm text-muted-foreground">
          Total yang sudah dibagikan tahun {tahun}:{' '}
          <span className="font-medium">
            {formatRupiah(
              periode
                .filter((p) => p.status === 'terkunci')
                .reduce((t, p) => t + Number(p.labaBersih), 0)
                .toFixed(2),
            )}
          </span>.
        </p>
      )}
    </>
  )
}
