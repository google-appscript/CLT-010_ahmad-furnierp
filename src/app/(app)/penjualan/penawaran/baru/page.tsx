import { wajibIzin } from '@/lib/sesi'
import { FormulirPesanan } from '../../formulir-pesanan'
import { ambilDataPilihanPenjualan } from '../../data-pilihan'

export const metadata = { title: 'Penawaran Baru' }

export default async function HalamanPenawaranBaru() {
  await wajibIzin('penjualan.penawaran.lihat')
  const pilihan = await ambilDataPilihanPenjualan()

  return (
    <FormulirPesanan
      mode="penawaran"
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
  )
}
