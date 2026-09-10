import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { locations, partners, paymentTerms, taxes, vendorBills } from '@/db/schema'
import { ambilPesanan, barisDenganSisa } from '@/modules/pembelian/layanan/pesanan'
import { penerimaanPesanan } from '@/modules/pembelian/layanan/penerimaan'
import { LABEL_STATUS_PEMBELIAN } from '@/modules/pembelian/validasi/pesanan'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormulirPesanan } from '../../formulir-pesanan'
import { ambilDataPilihanPembelian } from '../../data-pilihan'
import { AksiPermintaan, DialogTerimaBarang } from './aksi-pesanan'

export const metadata = { title: 'Detail Pesanan Pembelian' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  dikonfirmasi: 'default', selesai: 'default',
  permintaan: 'secondary', dibatalkan: 'outline',
}

export default async function HalamanDetailPesanan({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await wajibIzin('pembelian.pesanan.lihat')
  const { id } = await params
  const pesanan = await ambilPesanan(id)
  if (!pesanan) notFound()

  const draf = pesanan.status === 'permintaan'

  const [pilihan, sisa, penerimaan, tagihanTerkait] = await Promise.all([
    ambilDataPilihanPembelian(),
    barisDenganSisa(id),
    penerimaanPesanan(id),
    db.select({ id: vendorBills.id, nomor: vendorBills.nomor, status: vendorBills.status })
      .from(vendorBills).where(eq(vendorBills.poId, id)),
  ])

  const adaSisaDitagih = sisa.some((b) => Number(b.sisaDitagih) > 0)

  // Dokumen non-draft dapat merujuk mitra/lokasi/pajak/syarat yang sejak itu
  // dinonaktifkan — `pilihan` hanya berisi yang masih aktif (benar untuk
  // mengisi opsi dropdown saat mengedit draft), jadi tampilan readonly
  // memakai daftar tanpa filter aktif supaya nama tetap terlihat.
  const semuaPemasok = draf ? pilihan.pemasok : await db.select({ id: partners.id, nama: partners.nama })
    .from(partners).orderBy(asc(partners.nama))
  const semuaLokasi = draf ? pilihan.lokasi : await db.select({ id: locations.id, nama: locations.nama })
    .from(locations).orderBy(asc(locations.kode))
  const semuaPajak = draf ? pilihan.pajak : await db.select({
    id: taxes.id, kode: taxes.kode, nama: taxes.nama, tarif: taxes.tarif, isPemotongan: taxes.isPemotongan,
  }).from(taxes).orderBy(asc(taxes.kode))
  const semuaSyaratPembayaran = draf ? pilihan.syaratPembayaran : await db.select({
    id: paymentTerms.id, nama: paymentTerms.nama,
  }).from(paymentTerms).orderBy(asc(paymentTerms.jumlahHari))

  const aksiTambahan = draf ? (
    <AksiPermintaan key="aksi-permintaan" id={pesanan.id} />
  ) : pesanan.status === 'dikonfirmasi' ? (
    <div key="aksi-dikonfirmasi" className="flex gap-3">
      <DialogTerimaBarang
        poId={id}
        baris={sisa.map((b) => ({
          poLineId: b.id, namaProduk: b.namaProduk,
          namaUom: b.namaUom, sisaDiterima: b.sisaDiterima,
        }))}
      />
      {adaSisaDitagih && (
        <Button key="buat-tagihan" asChild variant="outline">
          <Link href={`/akuntansi/pemasok/tagihan/baru?po=${id}`}>Buat Tagihan</Link>
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
        tanggalDiharapkan: pesanan.tanggalDiharapkan ?? '',
        lokasiTujuanId: pesanan.lokasiTujuanId,
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
              kuantitasDiterima: b.kuantitasDiterima,
              kuantitasDitagih: b.kuantitasDitagih,
            })),
      }}
      {...pilihan}
      pemasok={semuaPemasok}
      lokasi={semuaLokasi}
      pajak={semuaPajak}
      syaratPembayaran={semuaSyaratPembayaran}
      readOnly={!draf}
      nomor={pesanan.nomor ?? undefined}
      statusBadge={!draf && (
        <Badge variant={VARIAN[pesanan.status]}>{LABEL_STATUS_PEMBELIAN[pesanan.status]}</Badge>
      )}
      aksiTambahan={aksiTambahan}
      dokumenTerkait={
        draf
          ? undefined
          : {
              penerimaan: penerimaan.map((p) => ({
                operasiId: p.operasiId,
                nomor: p.nomor ?? '—',
                tanggal: p.tanggal,
              })),
              tagihan: tagihanTerkait,
            }
      }
    />
  )
}
