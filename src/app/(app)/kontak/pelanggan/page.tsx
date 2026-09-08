import { DaftarKontak } from '../daftar-kontak'

export const metadata = { title: 'Pelanggan' }

export default function HalamanPelanggan() {
  return (
    <DaftarKontak
      judul="Pelanggan"
      deskripsi="Mitra usaha yang ditandai sebagai pelanggan."
      peran="pelanggan"
    />
  )
}
