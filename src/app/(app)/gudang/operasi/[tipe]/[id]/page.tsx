import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { locations, stockMoves, journalEntries } from '@/db/schema'
import { ambilOperasi, nilaiOperasi } from '@/modules/gudang/layanan/operasi'
import {
  SLUG_KE_TIPE, labelTipeOperasi, LABEL_STATUS_OPERASI,
} from '@/modules/gudang/validasi/operasi'
import { formatAngka, formatRupiah } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirOperasi } from '../../formulir-operasi'
import { ambilDataPilihan } from '../../data-pilihan'
import { AksiDraftOperasi } from './aksi-operasi'

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  selesai: 'default', draft: 'secondary', dibatalkan: 'outline',
}

const IZIN: Record<string, string> = {
  penerimaan: 'gudang.penerimaan.kelola',
  pengiriman: 'gudang.pengiriman.kelola',
  transfer: 'gudang.transfer.kelola',
  barang_rusak: 'gudang.scrap.kelola',
  opname: 'gudang.opname.kelola',
  // Operasi produksi hanya dapat dilihat oleh yang berhak atas perintahnya.
  konsumsi_produksi: 'manufaktur.mo.lihat',
  hasil_produksi: 'manufaktur.mo.lihat',
}

export default async function HalamanDetailOperasi({
  params,
}: {
  params: Promise<{ tipe: string; id: string }>
}) {
  const { tipe: slug, id } = await params
  const tipe = SLUG_KE_TIPE[slug]
  if (!tipe) notFound()

  await wajibIzin(IZIN[tipe])
  const operasi = await ambilOperasi(id)
  if (!operasi) notFound()

  const { daftarProduk, daftarLokasi, daftarSatuan, daftarMitra } = await ambilDataPilihan()

  // Draft masih dapat diubah, jadi ditampilkan sebagai formulir.
  if (operasi.status === 'draft') {
    return (
      <>
        <KepalaHalaman
          judul={`${labelTipeOperasi(tipe)} Draft`}
          deskripsi="Draft belum bernomor dan belum menyentuh stok sampai diselesaikan."
        />
        <div className="mb-6"><AksiDraftOperasi id={operasi.id} tipe={tipe} /></div>
        <FormulirOperasi
          awal={{
            id: operasi.id,
            tipe,
            tanggal: operasi.tanggal,
            lokasiAsalId: operasi.lokasiAsalId,
            lokasiTujuanId: operasi.lokasiTujuanId,
            partnerId: operasi.partnerId ?? '',
            referensi: operasi.referensi ?? '',
            catatan: operasi.catatan ?? '',
            baris: operasi.baris.map((b) => ({
              produkId: b.produkId,
              kuantitas: String(Number(b.kuantitas)),
              uomId: b.uomId,
              hargaSatuan: b.hargaSatuan ? String(Number(b.hargaSatuan)) : '',
              catatan: b.catatan ?? '',
            })),
          }}
          produk={daftarProduk}
          lokasi={daftarLokasi}
          satuan={daftarSatuan}
          mitra={daftarMitra}
        />
      </>
    )
  }

  const [gerak, nilai] = await Promise.all([
    db.select({
      id: stockMoves.id,
      produkId: stockMoves.produkId,
      kuantitas: stockMoves.kuantitas,
      hargaPokokSatuan: stockMoves.hargaPokokSatuan,
      nilaiTotal: stockMoves.nilaiTotal,
      namaAsal: locations.nama,
    })
      .from(stockMoves)
      .innerJoin(locations, eq(locations.id, stockMoves.lokasiAsalId))
      .where(eq(stockMoves.operasiId, id))
      .orderBy(asc(stockMoves.dibuatPada)),
    nilaiOperasi(id),
  ])

  const produkLewatId = new Map(daftarProduk.map((p) => [p.id, p]))
  const satuanLewatId = new Map(daftarSatuan.map((s) => [s.id, s]))
  const lokasiLewatId = new Map(daftarLokasi.map((l) => [l.id, l.nama]))
  const mitraLewatId = new Map(daftarMitra.map((m) => [m.id, m.nama]))

  const [jurnal] = operasi.jurnalEntryId
    ? await db.select({ id: journalEntries.id, nomor: journalEntries.nomor })
        .from(journalEntries).where(eq(journalEntries.id, operasi.jurnalEntryId)).limit(1)
    : [undefined]

  return (
    <>
      <KepalaHalaman judul={operasi.nomor ?? labelTipeOperasi(tipe)} deskripsi={operasi.catatan ?? undefined} />

      <dl className="mb-6 grid gap-4 rounded-md border p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Bidang label="Status">
          <Badge variant={VARIAN[operasi.status]}>{LABEL_STATUS_OPERASI[operasi.status]}</Badge>
        </Bidang>
        <Bidang label="Tanggal">{operasi.tanggal}</Bidang>
        <Bidang label="Dari">{lokasiLewatId.get(operasi.lokasiAsalId) ?? '—'}</Bidang>
        <Bidang label="Ke">{lokasiLewatId.get(operasi.lokasiTujuanId) ?? '—'}</Bidang>
        <Bidang label="Mitra">
          {operasi.partnerId ? mitraLewatId.get(operasi.partnerId) ?? '—' : '—'}
        </Bidang>
        <Bidang label="Nilai">{formatRupiah(nilai)}</Bidang>
      </dl>

      {jurnal ? (
        <p className="mb-6 rounded-md border bg-muted/40 p-4 text-sm">
          Jurnal{' '}
          <Link href={`/akuntansi/jurnal/entri/${jurnal.id}`} className="font-medium underline">
            {jurnal.nomor}
          </Link>{' '}
          sudah diposting untuk operasi ini.
        </p>
      ) : (
        <p className="mb-6 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
          Operasi ini tidak menghasilkan jurnal karena nilai persediaan perusahaan tidak berubah.
        </p>
      )}

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Pergerakan Stok</h2>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Produk</th>
              <th className="px-4 py-2 text-left font-medium">Dari</th>
              <th className="px-4 py-2 text-right font-medium">Kuantitas</th>
              <th className="px-4 py-2 text-right font-medium">Harga Pokok</th>
              <th className="px-4 py-2 text-right font-medium">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {gerak.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  Tidak ada pergerakan stok pada operasi ini.
                </td>
              </tr>
            )}
            {gerak.map((g) => {
              const p = produkLewatId.get(g.produkId)
              const s = p ? satuanLewatId.get(p.uomId) : undefined
              return (
                <tr key={g.id} className="border-b">
                  <td className="px-4 py-1.5">
                    <span className="font-mono text-xs">{p?.kode}</span> {p?.nama}
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">{g.namaAsal}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(g.kuantitas, 2)} {s?.nama}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(g.hargaPokokSatuan, 2)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(g.nilaiTotal)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href={`/gudang/operasi/${slug}`}>Kembali ke Daftar</Link>
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
