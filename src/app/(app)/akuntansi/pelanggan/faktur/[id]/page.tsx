import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { partners, accounts, taxes, journalEntries, salesOrders } from '@/db/schema'
import { ambilFaktur, ringkasanFaktur, totalFaktur } from '@/modules/penjualan/layanan/faktur'
import { LABEL_STATUS_FAKTUR, LABEL_TIPE_FAKTUR } from '@/modules/penjualan/validasi/pesanan'
import { formatAngka, formatRupiah } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirFaktur } from '../../formulir-faktur'
import { ambilDataPilihanFaktur } from '../../data-pilihan'
import { AksiDraftFaktur } from './aksi-faktur'

export const metadata = { title: 'Detail Faktur' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  diposting: 'default', draft: 'secondary', dibatalkan: 'outline',
}

export default async function HalamanDetailFaktur({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await wajibIzin('akuntansi.faktur.lihat')
  const { id } = await params
  const faktur = await ambilFaktur(id)
  if (!faktur) notFound()

  const pilihan = await ambilDataPilihanFaktur()

  if (faktur.status === 'draft') {
    return (
      <>
        <KepalaHalaman
          judul={`${LABEL_TIPE_FAKTUR[faktur.tipe]} Draft`}
          deskripsi="Belum bernomor dan belum menyentuh buku besar sampai diposting."
        />
        <div className="mb-6"><AksiDraftFaktur id={faktur.id} /></div>
        <FormulirFaktur
          awal={{
            id: faktur.id,
            tipe: faktur.tipe,
            partnerId: faktur.partnerId,
            soId: faktur.soId ?? '',
            tanggal: faktur.tanggal,
            tanggalJatuhTempo: faktur.tanggalJatuhTempo ?? '',
            referensi: faktur.referensi ?? '',
            catatan: faktur.catatan ?? '',
            baris: faktur.baris.map((b) => ({
              produkId: b.produkId ?? '',
              soLineId: b.soLineId ?? '',
              deskripsi: b.deskripsi,
              kuantitas: String(Number(b.kuantitas)),
              hargaSatuan: String(Number(b.hargaSatuan)),
              taxId: b.taxId ?? '',
              akunId: b.akunId,
            })),
          }}
          {...pilihan}
        />
      </>
    )
  }

  const [ringkasan, total, semuaMitra, semuaAkun, semuaPajak] = await Promise.all([
    ringkasanFaktur(id),
    totalFaktur(id),
    db.select({ id: partners.id, nama: partners.nama }).from(partners),
    db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama }).from(accounts),
    db.select({ id: taxes.id, nama: taxes.nama }).from(taxes),
  ])

  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))
  const akunLewatId = new Map(semuaAkun.map((a) => [a.id, `${a.kode} — ${a.nama}`]))
  const pajakLewatId = new Map(semuaPajak.map((p) => [p.id, p.nama]))

  const [jurnal] = faktur.jurnalEntryId
    ? await db.select({ id: journalEntries.id, nomor: journalEntries.nomor })
        .from(journalEntries).where(eq(journalEntries.id, faktur.jurnalEntryId)).limit(1)
    : [undefined]

  const [pesanan] = faktur.soId
    ? await db.select({ id: salesOrders.id, nomor: salesOrders.nomor })
        .from(salesOrders).where(eq(salesOrders.id, faktur.soId)).limit(1)
    : [undefined]

  return (
    <>
      <KepalaHalaman
        judul={faktur.nomor ?? LABEL_TIPE_FAKTUR[faktur.tipe]}
        deskripsi={faktur.catatan ?? undefined}
        aksi={
          ringkasan && Number(ringkasan.sisa) > 0 ? (
            <Button asChild>
              <Link href={`/akuntansi/pelanggan/pembayaran?faktur=${id}`}>Terima Pembayaran</Link>
            </Button>
          ) : undefined
        }
      />

      <dl className="mb-6 grid gap-4 rounded-md border p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Bidang label="Status">
          <Badge variant={VARIAN[faktur.status]}>{LABEL_STATUS_FAKTUR[faktur.status]}</Badge>
        </Bidang>
        <Bidang label="Jenis">{LABEL_TIPE_FAKTUR[faktur.tipe]}</Bidang>
        <Bidang label="Tanggal">{faktur.tanggal}</Bidang>
        <Bidang label="Jatuh Tempo">{faktur.tanggalJatuhTempo ?? '—'}</Bidang>
        <Bidang label="Pelanggan">{mitraLewatId.get(faktur.partnerId) ?? '—'}</Bidang>
        <Bidang label="Referensi">{faktur.referensi ?? '—'}</Bidang>
      </dl>

      <div className="mb-6 flex flex-wrap gap-4">
        {jurnal && (
          <p className="rounded-md border bg-muted/40 px-4 py-2 text-sm">
            Jurnal{' '}
            <Link href={`/akuntansi/jurnal/entri/${jurnal.id}`} className="font-medium underline">
              {jurnal.nomor}
            </Link>
          </p>
        )}
        {pesanan && (
          <p className="rounded-md border bg-muted/40 px-4 py-2 text-sm">
            Pesanan{' '}
            <Link href={`/penjualan/pesanan/${pesanan.id}`} className="font-medium underline">
              {pesanan.nomor}
            </Link>
          </p>
        )}
        {ringkasan && (
          <p className="rounded-md border bg-muted/40 px-4 py-2 text-sm">
            Diterima {formatRupiah(ringkasan.terbayar)} · Sisa{' '}
            <span className={Number(ringkasan.sisa) > 0 ? 'font-medium' : ''}>
              {formatRupiah(ringkasan.sisa)}
            </span>
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Deskripsi</th>
              <th className="px-4 py-2 text-left font-medium">Akun</th>
              <th className="px-4 py-2 text-right font-medium">Kuantitas</th>
              <th className="px-4 py-2 text-right font-medium">Harga Satuan</th>
              <th className="px-4 py-2 text-left font-medium">Pajak</th>
              <th className="px-4 py-2 text-right font-medium">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {faktur.baris.map((b, i) => (
              <tr key={b.id} className="border-b">
                <td className="px-4 py-1.5">{b.deskripsi}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{akunLewatId.get(b.akunId)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(b.kuantitas, 2)}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(b.hargaSatuan, 2)}
                </td>
                <td className="px-4 py-1.5 text-muted-foreground">
                  {b.taxId ? pajakLewatId.get(b.taxId) ?? '—' : '—'}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(total.baris[i].totalBaris)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/40">
            <tr>
              <td colSpan={5} className="px-4 py-1.5 text-right">Dasar Pengenaan Pajak</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(total.totalDpp)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-1.5 text-right">PPN Keluaran</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(total.totalPpn)}</td>
            </tr>
            <tr className="font-semibold">
              <td colSpan={5} className="px-4 py-2 text-right">Total Faktur</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatAngka(total.totalTagihan)}</td>
            </tr>
            {Number(total.totalPemotongan) > 0 && (
              <>
                <tr>
                  <td colSpan={5} className="px-4 py-1.5 text-right">
                    PPh Dipotong Pelanggan
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    -{formatAngka(total.totalPemotongan)}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td colSpan={5} className="px-4 py-2 text-right">Diterima dari Pelanggan</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatAngka(total.totalDibayar)}
                  </td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>

      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/akuntansi/pelanggan/faktur">Kembali ke Daftar</Link>
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
