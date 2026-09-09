import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { products, uoms, locations, billOfMaterials, journalEntries, stockOperations } from '@/db/schema'
import {
  ambilPerintahProduksi, biayaProduksi, operasiPerintahProduksi,
} from '@/modules/manufaktur/layanan/perintah-produksi'
import { LABEL_STATUS_PERINTAH_PRODUKSI } from '@/modules/manufaktur/validasi/produksi'
import { labelTipeOperasi, TIPE_KE_SLUG } from '@/modules/gudang/validasi/operasi'
import { formatAngka, formatRupiah } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirPerintah } from '../../formulir-perintah'
import { ambilDataPilihanManufaktur } from '../../data-pilihan'
import { AksiDraftPerintah, AksiPerintahDikonfirmasi } from './aksi-perintah'

export const metadata = { title: 'Detail Perintah Produksi' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  selesai: 'default', dikonfirmasi: 'default', draft: 'secondary', dibatalkan: 'outline',
}

export default async function HalamanDetailPerintah({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await wajibIzin('manufaktur.mo.lihat')
  const { id } = await params
  const perintah = await ambilPerintahProduksi(id)
  if (!perintah) notFound()

  const pilihan = await ambilDataPilihanManufaktur()

  if (perintah.status === 'draft') {
    return (
      <>
        <KepalaHalaman
          judul="Perintah Produksi Draft"
          deskripsi="Belum bernomor dan belum menyentuh stok sampai dikonfirmasi lalu diselesaikan."
        />
        <div className="mb-6"><AksiDraftPerintah id={perintah.id} /></div>
        <FormulirPerintah
          awal={{
            id: perintah.id,
            produkId: perintah.produkId,
            bomId: perintah.bomId ?? '',
            kuantitas: String(Number(perintah.kuantitas)),
            uomId: perintah.uomId,
            tanggal: perintah.tanggal,
            tanggalTarget: perintah.tanggalTarget ?? '',
            lokasiSumberId: perintah.lokasiSumberId,
            lokasiTujuanId: perintah.lokasiTujuanId,
            biayaTenagaKerja: String(Number(perintah.biayaTenagaKerja)),
            biayaOverhead: String(Number(perintah.biayaOverhead)),
            referensi: perintah.referensi ?? '',
            catatan: perintah.catatan ?? '',
            baris: perintah.baris.map((b) => ({
              produkId: b.produkId,
              kuantitas: String(Number(b.kuantitas)),
              uomId: b.uomId,
            })),
          }}
          {...pilihan}
        />
      </>
    )
  }

  const [biaya, operasi, semuaProduk, semuaSatuan, semuaLokasi] = await Promise.all([
    biayaProduksi(id),
    operasiPerintahProduksi(id),
    db.select({ id: products.id, kode: products.kode, nama: products.nama })
      .from(products).orderBy(asc(products.kode)),
    db.select({ id: uoms.id, nama: uoms.nama }).from(uoms),
    db.select({ id: locations.id, nama: locations.nama }).from(locations),
  ])

  const produkLewatId = new Map(semuaProduk.map((p) => [p.id, `${p.kode} — ${p.nama}`]))
  const satuanLewatId = new Map(semuaSatuan.map((s) => [s.id, s.nama]))
  const lokasiLewatId = new Map(semuaLokasi.map((l) => [l.id, l.nama]))

  const [resep] = perintah.bomId
    ? await db.select({ id: billOfMaterials.id, kode: billOfMaterials.kode })
        .from(billOfMaterials).where(eq(billOfMaterials.id, perintah.bomId)).limit(1)
    : [undefined]

  const [jurnalBiaya] = perintah.jurnalBiayaId
    ? await db.select({ id: journalEntries.id, nomor: journalEntries.nomor })
        .from(journalEntries).where(eq(journalEntries.id, perintah.jurnalBiayaId)).limit(1)
    : [undefined]

  const jurnalOperasi = await Promise.all(operasi.map(async (o) => {
    const [op] = await db.select({ jurnalEntryId: stockOperations.jurnalEntryId })
      .from(stockOperations).where(eq(stockOperations.id, o.operasiId)).limit(1)
    if (!op?.jurnalEntryId) return null
    const [entri] = await db.select({ id: journalEntries.id, nomor: journalEntries.nomor })
      .from(journalEntries).where(eq(journalEntries.id, op.jurnalEntryId)).limit(1)
    return entri ?? null
  }))

  return (
    <>
      <KepalaHalaman
        judul={perintah.nomor ?? 'Perintah Produksi'}
        deskripsi={perintah.catatan ?? undefined}
      />

      {perintah.status === 'dikonfirmasi' && (
        <div className="mb-6"><AksiPerintahDikonfirmasi id={perintah.id} /></div>
      )}

      <dl className="mb-6 grid gap-4 rounded-md border p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Bidang label="Status">
          <Badge variant={VARIAN[perintah.status]}>
            {LABEL_STATUS_PERINTAH_PRODUKSI[perintah.status]}
          </Badge>
        </Bidang>
        <Bidang label="Tanggal">{perintah.tanggal}</Bidang>
        <Bidang label="Target Selesai">{perintah.tanggalTarget ?? '—'}</Bidang>
        <Bidang label="Produk">{produkLewatId.get(perintah.produkId) ?? '—'}</Bidang>
        <Bidang label="Kuantitas">
          {formatAngka(perintah.kuantitas, 2)} {satuanLewatId.get(perintah.uomId) ?? ''}
        </Bidang>
        <Bidang label="Resep">{resep?.kode ?? 'Tanpa resep'}</Bidang>
        <Bidang label="Gudang Bahan">{lokasiLewatId.get(perintah.lokasiSumberId) ?? '—'}</Bidang>
        <Bidang label="Gudang Barang Jadi">
          {lokasiLewatId.get(perintah.lokasiTujuanId) ?? '—'}
        </Bidang>
        <Bidang label="Referensi">{perintah.referensi ?? '—'}</Bidang>
      </dl>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Kebutuhan Bahan</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Bahan</th>
                  <th className="px-4 py-2 text-right font-medium">Dibutuhkan</th>
                  <th className="px-4 py-2 text-right font-medium">Dikonsumsi</th>
                </tr>
              </thead>
              <tbody>
                {perintah.baris.map((b) => (
                  <tr key={b.id} className="border-b">
                    <td className="px-4 py-1.5">{produkLewatId.get(b.produkId) ?? '—'}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(b.kuantitas, 2)} {satuanLewatId.get(b.uomId) ?? ''}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(b.kuantitasDikonsumsi, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Harga Pokok Produksi</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <tbody>
                <BarisBiaya label="Bahan" nilai={biaya.bahan} />
                <BarisBiaya label="Tenaga Kerja Langsung" nilai={biaya.tenagaKerja} />
                <BarisBiaya label="Overhead Pabrik" nilai={biaya.overhead} />
                <tr className="border-t-2 bg-muted/40 font-semibold">
                  <td className="px-4 py-2">Total Biaya Produksi</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatRupiah(biaya.total)}</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-2">Harga Pokok per Satuan</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {biaya.hargaPokokSatuan ? formatRupiah(biaya.hargaPokokSatuan) : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {operasi.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Dokumen Terkait</h2>
          <div className="flex flex-wrap gap-4">
            {operasi.map((o, i) => (
              <p key={o.operasiId} className="rounded-md border bg-muted/40 px-4 py-2 text-sm">
                {labelTipeOperasi(o.tipe)}{' '}
                <Link
                  href={`/gudang/operasi/${TIPE_KE_SLUG[o.tipe]}/${o.operasiId}`}
                  className="font-medium underline"
                >
                  {o.nomor}
                </Link>
                {jurnalOperasi[i] && (
                  <>
                    {' · Jurnal '}
                    <Link
                      href={`/akuntansi/jurnal/entri/${jurnalOperasi[i]!.id}`}
                      className="font-medium underline"
                    >
                      {jurnalOperasi[i]!.nomor}
                    </Link>
                  </>
                )}
              </p>
            ))}
            {jurnalBiaya && (
              <p className="rounded-md border bg-muted/40 px-4 py-2 text-sm">
                Biaya Konversi{' '}
                <Link
                  href={`/akuntansi/jurnal/entri/${jurnalBiaya.id}`}
                  className="font-medium underline"
                >
                  {jurnalBiaya.nomor}
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      <Button asChild variant="outline">
        <Link href="/manufaktur/perintah-produksi">Kembali ke Daftar</Link>
      </Button>
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

function BarisBiaya({ label, nilai }: { label: string; nilai: string }) {
  return (
    <tr className="border-b">
      <td className="px-4 py-1.5">{label}</td>
      <td className="px-4 py-1.5 text-right tabular-nums">{formatRupiah(nilai)}</td>
    </tr>
  )
}
