import { wajibIzin } from '@/lib/sesi'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirPesanan } from '../../formulir-pesanan'
import { ambilDataPilihanPenjualan } from '../../data-pilihan'

export const metadata = { title: 'Penawaran Baru' }

export default async function HalamanPesananBaru() {
  await wajibIzin('penjualan.pesanan.lihat')
  const pilihan = await ambilDataPilihanPenjualan()

  return (
    <>
      <KepalaHalaman
        judul="Penawaran Baru"
        deskripsi="Dokumen disimpan sebagai penawaran dan belum menjadi komitmen sampai dikonfirmasi."
      />
      <FormulirPesanan
        awal={{
          partnerId: '',
          tanggal: new Date().toISOString().slice(0, 10),
          tanggalPengiriman: '',
          lokasiAsalId: pilihan.lokasi[0]?.id ?? '',
          syaratPembayaranId: '',
          referensi: '', catatan: '', baris: [],
        }}
        {...pilihan}
      />
    </>
  )
}
