
import { wajibIzin } from '@/lib/sesi'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TombolBuat } from '@/components/data/tombol-aksi'
import { DaftarPesanan } from '../daftar-pesanan'

export const metadata = { title: 'Permintaan Penawaran' }

export default async function HalamanPermintaan() {
  await wajibIzin('pembelian.permintaan.lihat')
  return (
    <>
      <KepalaHalaman
        judul="Permintaan Penawaran"
        deskripsi="Permintaan dan pesanan adalah dokumen yang sama pada tahap berbeda. Nomor diberikan saat dikonfirmasi."
        aksi={
          <TombolBuat href="/pembelian/pesanan/baru">Buat Permintaan</TombolBuat>
        }
      />
      <DaftarPesanan param={{ halaman: 1, ukuranHalaman: 20, filter: { status: ['permintaan'] } }} />
    </>
  )
}
