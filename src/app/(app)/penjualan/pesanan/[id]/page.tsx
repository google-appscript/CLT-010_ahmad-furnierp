import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { FolderKanban } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import {
  customerInvoices, locations, partners, paymentTerms, projects, taxes,
} from '@/db/schema'
import { ambilPesanan, barisDenganSisa } from '@/modules/penjualan/layanan/pesanan'
import { pengirimanPesanan } from '@/modules/penjualan/layanan/pengiriman'
import { LABEL_STATUS_PENJUALAN } from '@/modules/penjualan/validasi/pesanan'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormulirPesanan } from '../../formulir-pesanan'
import { ambilDataPilihanPenjualan } from '../../data-pilihan'
import { DialogKirimBarang } from './aksi-pesanan'

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  dikonfirmasi: 'default', selesai: 'default',
  penawaran: 'secondary', dibatalkan: 'outline',
}

export const metadata = { title: 'Detail Pesanan Penjualan' }

export default async function HalamanDetailPesanan({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await wajibIzin('penjualan.pesanan.lihat')
  const { id } = await params
  const pesanan = await ambilPesanan(id)
  if (!pesanan) notFound()

  // Dokumen tanpa nomor belum dikonfirmasi — masih penawaran, dan penawaran
  // adalah dokumen tersendiri dengan layarnya sendiri.
  if (pesanan.nomor === null) redirect(`/penjualan/penawaran/${id}`)

  const [pilihan, sisa, pengiriman, fakturTerkait, proyekTerkait] = await Promise.all([
    ambilDataPilihanPenjualan(),
    barisDenganSisa(id),
    pengirimanPesanan(id),
    db.select({ id: customerInvoices.id, nomor: customerInvoices.nomor, status: customerInvoices.status })
      .from(customerInvoices).where(eq(customerInvoices.soId, id)),
    db.select({ id: projects.id, kode: projects.kode, nama: projects.nama })
      .from(projects).where(eq(projects.soId, id)).limit(1),
  ])

  const adaSisaDifakturkan = sisa.some((b) => Number(b.sisaDifakturkan) > 0)
  const proyek = proyekTerkait[0] ?? null

  /**
   * Pesanan yang sudah dikonfirmasi dapat merujuk mitra/lokasi/pajak yang sejak
   * itu dinonaktifkan — `pilihan` hanya berisi yang masih aktif, jadi tampilan
   * readonly memakai daftar tanpa filter aktif supaya namanya tetap terlihat.
   */
  const semuaPelanggan = await db.select({ id: partners.id, nama: partners.nama })
    .from(partners).orderBy(asc(partners.nama))
  const semuaLokasi = await db.select({ id: locations.id, nama: locations.nama })
    .from(locations).orderBy(asc(locations.kode))
  const semuaPajak = await db.select({
    id: taxes.id, nama: taxes.nama, tarif: taxes.tarif, isPemotongan: taxes.isPemotongan,
  }).from(taxes).orderBy(asc(taxes.kode))
  const semuaSyaratPembayaran = await db.select({
    id: paymentTerms.id, nama: paymentTerms.nama,
  }).from(paymentTerms).orderBy(asc(paymentTerms.jumlahHari))

  /**
   * Proyek baru dapat dibuka setelah pesanan ini difakturkan — sebelum ada
   * faktur, belum ada pendapatan yang bisa diadu dengan biayanya sehingga
   * profitabilitas proyeknya belum berarti apa-apa.
   */
  const aksiProyek = fakturTerkait.length === 0 ? null : proyek ? (
    <Button key="lihat-proyek" asChild variant="outline">
      <Link href={`/proyek/${proyek.id}`}>
        <FolderKanban />
        Lihat Proyek {proyek.kode}
      </Link>
    </Button>
  ) : (
    <Button key="buat-proyek" asChild>
      <Link href={`/proyek/baru?so=${id}`}>
        <FolderKanban />
        Buat Proyek
      </Link>
    </Button>
  )

  const aksiTambahan = pesanan.status === 'dikonfirmasi' ? (
    <div key="aksi-dikonfirmasi" className="flex gap-3">
      <DialogKirimBarang
        soId={id}
        baris={sisa.map((b) => ({
          soLineId: b.id, namaProduk: b.namaProduk,
          namaUom: b.namaUom, sisaDikirim: b.sisaDikirim,
        }))}
      />
      {adaSisaDifakturkan && (
        <Button key="buat-faktur" asChild variant="outline">
          <Link href={`/akuntansi/pelanggan/faktur/baru?so=${id}`}>Buat Faktur</Link>
        </Button>
      )}
      {aksiProyek}
    </div>
  ) : aksiProyek ? (
    <div key="aksi-selesai" className="flex gap-3">{aksiProyek}</div>
  ) : undefined

  return (
    <FormulirPesanan
      awal={{
        id: pesanan.id,
        partnerId: pesanan.partnerId,
        tanggal: pesanan.tanggal,
        tanggalPengiriman: pesanan.tanggalPengiriman ?? '',
        lokasiAsalId: pesanan.lokasiAsalId,
        syaratPembayaranId: pesanan.syaratPembayaranId ?? '',
        referensi: pesanan.referensi ?? '',
        catatan: pesanan.catatan ?? '',
        baris: sisa.map((b) => ({
          produkId: b.produkId,
          deskripsi: b.deskripsi,
          kuantitas: b.kuantitas,
          uomId: b.uomId,
          hargaSatuan: b.hargaSatuan,
          taxId: b.taxId ?? '',
          kuantitasDikirim: b.kuantitasDikirim,
          kuantitasDifakturkan: b.kuantitasDifakturkan,
        })),
      }}
      {...pilihan}
      pelanggan={semuaPelanggan}
      lokasi={semuaLokasi}
      pajak={semuaPajak}
      syaratPembayaran={semuaSyaratPembayaran}
      mode="pesanan"
      readOnly
      nomor={pesanan.nomor ?? undefined}
      statusBadge={
        <Badge variant={VARIAN[pesanan.status]}>{LABEL_STATUS_PENJUALAN[pesanan.status]}</Badge>
      }
      aksiTambahan={aksiTambahan}
      dokumenTerkait={{
        pengiriman: pengiriman.map((p) => ({
          operasiId: p.operasiId,
          nomor: p.nomor ?? '—',
          tanggal: p.tanggal,
        })),
        faktur: fakturTerkait,
      }}
    />
  )
}
