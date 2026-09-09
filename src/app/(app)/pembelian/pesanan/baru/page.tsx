import { wajibIzin } from '@/lib/sesi'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirPesanan } from '../../formulir-pesanan'
import { ambilDataPilihanPembelian } from '../../data-pilihan'

export const metadata = { title: 'Permintaan Penawaran Baru' }

export default async function HalamanPesananBaru() {
  await wajibIzin('pembelian.pesanan.lihat')
  const { produk, satuan, pajak, pemasok, lokasi, syaratPembayaran } =
    await ambilDataPilihanPembelian()

  return (
    <>
      <KepalaHalaman
        judul="Permintaan Penawaran Baru"
        deskripsi="Dokumen disimpan sebagai permintaan dan belum menjadi komitmen sampai dikonfirmasi."
      />
      <FormulirPesanan
        awal={{
          partnerId: '',
          tanggal: new Date().toISOString().slice(0, 10),
          tanggalDiharapkan: '',
          lokasiTujuanId: lokasi[0]?.id ?? '',
          syaratPembayaranId: '',
          referensi: '', catatan: '', baris: [],
        }}
        produk={produk} satuan={satuan} pajak={pajak}
        pemasok={pemasok} lokasi={lokasi} syaratPembayaran={syaratPembayaran}
      />
    </>
  )
}
