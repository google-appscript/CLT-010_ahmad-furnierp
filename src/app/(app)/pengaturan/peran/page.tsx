import { wajibIzin } from '@/lib/sesi'
import { daftarPeranDenganIzin, type PeranDenganIzin } from '@/modules/identitas/repositori/peran'
import { daftarKodeIzin } from '@/lib/navigasi'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'

export const metadata = { title: 'Peran & Hak Akses' }

const kolom: Kolom<PeranDenganIzin>[] = [
  {
    kunci: 'kode', judul: 'Kode', lebar: '140px',
    render: (p) => <span className="font-mono text-sm">{p.kode}</span>,
  },
  { kunci: 'nama', judul: 'Nama', render: (p) => p.nama },
  {
    kunci: 'izin', judul: 'Izin',
    render: (p) => (
      p.izin.includes('*')
        ? <Badge>Akses penuh</Badge>
        : <span className="text-sm text-muted-foreground">{p.izin.length} izin</span>
    ),
  },
  {
    kunci: 'pengguna', judul: 'Jumlah Pengguna', lebar: '160px', rataKanan: true,
    render: (p) => p.jumlahPengguna,
  },
  {
    kunci: 'sistem', judul: 'Jenis', lebar: '120px',
    render: (p) => (p.isSystem ? <Badge variant="outline">Sistem</Badge> : '—'),
  },
]

export default async function HalamanPeran() {
  await wajibIzin('pengaturan.peran.kelola')
  const peran = await daftarPeranDenganIzin()
  const totalIzin = daftarKodeIzin().length

  return (
    <>
      <KepalaHalaman
        judul="Peran & Hak Akses"
        deskripsi="Struktur hak akses sudah lengkap sejak awal, meski saat ini hanya peran Superuser yang dipakai."
      />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Tentang Pemecahan Peran</CardTitle>
          <CardDescription>
            Sistem sudah mengenali {totalIzin} kode izin yang mencakup seluruh tujuh fase, termasuk
            modul yang belum dibangun. Ketika peran dipecah nanti — misalnya Akuntan, Sales, atau
            Kepala Gudang — tidak ada kode antarmuka yang perlu diubah; cukup memetakan izin ke
            peran baru.
          </CardDescription>
        </CardHeader>
      </Card>

      <TabelData kolom={kolom} baris={peran} kunciBaris={(p) => p.id} pesanKosong="Belum ada peran." />
    </>
  )
}
