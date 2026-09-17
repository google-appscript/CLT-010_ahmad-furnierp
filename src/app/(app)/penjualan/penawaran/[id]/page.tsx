import { notFound, redirect } from 'next/navigation'
import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { partners, paymentTerms, taxes } from '@/db/schema'
import { ambilPesanan } from '@/modules/penjualan/layanan/pesanan'
import { Badge } from '@/components/ui/badge'
import { FormulirPesanan } from '../../formulir-pesanan'
import { ambilDataPilihanPenjualan } from '../../data-pilihan'
import { AksiPenawaran } from './aksi-penawaran'
import { MenuFormulir } from '@/components/formulir/menu-formulir'
import { aksiDuplikatPesanan, aksiHapusPenawaran } from '../../aksi'

export const metadata = { title: 'Detail Penawaran' }

export default async function HalamanDetailPenawaran({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await wajibIzin('penjualan.penawaran.lihat')
  const { id } = await params
  const penawaran = await ambilPesanan(id)
  if (!penawaran) notFound()

  // Nomor terbit saat penawaran dikonfirmasi, jadi dokumen bernomor sudah
  // menjadi pesanan dan dilanjutkan di layar Pesanan Penjualan.
  if (penawaran.nomor !== null) redirect(`/penjualan/pesanan/${id}`)

  const draf = penawaran.status === 'penawaran'
  const pilihan = await ambilDataPilihanPenjualan()

  const semuaPelanggan = draf ? pilihan.pelanggan : await db
    .select({ id: partners.id, nama: partners.nama }).from(partners).orderBy(asc(partners.nama))
  const semuaPajak = draf ? pilihan.pajak : await db.select({
    id: taxes.id, nama: taxes.nama, tarif: taxes.tarif, isPemotongan: taxes.isPemotongan,
  }).from(taxes).orderBy(asc(taxes.kode))
  const semuaSyarat = draf ? pilihan.syaratPembayaran : await db.select({
    id: paymentTerms.id, nama: paymentTerms.nama,
  }).from(paymentTerms).orderBy(asc(paymentTerms.jumlahHari))

  return (
    <FormulirPesanan
      mode="penawaran"
      awal={{
        id: penawaran.id,
        partnerId: penawaran.partnerId,
        tanggal: penawaran.tanggal,
        tanggalPengiriman: penawaran.tanggalPengiriman ?? '',
        syaratPembayaranId: penawaran.syaratPembayaranId ?? '',
        referensi: penawaran.referensi ?? '',
        catatan: penawaran.catatan ?? '',
        baris: penawaran.baris.map((b) => ({
          produkId: b.produkId,
          deskripsi: b.deskripsi,
          kuantitas: String(Number(b.kuantitas)),
          uomId: b.uomId,
          hargaSatuan: String(Number(b.hargaSatuan)),
          taxId: b.taxId ?? '',
        })),
      }}
      {...pilihan}
      pelanggan={semuaPelanggan}
      pajak={semuaPajak}
      syaratPembayaran={semuaSyarat}
      readOnly={!draf}
      statusBadge={!draf && <Badge variant="outline">Ditolak</Badge>}
      aksiTambahan={draf ? <AksiPenawaran key="aksi" id={penawaran.id} /> : undefined}
      menu={
        <MenuFormulir
          labelDokumen="Penawaran"
          onDuplikat={aksiDuplikatPesanan.bind(null, penawaran.id)}
          ruteDuplikat="/penjualan/penawaran/:id"
          onHapus={aksiHapusPenawaran.bind(null, penawaran.id)}
        />
      }
    />
  )
}
