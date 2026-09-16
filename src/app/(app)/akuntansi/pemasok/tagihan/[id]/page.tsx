import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { accounts, journalEntries, partners, purchaseOrders, taxes } from '@/db/schema'
import { ambilTagihan, ringkasanTagihan } from '@/modules/pembelian/layanan/tagihan'
import { LABEL_STATUS_TAGIHAN, LABEL_TIPE_TAGIHAN } from '@/modules/pembelian/validasi/pesanan'
import { formatRupiah } from '@/lib/uang'
import { Button } from '@/components/ui/button'
import { LencanaStatus } from '@/components/data/lencana-status'
import { FormulirTagihan } from '../../formulir-tagihan'
import { ambilDataPilihanTagihan } from '../../data-pilihan'
import { AksiDraftTagihan } from './aksi-tagihan'
import { MenuFormulir } from '@/components/formulir/menu-formulir'
import { aksiDuplikatTagihan, aksiHapusTagihan } from '../../aksi'

export const metadata = { title: 'Detail Tagihan' }

export default async function HalamanDetailTagihan({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await wajibIzin('akuntansi.tagihan.lihat')
  const { id } = await params
  const tagihan = await ambilTagihan(id)
  if (!tagihan) notFound()

  const draf = tagihan.status === 'draft'
  const pilihan = await ambilDataPilihanTagihan()

  const awal = {
    id: tagihan.id,
    tipe: tagihan.tipe,
    partnerId: tagihan.partnerId,
    poId: tagihan.poId ?? '',
    tanggal: tagihan.tanggal,
    tanggalJatuhTempo: tagihan.tanggalJatuhTempo ?? '',
    referensiPemasok: tagihan.referensiPemasok ?? '',
    catatan: tagihan.catatan ?? '',
    baris: tagihan.baris.map((b) => ({
      produkId: b.produkId ?? '',
      poLineId: b.poLineId ?? '',
      deskripsi: b.deskripsi,
      kuantitas: String(Number(b.kuantitas)),
      hargaSatuan: String(Number(b.hargaSatuan)),
      taxId: b.taxId ?? '',
      akunId: b.akunId,
      proyekId: b.proyekId ?? '',
    })),
  }

  if (draf) {
    return (
      <FormulirTagihan
        awal={awal}
        {...pilihan}
        aksiTambahan={<AksiDraftTagihan key="aksi-draft" id={tagihan.id} />}
        menu={
          <MenuFormulir
            labelDokumen="Tagihan"
            onDuplikat={aksiDuplikatTagihan.bind(null, tagihan.id)}
            ruteDuplikat="/akuntansi/pemasok/tagihan/:id"
            onHapus={aksiHapusTagihan.bind(null, tagihan.id)}
          />
        }
      />
    )
  }

  // Dokumen non-draft dapat merujuk pemasok/akun/pajak yang sejak itu
  // dinonaktifkan — `pilihan` hanya berisi yang masih aktif, jadi tampilan
  // readonly memakai daftar tanpa filter aktif supaya nama tetap terlihat.
  const [ringkasan, semuaMitra, semuaAkun, semuaPajak] = await Promise.all([
    ringkasanTagihan(id),
    db.select({ id: partners.id, nama: partners.nama }).from(partners).orderBy(asc(partners.nama)),
    db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama }).from(accounts).orderBy(asc(accounts.kode)),
    db.select({ id: taxes.id, nama: taxes.nama, tarif: taxes.tarif, isPemotongan: taxes.isPemotongan }).from(taxes),
  ])

  const [jurnal] = tagihan.jurnalEntryId
    ? await db.select({ id: journalEntries.id, nomor: journalEntries.nomor })
        .from(journalEntries).where(eq(journalEntries.id, tagihan.jurnalEntryId)).limit(1)
    : [undefined]

  const [pesanan] = tagihan.poId
    ? await db.select({ id: purchaseOrders.id, nomor: purchaseOrders.nomor })
        .from(purchaseOrders).where(eq(purchaseOrders.id, tagihan.poId)).limit(1)
    : [undefined]

  const ringkasanTambahan = ringkasan && (
    <p className="text-sm text-muted-foreground">
      Terbayar {formatRupiah(ringkasan.terbayar)} · Sisa{' '}
      <span className={Number(ringkasan.sisa) > 0 ? 'font-medium text-foreground' : ''}>
        {formatRupiah(ringkasan.sisa)}
      </span>
    </p>
  )

  return (
    <FormulirTagihan
      awal={awal}
      pemasok={semuaMitra}
      akun={semuaAkun}
      pajak={semuaPajak}
      proyek={pilihan.proyek}
      readOnly
      nomor={tagihan.nomor ?? LABEL_TIPE_TAGIHAN[tagihan.tipe]}
      statusBadge={<LencanaStatus status={tagihan.status} label={LABEL_STATUS_TAGIHAN[tagihan.status]} />}
      aksiTambahan={ringkasan && Number(ringkasan.sisa) > 0 ? (
        <Button key="bayar" asChild>
          <Link href={`/akuntansi/pemasok/pembayaran?tagihan=${id}`}>Bayar</Link>
        </Button>
      ) : undefined}
      menu={
        <MenuFormulir
          labelDokumen="Tagihan"
          onDuplikat={aksiDuplikatTagihan.bind(null, tagihan.id)}
          ruteDuplikat="/akuntansi/pemasok/tagihan/:id"
        />
      }
      dokumenTerkait={{
        jurnal: jurnal ? { id: jurnal.id, nomor: jurnal.nomor ?? '—' } : undefined,
        pesanan: pesanan ? { id: pesanan.id, nomor: pesanan.nomor ?? '—' } : undefined,
        ringkasan: ringkasanTambahan,
      }}
    />
  )
}
