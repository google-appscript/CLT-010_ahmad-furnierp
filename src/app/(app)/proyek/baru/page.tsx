import { wajibIzin } from '@/lib/sesi'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirProyek } from '../formulir-proyek'
import { ambilDataPilihanProyek } from '../data-pilihan'

export const metadata = { title: 'Proyek Baru' }

export default async function HalamanProyekBaru() {
  await wajibIzin('proyek.proyek.kelola')
  const { pesanan, pengguna } = await ambilDataPilihanProyek()

  if (pesanan.length === 0) {
    return (
      <>
        <KepalaHalaman
          judul="Proyek Baru"
          deskripsi="Proyek disimpan sebagai draft; tugas dan timesheet baru dapat dicatat setelah proyek dimulai."
        />
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Tidak ada pesanan penjualan yang tersedia. Konfirmasikan sebuah pesanan lebih dulu —
          pesanan yang sudah dipegang proyek lain tidak dapat dipakai ulang.
        </div>
      </>
    )
  }

  return (
    <FormulirProyek
      awal={{
        kode: '', nama: '', soId: '',
        tanggalMulai: new Date().toISOString().slice(0, 10),
        tanggalTarget: '', manajerId: '', tarifPerJam: '0', catatan: '',
      }}
      pesanan={pesanan}
      pengguna={pengguna}
    />
  )
}
