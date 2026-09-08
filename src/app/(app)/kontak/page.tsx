import { DaftarKontak } from './daftar-kontak'

export const metadata = { title: 'Semua Kontak' }

export default function HalamanSemuaKontak() {
  return (
    <DaftarKontak
      judul="Semua Kontak"
      deskripsi="Pelanggan dan pemasok tersimpan dalam satu daftar; satu mitra dapat berperan sebagai keduanya."
    />
  )
}
