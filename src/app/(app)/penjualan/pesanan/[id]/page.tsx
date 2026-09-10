import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { customerInvoices } from '@/db/schema'
import { ambilPesanan, barisDenganSisa } from '@/modules/penjualan/layanan/pesanan'
import { pengirimanPesanan } from '@/modules/penjualan/layanan/pengiriman'
import { Button } from '@/components/ui/button'
import { FormulirPesanan } from '../../formulir-pesanan'
import { ambilDataPilihanPenjualan } from '../../data-pilihan'
import { AksiPenawaran, DialogKirimBarang } from './aksi-pesanan'

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

  const aksiTambahan = draf ? (
    <AksiPenawaran id={pesanan.id} />
  ) : pesanan.status === 'dikonfirmasi' ? (
    <div className="flex gap-3">
      <DialogKirimBarang
        soId={id}
        baris={sisa.map((b) => ({
          soLineId: b.id, namaProduk: b.namaProduk,
          namaUom: b.namaUom, sisaDikirim: b.sisaDikirim,
        }))}
      />
      {adaSisaDifakturkan && (
        <Button asChild variant="outline">
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
      readOnly={!draf}
      nomor={pesanan.nomor ?? undefined}
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
