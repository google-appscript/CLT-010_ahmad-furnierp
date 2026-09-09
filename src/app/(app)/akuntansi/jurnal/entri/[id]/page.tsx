import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { journalEntries } from '@/db/schema'
import { ambilEntri } from '@/modules/akuntansi/layanan/entri'
import { daftarAkun } from '@/modules/akuntansi/layanan/akun'
import { daftarJurnal } from '@/modules/akuntansi/layanan/jurnal'
import { daftarPartner } from '@/modules/akuntansi/layanan/partner'
import { daftarProyek } from '@/modules/proyek/layanan/proyek'
import { LABEL_STATUS } from '@/modules/akuntansi/validasi/entri'
import { formatAngka, tambah } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirEntri } from '../formulir-entri'
import { AksiDraft, AksiBalik } from './aksi-entri'

export const metadata = { title: 'Detail Entri Jurnal' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  diposting: 'default', draft: 'secondary', dibatalkan: 'outline',
}

export default async function HalamanDetailEntri({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await wajibIzin('akuntansi.jurnal.lihat')
  const { id } = await params
  const entri = await ambilEntri(id)
  if (!entri) notFound()

  const [akun, jurnal, partner, proyek] = await Promise.all([
    daftarAkun(), daftarJurnal(), daftarPartner(), daftarProyek(),
  ])
  const akunLewatId = new Map(akun.map((a) => [a.id, a]))
  const partnerLewatId = new Map(partner.map((p) => [p.id, p]))
  const proyekLewatId = new Map(proyek.map((p) => [p.id, p]))
  const kodeJurnal = jurnal.find((j) => j.id === entri.journalId)?.kode ?? '—'

  const [pembalik] = await db
    .select({ id: journalEntries.id, nomor: journalEntries.nomor })
    .from(journalEntries)
    .where(eq(journalEntries.membalikEntryId, entri.id))
    .limit(1)

  const [asal] = entri.membalikEntryId
    ? await db.select({ id: journalEntries.id, nomor: journalEntries.nomor })
        .from(journalEntries).where(eq(journalEntries.id, entri.membalikEntryId)).limit(1)
    : [undefined]

  const totalDebit = tambah(...entri.item.map((b) => b.debit))
  const totalKredit = tambah(...entri.item.map((b) => b.kredit))

  // Draft masih dapat diubah, jadi ditampilkan sebagai formulir.
  if (entri.status === 'draft') {
    return (
      <>
        <KepalaHalaman
          judul="Entri Jurnal Draft"
          deskripsi="Draft belum bernomor dan belum masuk laporan sampai diposting."
        />
        <div className="mb-6">
          <AksiDraft id={entri.id} />
        </div>
        <FormulirEntri
          awal={{
            id: entri.id,
            journalId: entri.journalId,
            tanggal: entri.tanggal,
            referensi: entri.referensi ?? '',
            keterangan: entri.keterangan ?? '',
            partnerId: entri.partnerId ?? '',
            item: entri.item.map((b) => ({
              accountId: b.accountId,
              label: b.label,
              debit: Number(b.debit) === 0 ? '' : String(Number(b.debit)),
              kredit: Number(b.kredit) === 0 ? '' : String(Number(b.kredit)),
              partnerId: b.partnerId ?? '',
              projectId: b.projectId ?? '',
            })),
          }}
          akun={akun.filter((a) => a.isActive).map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }))}
          jurnal={jurnal.filter((j) => j.isActive).map((j) => ({ id: j.id, kode: j.kode, nama: j.nama }))}
          partner={partner.filter((p) => p.isActive).map((p) => ({ id: p.id, nama: p.nama }))}
          proyek={proyek
            .filter((p) => p.status !== 'dibatalkan')
            .map((p) => ({ id: p.id, kode: p.kode, nama: p.nama }))}
        />
      </>
    )
  }

  return (
    <>
      <KepalaHalaman
        judul={entri.nomor ?? 'Entri Jurnal'}
        deskripsi={entri.keterangan ?? undefined}
        aksi={
          entri.status === 'diposting' && !pembalik
            ? <AksiBalik id={entri.id} nomor={entri.nomor ?? ''} />
            : undefined
        }
      />

      <dl className="mb-6 grid gap-4 rounded-md border p-4 sm:grid-cols-4">
        <Bidang label="Status">
          <Badge variant={VARIAN[entri.status]}>{LABEL_STATUS[entri.status]}</Badge>
        </Bidang>
        <Bidang label="Tanggal">{entri.tanggal}</Bidang>
        <Bidang label="Jurnal">{kodeJurnal}</Bidang>
        <Bidang label="Referensi">{entri.referensi ?? '—'}</Bidang>
      </dl>

      {pembalik && (
        <p className="mb-6 rounded-md border bg-muted/40 p-4 text-sm">
          Entri ini sudah dibalik oleh{' '}
          <Link href={`/akuntansi/jurnal/entri/${pembalik.id}`} className="font-medium underline">
            {pembalik.nomor}
          </Link>. Saldo gabungan keduanya nol.
        </p>
      )}

      {asal && (
        <p className="mb-6 rounded-md border bg-muted/40 p-4 text-sm">
          Entri ini membalik{' '}
          <Link href={`/akuntansi/jurnal/entri/${asal.id}`} className="font-medium underline">
            {asal.nomor}
          </Link>.
        </p>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Akun</th>
              <th className="px-4 py-2 text-left font-medium">Keterangan</th>
              <th className="px-4 py-2 text-left font-medium">Mitra</th>
              <th className="px-4 py-2 text-left font-medium">Proyek</th>
              <th className="px-4 py-2 text-right font-medium">Debit</th>
              <th className="px-4 py-2 text-right font-medium">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {entri.item.map((b) => {
              const a = akunLewatId.get(b.accountId)
              return (
                <tr key={b.id} className="border-b">
                  <td className="px-4 py-1.5">
                    <span className="font-mono text-xs">{a?.kode}</span> {a?.nama}
                  </td>
                  <td className="px-4 py-1.5">{b.label}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {b.partnerId ? partnerLewatId.get(b.partnerId)?.nama ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {b.projectId ? proyekLewatId.get(b.projectId)?.kode ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.debit)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.kredit)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t-2 bg-muted/40 font-semibold">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatAngka(totalDebit)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatAngka(totalKredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/akuntansi/jurnal/entri">Kembali ke Daftar</Link>
        </Button>
      </div>
    </>
  )
}

function Bidang({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  )
}
