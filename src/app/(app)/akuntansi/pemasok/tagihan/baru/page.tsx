import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { companySettings } from '@/db/schema'
import { ambilPesanan, barisDenganSisa } from '@/modules/pembelian/layanan/pesanan'
import { FormulirTagihan, type BarisFormulir } from '../../formulir-tagihan'
import { ambilDataPilihanTagihan } from '../../data-pilihan'

export const metadata = { title: 'Tagihan Pembelian Baru' }

export default async function HalamanTagihanBaru({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.tagihan.lihat')
  const params = await searchParams
  const poId = Array.isArray(params.po) ? params.po[0] : params.po
  const tipe = (Array.isArray(params.tipe) ? params.tipe[0] : params.tipe) === 'nota_debit'
    ? 'nota_debit' as const
    : 'tagihan' as const

  const pilihan = await ambilDataPilihanTagihan()
  const [pengaturan] = await db.select().from(companySettings).limit(1)

  // Tagihan yang dibuat dari pesanan diisi lebih dulu dengan sisa yang sudah
  // diterima tetapi belum ditagih, dan diarahkan ke akun penampung.
  let baris: BarisFormulir[] = []
  let partnerId = ''
  if (poId) {
    const pesanan = await ambilPesanan(poId)
    const sisa = await barisDenganSisa(poId)
    partnerId = pesanan?.partnerId ?? ''
    baris = sisa
      .filter((b) => Number(b.sisaDitagih) > 0)
      .map((b) => ({
        produkId: b.produkId,
        poLineId: b.id,
        deskripsi: b.deskripsi,
        kuantitas: String(Number(b.sisaDitagih)),
        hargaSatuan: String(Number(b.hargaSatuan)),
        taxId: b.taxId ?? '',
        akunId: pengaturan?.akunPenerimaanBelumDitagihId ?? '',
      }))
  }

  return (
    <FormulirTagihan
      awal={{
        tipe,
        partnerId,
        poId: poId ?? '',
        tanggal: new Date().toISOString().slice(0, 10),
        tanggalJatuhTempo: '',
        referensiPemasok: '',
        catatan: '',
        baris,
      }}
      {...pilihan}
    />
  )
}
