import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq, inArray } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { assetCategories, partners, journalEntries, accounts } from '@/db/schema'
import { ringkasanAset } from '@/modules/aset/layanan/aset'
import { LABEL_STATUS_ASET, LABEL_METODE } from '@/modules/aset/validasi/aset'
import { formatAngka, formatRupiah } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirAset } from '../formulir-aset'
import { ambilDataPilihanAset } from '../data-pilihan'
import { AksiDraftAset, DialogPelepasan, TombolPostingBaris } from './aksi-aset'

export const metadata = { title: 'Detail Aset' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  berjalan: 'default', selesai: 'default', draft: 'secondary', dilepas: 'outline',
}

export default async function HalamanDetailAset({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await wajibIzin('akuntansi.aset.lihat')
  const { id } = await params
  const aset = await ringkasanAset(id)
  if (!aset) notFound()

  const { kategori, mitra, akunKas } = await ambilDataPilihanAset()

  if (aset.status === 'draft') {
    return (
      <>
        <KepalaHalaman
          judul={`${aset.kode} — ${aset.nama}`}
          deskripsi="Aset masih draft; jadwal depresiasinya baru tersusun saat dijalankan."
        />
        <div className="mb-6"><AksiDraftAset id={aset.id} /></div>
        <FormulirAset
          awal={{
            id: aset.id,
            kode: aset.kode,
            nama: aset.nama,
            kategoriId: aset.kategoriId,
            tanggalPerolehan: aset.tanggalPerolehan,
            tanggalMulaiDepresiasi: aset.tanggalMulaiDepresiasi,
            nilaiPerolehan: String(Number(aset.nilaiPerolehan)),
            nilaiResidu: String(Number(aset.nilaiResidu)),
            masaManfaatBulan: String(aset.masaManfaatBulan),
            metode: aset.metode,
            partnerId: aset.partnerId ?? '',
            referensi: aset.referensi ?? '',
            catatan: aset.catatan ?? '',
          }}
          kategori={kategori}
          mitra={mitra}
        />
      </>
    )
  }

  const [kategoriAset] = await db.select().from(assetCategories)
    .where(eq(assetCategories.id, aset.kategoriId)).limit(1)

  const [mitraAset] = aset.partnerId
    ? await db.select({ nama: partners.nama }).from(partners)
        .where(eq(partners.id, aset.partnerId)).limit(1)
    : [undefined]

  const [jurnalPelepasan] = aset.jurnalPelepasanId
    ? await db.select({ id: journalEntries.id, nomor: journalEntries.nomor })
        .from(journalEntries).where(eq(journalEntries.id, aset.jurnalPelepasanId)).limit(1)
    : [undefined]

  const idJurnalBaris = aset.baris.map((b) => b.jurnalEntryId).filter((x): x is string => !!x)
  const jurnalBaris = idJurnalBaris.length > 0
    ? await db.select({ id: journalEntries.id, nomor: journalEntries.nomor })
        .from(journalEntries).where(inArray(journalEntries.id, idJurnalBaris))
    : []
  const nomorJurnal = new Map(jurnalBaris.map((j) => [j.id, j.nomor]))

  const akunLewatId = new Map(
    (await db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama }).from(accounts))
      .map((a) => [a.id, `${a.kode} — ${a.nama}`]),
  )

  const barisBerikut = aset.baris.find((b) => b.status === 'draft')

  return (
    <>
      <KepalaHalaman
        judul={`${aset.kode} — ${aset.nama}`}
        deskripsi={aset.catatan ?? undefined}
        aksi={aset.status !== 'dilepas' ? (
          <DialogPelepasan id={aset.id} nilaiBuku={aset.nilaiBuku} akunKas={akunKas} />
        ) : undefined}
      />

      <dl className="mb-6 grid gap-4 rounded-md border p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Bidang label="Status">
          <Badge variant={VARIAN[aset.status]}>{LABEL_STATUS_ASET[aset.status]}</Badge>
        </Bidang>
        <Bidang label="Kategori">{kategoriAset?.nama ?? '—'}</Bidang>
        <Bidang label="Tanggal Perolehan">{aset.tanggalPerolehan}</Bidang>
        <Bidang label="Mulai Disusutkan">{aset.tanggalMulaiDepresiasi}</Bidang>
        <Bidang label="Metode">{LABEL_METODE[aset.metode]}</Bidang>
        <Bidang label="Masa Manfaat">{aset.masaManfaatBulan} bulan</Bidang>
        <Bidang label="Nilai Perolehan">{formatRupiah(aset.nilaiPerolehan)}</Bidang>
        <Bidang label="Nilai Residu">{formatRupiah(aset.nilaiResidu)}</Bidang>
        <Bidang label="Akumulasi Depresiasi">{formatRupiah(aset.akumulasi)}</Bidang>
        <Bidang label="Nilai Buku">{formatRupiah(aset.nilaiBuku)}</Bidang>
        <Bidang label="Pemasok">{mitraAset?.nama ?? '—'}</Bidang>
        <Bidang label="Referensi">{aset.referensi ?? '—'}</Bidang>
      </dl>

      <div className="mb-6 flex flex-wrap gap-4">
        <p className="rounded-md border bg-muted/40 px-4 py-2 text-sm">
          Akun aset {akunLewatId.get(kategoriAset!.akunAsetId) ?? '—'}
          {kategoriAset?.akunAkumulasiId && (
            <> · Akumulasi {akunLewatId.get(kategoriAset.akunAkumulasiId)}</>
          )}
          {kategoriAset?.akunBebanId && (
            <> · Beban {akunLewatId.get(kategoriAset.akunBebanId)}</>
          )}
        </p>
        {aset.status === 'dilepas' && (
          <p className="rounded-md border bg-muted/40 px-4 py-2 text-sm">
            Dilepas {aset.tanggalPelepasan} senilai {formatRupiah(aset.nilaiPelepasan ?? '0')}
            {jurnalPelepasan && (
              <>
                {' · Jurnal '}
                <Link
                  href={`/akuntansi/jurnal/entri/${jurnalPelepasan.id}`}
                  className="font-medium underline"
                >
                  {jurnalPelepasan.nomor}
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Jadwal Depresiasi ({aset.sudahDiposting} dari {aset.totalBaris} bulan sudah diposting)
      </h2>

      {aset.baris.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Kategori {kategoriAset?.nama} tidak disusutkan, jadi aset ini tidak memiliki jadwal
          depresiasi.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-right font-medium">Bulan</th>
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-right font-medium">Beban</th>
                <th className="px-4 py-2 text-right font-medium">Akumulasi</th>
                <th className="px-4 py-2 text-right font-medium">Nilai Buku</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Jurnal</th>
                <th className="w-24 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {aset.baris.map((b) => (
                <tr key={b.id} className="border-b">
                  <td className="px-4 py-1.5 text-right tabular-nums">{b.urutan}</td>
                  <td className="px-4 py-1.5">{b.tanggal}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.nilai)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(b.akumulasi)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(b.nilaiBuku)}
                  </td>
                  <td className="px-4 py-1.5">
                    <Badge variant={b.status === 'diposting' ? 'default' : 'secondary'}>
                      {b.status === 'diposting' ? 'Diposting' : 'Draft'}
                    </Badge>
                  </td>
                  <td className="px-4 py-1.5 font-mono text-xs">
                    {b.jurnalEntryId ? (
                      <Link
                        href={`/akuntansi/jurnal/entri/${b.jurnalEntryId}`}
                        className="underline"
                      >
                        {nomorJurnal.get(b.jurnalEntryId)}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    {b.id === barisBerikut?.id && aset.status === 'berjalan' && (
                      <TombolPostingBaris id={b.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/akuntansi/aset">Kembali ke Daftar</Link>
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
