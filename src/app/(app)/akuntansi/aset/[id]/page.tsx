import { notFound } from 'next/navigation'
import { asc, eq, inArray } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { assetCategories, partners, journalEntries, accounts } from '@/db/schema'
import { ringkasanAset } from '@/modules/aset/layanan/aset'
import { LABEL_STATUS_ASET } from '@/modules/aset/validasi/aset'
import { formatRupiah } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { FormulirAset, type BarisJadwal } from '../formulir-aset'
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

  const draf = aset.status === 'draft'
  const { kategori, mitra, akunKas } = await ambilDataPilihanAset()

  const awal = {
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
  }

  if (draf) {
    return (
      <FormulirAset
        awal={awal}
        kategori={kategori}
        mitra={mitra}
        aksiTambahan={<AksiDraftAset key="aksi-draft" id={aset.id} />}
      />
    )
  }

  // Dokumen non-draft dapat merujuk kategori/mitra yang sejak itu
  // dinonaktifkan — `kategori`/`mitra` dari ambilDataPilihanAset() hanya
  // berisi yang masih aktif (benar untuk mengisi dropdown saat mengedit
  // draft), jadi tampilan readonly memakai daftar tanpa filter aktif.
  const [kategoriAset] = await db.select().from(assetCategories)
    .where(eq(assetCategories.id, aset.kategoriId)).limit(1)
  const semuaKategori = await db.select({
    id: assetCategories.id, kode: assetCategories.kode, nama: assetCategories.nama,
    dapatDidepresiasi: assetCategories.dapatDidepresiasi,
    metodeBawaan: assetCategories.metodeBawaan,
    masaManfaatBulanBawaan: assetCategories.masaManfaatBulanBawaan,
  }).from(assetCategories).orderBy(asc(assetCategories.kode))
  const semuaMitra = await db.select({ id: partners.id, nama: partners.nama })
    .from(partners).orderBy(asc(partners.nama))

  const idJurnalBaris = aset.baris.map((b) => b.jurnalEntryId).filter((x): x is string => !!x)
  const jurnalBaris = idJurnalBaris.length > 0
    ? await db.select({ id: journalEntries.id, nomor: journalEntries.nomor })
        .from(journalEntries).where(inArray(journalEntries.id, idJurnalBaris))
    : []
  const nomorJurnal = new Map(jurnalBaris.map((j) => [j.id, j.nomor ?? '—']))

  const akunLewatId = new Map(
    (await db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama }).from(accounts))
      .map((a) => [a.id, `${a.kode} — ${a.nama}`]),
  )

  const barisBerikut = aset.baris.find((b) => b.status === 'draft')

  const jadwal: BarisJadwal[] = aset.baris.map((b) => ({
    id: b.id,
    urutan: b.urutan,
    tanggal: b.tanggal,
    nilai: b.nilai,
    akumulasi: b.akumulasi,
    nilaiBuku: b.nilaiBuku,
    status: b.status,
    nomorJurnal: b.jurnalEntryId ? nomorJurnal.get(b.jurnalEntryId) : undefined,
    jurnalEntryId: b.jurnalEntryId ?? undefined,
    tombolPosting: b.id === barisBerikut?.id && aset.status === 'berjalan'
      ? <TombolPostingBaris id={b.id} />
      : undefined,
  }))

  const ringkasanTambahan = (
    <div className="flex flex-wrap gap-4">
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
        </p>
      )}
    </div>
  )

  return (
    <FormulirAset
      awal={awal}
      kategori={semuaKategori}
      mitra={semuaMitra}
      readOnly
      statusBadge={<Badge variant={VARIAN[aset.status]}>{LABEL_STATUS_ASET[aset.status]}</Badge>}
      aksiTambahan={aset.status !== 'dilepas' ? (
        <DialogPelepasan key="aksi-pelepasan" id={aset.id} nilaiBuku={aset.nilaiBuku} akunKas={akunKas} />
      ) : undefined}
      ringkasanTambahan={ringkasanTambahan}
      jadwal={aset.baris.length > 0 ? jadwal : []}
    />
  )
}
