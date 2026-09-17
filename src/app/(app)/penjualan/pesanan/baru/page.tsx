import { wajibIzin } from '@/lib/sesi'
import { FormulirPesanan } from '../../formulir-pesanan'
import { ambilDataPilihanPenjualan } from '../../data-pilihan'

export const metadata = { title: 'Pesanan Penjualan Baru' }

export default async function HalamanPesananBaru() {
  await wajibIzin('penjualan.pesanan.lihat')
  const pilihan = await ambilDataPilihanPenjualan()

  return (
    <FormulirPesanan
      mode="pesanan"
      awal={{
        partnerId: '',
        tanggal: new Date().toISOString().slice(0, 10),
        tanggalPengiriman: '',
        syaratPembayaranId: '',
        referensi: '', catatan: '', baris: [],
      }}
      {...pilihan}
    />
  )
}
