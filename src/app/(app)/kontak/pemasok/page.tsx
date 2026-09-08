import { DaftarKontak } from '../daftar-kontak'

export const metadata = { title: 'Pemasok' }

export default function HalamanPemasok() {
  return (
    <DaftarKontak
      judul="Pemasok"
      deskripsi="Mitra usaha yang ditandai sebagai pemasok."
      peran="pemasok"
    />
  )
}
