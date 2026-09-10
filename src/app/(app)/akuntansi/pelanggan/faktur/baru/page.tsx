import { and, asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { accounts } from '@/db/schema'
import { ambilPesanan, barisDenganSisa } from '@/modules/penjualan/layanan/pesanan'
import { FormulirFaktur, type BarisFormulir } from '../../formulir-faktur'
import { ambilDataPilihanFaktur } from '../../data-pilihan'

export const metadata = { title: 'Faktur Penjualan Baru' }

export default async function HalamanFakturBaru({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('akuntansi.faktur.lihat')
  const params = await searchParams
  const soId = Array.isArray(params.so) ? params.so[0] : params.so
  const tipe = (Array.isArray(params.tipe) ? params.tipe[0] : params.tipe) === 'nota_kredit'
    ? 'nota_kredit' as const
    : 'faktur' as const

  const pilihan = await ambilDataPilihanFaktur()

  // Akun pendapatan pertama dipakai sebagai bawaan baris yang berasal dari
  // pesanan; pengguna tetap dapat menggantinya per baris.
  const [akunPendapatan] = await db.select().from(accounts)
    .where(and(eq(accounts.tipeAkun, 'pendapatan'), eq(accounts.isActive, true)))
    .orderBy(asc(accounts.kode)).limit(1)

  let baris: BarisFormulir[] = []
  let partnerId = ''
  if (soId) {
    const pesanan = await ambilPesanan(soId)
    const sisa = await barisDenganSisa(soId)
    partnerId = pesanan?.partnerId ?? ''
    baris = sisa
      .filter((b) => Number(b.sisaDifakturkan) > 0)
      .map((b) => ({
        produkId: b.produkId,
        soLineId: b.id,
        deskripsi: b.deskripsi,
        kuantitas: String(Number(b.sisaDifakturkan)),
        hargaSatuan: String(Number(b.hargaSatuan)),
        taxId: b.taxId ?? '',
        akunId: akunPendapatan?.id ?? '',
      }))
  }

  return (
    <FormulirFaktur
      awal={{
        tipe,
        partnerId,
        soId: soId ?? '',
        tanggal: new Date().toISOString().slice(0, 10),
        tanggalJatuhTempo: '',
        referensi: '',
        catatan: '',
        baris,
      }}
      {...pilihan}
    />
  )
}
