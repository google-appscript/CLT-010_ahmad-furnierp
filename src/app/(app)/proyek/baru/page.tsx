import { wajibIzin } from '@/lib/sesi'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirProyek } from '../formulir-proyek'
import { ambilDataPilihanProyek } from '../data-pilihan'

export const metadata = { title: 'Proyek Baru' }

export default async function HalamanProyekBaru({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('proyek.proyek.kelola')
  const { pesanan, pengguna } = await ambilDataPilihanProyek()

  // Dibuka dari tombol "Buat Proyek" pada pesanan penjualan: pesanannya
  // langsung terpilih supaya tidak perlu dicari ulang di daftar.
  const params = await searchParams
  const soAwal = Array.isArray(params.so) ? params.so[0] : params.so
  const soTerpilih = soAwal && pesanan.some((p) => p.id === soAwal) ? soAwal : ''

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
        // Kode dikosongkan; nomornya terbit saat proyek disimpan.
        kode: '', nama: '', soId: soTerpilih,
        tanggalMulai: new Date().toISOString().slice(0, 10),
        tanggalTarget: '', manajerId: '', catatan: '',
      }}
      pesanan={pesanan}
      pengguna={pengguna}
    />
  )
}
