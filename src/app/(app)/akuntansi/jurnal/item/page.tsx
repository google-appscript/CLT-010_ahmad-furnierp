import Link from 'next/link'
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { journalEntries, journalItems, accounts, partners, journals } from '@/db/schema'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { periodeBawaan } from '../../laporan/periode'

export const metadata = { title: 'Item Jurnal' }

const BATAS = 500

export default async function HalamanItemJurnal({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.jurnal.lihat')
  const { dari, sampai } = periodeBawaan(await searchParams)

  // Menampilkan seluruh item terposting sebagai satu daftar datar; berguna
  // untuk menelusuri satu nilai sampai ke entri asalnya.
  const item = await db
    .select({
      id: journalItems.id,
      entryId: journalEntries.id,
      nomor: journalEntries.nomor,
      tanggal: journalEntries.tanggal,
      jurnalKode: journals.kode,
      kodeAkun: accounts.kode,
      namaAkun: accounts.nama,
      label: journalItems.label,
      namaPartner: partners.nama,
      debit: journalItems.debit,
      kredit: journalItems.kredit,
    })
    .from(journalItems)
    .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
    .innerJoin(accounts, eq(accounts.id, journalItems.accountId))
    .innerJoin(journals, eq(journals.id, journalEntries.journalId))
    .leftJoin(partners, eq(partners.id, journalItems.partnerId))
    .where(and(
      eq(journalEntries.status, 'diposting'),
      gte(journalEntries.tanggal, dari),
      lte(journalEntries.tanggal, sampai),
    ))
    .orderBy(desc(journalEntries.tanggal), desc(journalEntries.nomor), asc(journalItems.urutan))
    .limit(BATAS)

  return (
    <>
      <KepalaHalaman
        judul="Item Jurnal"
        deskripsi="Seluruh baris jurnal terposting dalam satu daftar datar."
      />
      <PenyaringPeriode dari={dari} sampai={sampai} />

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Tanggal</th>
              <th className="px-4 py-2 text-left font-medium">Nomor</th>
              <th className="px-4 py-2 text-left font-medium">Jurnal</th>
              <th className="px-4 py-2 text-left font-medium">Akun</th>
              <th className="px-4 py-2 text-left font-medium">Keterangan</th>
              <th className="px-4 py-2 text-left font-medium">Mitra</th>
              <th className="px-4 py-2 text-right font-medium">Debit</th>
              <th className="px-4 py-2 text-right font-medium">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {item.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  Belum ada item jurnal terposting pada periode ini.
                </td>
              </tr>
            )}
            {item.map((b) => (
              <tr key={b.id} className="border-b">
                <td className="px-4 py-1.5">{b.tanggal}</td>
                <td className="px-4 py-1.5">
                  <Link
                    href={`/akuntansi/jurnal/entri/${b.entryId}`}
                    className="font-mono text-xs underline"
                  >
                    {b.nomor}
                  </Link>
                </td>
                <td className="px-4 py-1.5">{b.jurnalKode}</td>
                <td className="px-4 py-1.5">
                  <span className="font-mono text-xs">{b.kodeAkun}</span> {b.namaAkun}
                </td>
                <td className="px-4 py-1.5">{b.label}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{b.namaPartner ?? '—'}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.debit)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.kredit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {item.length === BATAS && (
        <p className="mt-4 text-sm text-muted-foreground">
          Menampilkan {BATAS} baris pertama. Persempit rentang tanggal untuk melihat sisanya.
        </p>
      )}
    </>
  )
}
