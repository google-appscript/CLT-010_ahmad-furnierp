import { notFound } from 'next/navigation'
import { wajibIzin } from '@/lib/sesi'
import {
  SLUG_KE_TIPE, ARAH_BAWAAN, dapatDibuatManual,
} from '@/modules/gudang/validasi/operasi'
import { FormulirOperasi } from '../../formulir-operasi'
import { ambilDataPilihan, lokasiBawaan } from '../../data-pilihan'

const IZIN: Record<string, string> = {
  penerimaan: 'gudang.penerimaan.kelola',
  pengiriman: 'gudang.pengiriman.kelola',
  transfer: 'gudang.transfer.kelola',
  barang_rusak: 'gudang.scrap.kelola',
  opname: 'gudang.opname.kelola',
  // Operasi produksi hanya dapat dilihat oleh yang berhak atas perintahnya.
  konsumsi_produksi: 'manufaktur.mo.lihat',
  hasil_produksi: 'manufaktur.mo.lihat',
}

export default async function HalamanOperasiBaru({
  params,
}: {
  params: Promise<{ tipe: string }>
}) {
  const { tipe: slug } = await params
  const tipe = SLUG_KE_TIPE[slug]
  // Konsumsi dan hasil produksi selalu lahir berpasangan dari perintah
  // produksi; membuat salah satunya sendiri akan meninggalkan saldo Barang
  // Dalam Proses yang tidak pernah tertutup.
  if (!tipe || !dapatDibuatManual(tipe)) notFound()

  await wajibIzin(IZIN[tipe])
  const { daftarProduk, daftarLokasi, daftarSatuan, daftarMitra } = await ambilDataPilihan()
  const arah = ARAH_BAWAAN[tipe]

  // Transfer berawal dan berakhir di lokasi internal, jadi tujuannya diisi
  // lokasi internal kedua agar tidak sama dengan asalnya.
  const internal = daftarLokasi.filter((l) => l.tipe === 'internal')
  const tujuanBawaan = tipe === 'transfer'
    ? internal[1]?.id ?? ''
    : lokasiBawaan(daftarLokasi, arah.tujuan)

  return (
    <FormulirOperasi
      awal={{
        tipe,
        tanggal: new Date().toISOString().slice(0, 10),
        lokasiAsalId: lokasiBawaan(daftarLokasi, arah.asal),
        lokasiTujuanId: tujuanBawaan,
        partnerId: '', referensi: '', catatan: '', baris: [],
      }}
      produk={daftarProduk}
      lokasi={daftarLokasi}
      satuan={daftarSatuan}
      mitra={daftarMitra}
    />
  )
}
