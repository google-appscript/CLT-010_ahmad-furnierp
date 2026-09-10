import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { customerInvoices, locations, partners, paymentTerms, taxes } from '@/db/schema'
import { ambilPesanan, barisDenganSisa } from '@/modules/penjualan/layanan/pesanan'
import { pengirimanPesanan } from '@/modules/penjualan/layanan/pengiriman'
import { LABEL_STATUS_PENJUALAN } from '@/modules/penjualan/validasi/pesanan'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormulirPesanan } from '../../formulir-pesanan'
import { ambilDataPilihanPenjualan } from '../../data-pilihan'
import { AksiPenawaran, DialogKirimBarang } from './aksi-pesanan'

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

  const draf = pesanan.status === 'penawaran'

  const [pilihan, sisa, pengiriman, fakturTerkait] = await Promise.all([
    ambilDataPilihanPenjualan(),
    barisDenganSisa(id),
    pengirimanPesanan(id),
    db.select({ id: customerInvoices.id, nomor: customerInvoices.nomor, status: customerInvoices.status })
      .from(customerInvoices).where(eq(customerInvoices.soId, id)),
  ])

  const adaSisaDifakturkan = sisa.some((b) => Number(b.sisaDifakturkan) > 0)

  /**
   * Dokumen non-draft dapat merujuk mitra/lokasi/pajak yang sejak itu
   * dinonaktifkan — `pilihan` hanya berisi yang masih aktif (benar untuk
   * mengisi opsi dropdown saat mengedit draft), jadi tampilan readonly
   * memakai daftar tanpa filter aktif supaya nama tetap terlihat, bukan "—".
   */
  const semuaPelanggan = draf ? pilihan.pelanggan : await db.select({ id: partners.id, nama: partners.nama })
    .from(partners).orderBy(asc(partners.nama))
  const semuaLokasi = draf ? pilihan.lokasi : await db.select({ id: locations.id, nama: locations.nama })
    .from(locations).orderBy(asc(locations.kode))
  const semuaPajak = draf ? pilihan.pajak : await db.select({
    id: taxes.id, nama: taxes.nama, tarif: taxes.tarif, isPemotongan: taxes.isPemotongan,
  }).from(taxes).orderBy(asc(taxes.kode))
  const semuaSyaratPembayaran = draf ? pilihan.syaratPembayaran : await db.select({
    id: paymentTerms.id, nama: paymentTerms.nama,
  }).from(paymentTerms).orderBy(asc(paymentTerms.jumlahHari))

  const aksiTambahan = draf ? (
    <AksiPenawaran key="aksi-penawaran" id={pesanan.id} />
  ) : pesanan.status === 'dikonfirmasi' ? (
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
    </div>
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
        baris: draf
          ? pesanan.baris.map((b) => ({
              produkId: b.produkId,
              deskripsi: b.deskripsi,
              kuantitas: String(Number(b.kuantitas)),
              uomId: b.uomId,
              hargaSatuan: String(Number(b.hargaSatuan)),
              taxId: b.taxId ?? '',
            }))
          : sisa.map((b) => ({
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
      readOnly={!draf}
      nomor={pesanan.nomor ?? undefined}
      statusBadge={!draf && (
        <Badge variant={VARIAN[pesanan.status]}>{LABEL_STATUS_PENJUALAN[pesanan.status]}</Badge>
      )}
      aksiTambahan={aksiTambahan}
      dokumenTerkait={
        draf
          ? undefined
          : {
              pengiriman: pengiriman.map((p) => ({
                operasiId: p.operasiId,
                nomor: p.nomor ?? '—',
                tanggal: p.tanggal,
              })),
              faktur: fakturTerkait,
            }
      }
    />
  )
}
