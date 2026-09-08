import { wajibIzin } from '@/lib/sesi'
import { daftarTahunBuku, ambilPengaturan, type TahunBuku } from '@/modules/akuntansi/layanan/konfigurasi'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogTahunBuku, FormulirPenguncian } from './formulir-penguncian'

export const metadata = { title: 'Tahun Buku & Penguncian' }

const kolom: Kolom<TahunBuku>[] = [
  { kunci: 'nama', judul: 'Nama', render: (t) => t.nama },
  { kunci: 'mulai', judul: 'Tanggal Mulai', lebar: '160px', render: (t) => t.tanggalMulai },
  { kunci: 'selesai', judul: 'Tanggal Selesai', lebar: '160px', render: (t) => t.tanggalSelesai },
  {
    kunci: 'status', judul: 'Status', lebar: '120px',
    render: (t) => (
      <Badge variant={t.status === 'terbuka' ? 'secondary' : 'outline'}>
        {t.status === 'terbuka' ? 'Terbuka' : 'Ditutup'}
      </Badge>
    ),
  },
]

export default async function HalamanTahunBuku() {
  await wajibIzin('akuntansi.tahun-buku.kelola')
  const [tahun, pengaturan] = await Promise.all([daftarTahunBuku(), ambilPengaturan()])

  return (
    <>
      <KepalaHalaman
        judul="Tahun Buku & Penguncian"
        deskripsi="Menentukan periode pelaporan dan batas perubahan data akuntansi."
        aksi={<DialogTahunBuku />}
      />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Penguncian Periode</CardTitle>
          <CardDescription>
            Entri jurnal bertanggal pada atau sebelum tanggal kunci tidak dapat dibuat, diubah,
            maupun dihapus — termasuk oleh proses otomatis dari modul lain. Tanggal kunci hanya
            dapat dimajukan atau dikosongkan sepenuhnya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormulirPenguncian tanggalKunci={pengaturan?.tanggalKunciBuku ?? null} />
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Daftar Tahun Buku</h2>
        <TabelData
          kolom={kolom}
          baris={tahun}
          kunciBaris={(t) => t.id}
          pesanKosong="Belum ada tahun buku."
        />
      </section>
    </>
  )
}
