import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { accounts, journalEntries, partners, salesOrders, taxes } from '@/db/schema'
import { ambilFaktur, ringkasanFaktur } from '@/modules/penjualan/layanan/faktur'
import { LABEL_STATUS_FAKTUR, LABEL_TIPE_FAKTUR } from '@/modules/penjualan/validasi/pesanan'
import { formatRupiah } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

  const draf = faktur.status === 'draft'
  const pilihan = await ambilDataPilihanFaktur()

  const awal = {
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
  }

  if (draf) {
    return (
      <FormulirFaktur
        awal={awal}
        {...pilihan}
        aksiTambahan={<AksiDraftFaktur key="aksi-draft" id={faktur.id} />}
      />
    )
  }

  // Dokumen non-draft dapat merujuk pelanggan/akun/pajak yang sejak itu
  // dinonaktifkan — `pilihan` hanya berisi yang masih aktif, jadi tampilan
  // readonly memakai daftar tanpa filter aktif supaya nama tetap terlihat.
  const [ringkasan, semuaMitra, semuaAkun, semuaPajak] = await Promise.all([
    ringkasanFaktur(id),
    db.select({ id: partners.id, nama: partners.nama }).from(partners).orderBy(asc(partners.nama)),
    db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama }).from(accounts).orderBy(asc(accounts.kode)),
    db.select({ id: taxes.id, nama: taxes.nama, tarif: taxes.tarif, isPemotongan: taxes.isPemotongan }).from(taxes),
  ])

  const [jurnal] = faktur.jurnalEntryId
    ? await db.select({ id: journalEntries.id, nomor: journalEntries.nomor })
        .from(journalEntries).where(eq(journalEntries.id, faktur.jurnalEntryId)).limit(1)
    : [undefined]

  const [pesanan] = faktur.soId
    ? await db.select({ id: salesOrders.id, nomor: salesOrders.nomor })
        .from(salesOrders).where(eq(salesOrders.id, faktur.soId)).limit(1)
    : [undefined]

  const ringkasanTambahan = ringkasan && (
    <p className="text-sm text-muted-foreground">
      Diterima {formatRupiah(ringkasan.terbayar)} · Sisa{' '}
      <span className={Number(ringkasan.sisa) > 0 ? 'font-medium text-foreground' : ''}>
        {formatRupiah(ringkasan.sisa)}
      </span>
    </p>
  )

  return (
    <FormulirFaktur
      awal={awal}
      pelanggan={semuaMitra}
      akun={semuaAkun}
      pajak={semuaPajak}
      readOnly
      nomor={faktur.nomor ?? LABEL_TIPE_FAKTUR[faktur.tipe]}
      statusBadge={<Badge variant={VARIAN[faktur.status]}>{LABEL_STATUS_FAKTUR[faktur.status]}</Badge>}
      aksiTambahan={ringkasan && Number(ringkasan.sisa) > 0 ? (
        <Button key="terima-pembayaran" asChild>
          <Link href={`/akuntansi/pelanggan/pembayaran?faktur=${id}`}>Terima Pembayaran</Link>
        </Button>
      ) : undefined}
      dokumenTerkait={{
        jurnal: jurnal ? { id: jurnal.id, nomor: jurnal.nomor ?? '—' } : undefined,
        pesanan: pesanan ? { id: pesanan.id, nomor: pesanan.nomor ?? '—' } : undefined,
        ringkasan: ringkasanTambahan,
      }}
    />
  )
}
