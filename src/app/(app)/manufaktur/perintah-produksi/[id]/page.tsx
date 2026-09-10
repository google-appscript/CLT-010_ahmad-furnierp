import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import {
  products, uoms, locations, billOfMaterials, journalEntries, stockOperations,
} from '@/db/schema'
import {
  ambilPerintahProduksi, biayaProduksi, operasiPerintahProduksi,
} from '@/modules/manufaktur/layanan/perintah-produksi'
import { LABEL_STATUS_PERINTAH_PRODUKSI } from '@/modules/manufaktur/validasi/produksi'
import { labelTipeOperasi, TIPE_KE_SLUG } from '@/modules/gudang/validasi/operasi'
import { formatRupiah } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
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

  const draf = perintah.status === 'draft'
  const pilihan = await ambilDataPilihanManufaktur()

  const awal = {
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
      kuantitasDikonsumsi: String(Number(b.kuantitasDikonsumsi)),
    })),
  }

  if (draf) {
    return (
      <FormulirPerintah
        awal={awal}
        {...pilihan}
        aksiTambahan={<AksiDraftPerintah key="aksi-draft" id={perintah.id} />}
      />
    )
  }

  // Dokumen non-draft dapat merujuk produk/lokasi/resep yang sejak itu
  // dinonaktifkan — `pilihan` hanya berisi yang masih aktif, jadi tampilan
  // readonly memakai daftar tanpa filter aktif supaya nama tetap terlihat.
  const [biaya, operasi, semuaProduk, semuaSatuan, semuaLokasi, semuaResep] = await Promise.all([
    biayaProduksi(id),
    operasiPerintahProduksi(id),
    db.select({ id: products.id, kode: products.kode, nama: products.nama, uomId: products.uomId })
      .from(products).orderBy(asc(products.kode)),
    db.select({ id: uoms.id, kode: uoms.kode, nama: uoms.nama }).from(uoms).orderBy(asc(uoms.kode)),
    db.select({ id: locations.id, kode: locations.kode, nama: locations.nama }).from(locations).orderBy(asc(locations.kode)),
    db.select({
      id: billOfMaterials.id, kode: billOfMaterials.kode, nama: billOfMaterials.nama,
      produkId: billOfMaterials.produkId, kuantitas: billOfMaterials.kuantitas,
    }).from(billOfMaterials).orderBy(asc(billOfMaterials.kode)),
  ])

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

  const dokumenTerkait = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Harga Pokok Produksi</h3>
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
      </div>

      {(operasi.length > 0 || jurnalBiaya) && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Dokumen Terkait</h3>
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
        </div>
      )}
    </div>
  )

  return (
    <FormulirPerintah
      awal={awal}
      produk={semuaProduk}
      satuan={semuaSatuan}
      lokasi={semuaLokasi}
      resep={semuaResep}
      readOnly
      nomor={perintah.nomor ?? 'Perintah Produksi'}
      statusBadge={<Badge variant={VARIAN[perintah.status]}>{LABEL_STATUS_PERINTAH_PRODUKSI[perintah.status]}</Badge>}
      aksiTambahan={perintah.status === 'dikonfirmasi' ? <AksiPerintahDikonfirmasi key="aksi-dikonfirmasi" id={perintah.id} /> : undefined}
      dokumenTerkait={dokumenTerkait}
    />
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
