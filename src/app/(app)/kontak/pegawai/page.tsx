import { DaftarKontak } from '../daftar-kontak'

export const metadata = { title: 'Pegawai' }

export default function HalamanPegawai() {
  return (
    <DaftarKontak
      judul="Pegawai"
      deskripsi="Tukang dan tenaga kerja yang jam kerjanya dicatat di timesheet proyek."
      peran="pegawai"
    />
  )
}
