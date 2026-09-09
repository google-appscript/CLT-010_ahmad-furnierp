import { wajibIzin } from '@/lib/sesi'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirPerintah } from '../../formulir-perintah'
import { ambilDataPilihanManufaktur } from '../../data-pilihan'

export const metadata = { title: 'Perintah Produksi Baru' }

export default async function HalamanPerintahBaru() {
  await wajibIzin('manufaktur.mo.lihat')
  const { produk, satuan, lokasi, resep } = await ambilDataPilihanManufaktur()

  return (
    <>
      <KepalaHalaman
        judul="Perintah Produksi Baru"
        deskripsi="Disimpan sebagai draft dan belum menyentuh stok sampai dikonfirmasi lalu diselesaikan."
      />
      <FormulirPerintah
        awal={{
          produkId: '', bomId: '', kuantitas: '1', uomId: '',
          tanggal: new Date().toISOString().slice(0, 10),
          tanggalTarget: '',
          lokasiSumberId: lokasi[0]?.id ?? '',
          lokasiTujuanId: lokasi[1]?.id ?? '',
          biayaTenagaKerja: '0', biayaOverhead: '0',
          referensi: '', catatan: '', baris: [],
        }}
        produk={produk}
        satuan={satuan}
        lokasi={lokasi}
        resep={resep}
      />
    </>
  )
}
