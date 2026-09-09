import { wajibIzin } from '@/lib/sesi'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirAset } from '../formulir-aset'
import { ambilDataPilihanAset } from '../data-pilihan'

export const metadata = { title: 'Daftarkan Aset' }

export default async function HalamanAsetBaru() {
  await wajibIzin('akuntansi.aset.lihat')
  const { kategori, mitra } = await ambilDataPilihanAset()
  const hariIni = new Date().toISOString().slice(0, 10)

  return (
    <>
      <KepalaHalaman
        judul="Daftarkan Aset"
        deskripsi="Aset disimpan sebagai draft; jadwal depresiasinya baru tersusun saat aset dijalankan."
      />
      <FormulirAset
        awal={{
          kode: '', nama: '', kategoriId: '',
          tanggalPerolehan: hariIni, tanggalMulaiDepresiasi: hariIni,
          nilaiPerolehan: '', nilaiResidu: '0',
          masaManfaatBulan: '60', metode: 'garis_lurus',
          partnerId: '', referensi: '', catatan: '',
        }}
        kategori={kategori}
        mitra={mitra}
      />
    </>
  )
}
