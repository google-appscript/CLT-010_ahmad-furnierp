import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarJurnal, labelTipeJurnal, type Jurnal } from '@/modules/akuntansi/layanan/jurnal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogJurnal } from './dialog-jurnal'

export const metadata = { title: 'Jurnal' }

const kolom: Kolom<Jurnal>[] = [
  {
    kunci: 'kode', judul: 'Kode', lebar: '100px',
    render: (j) => <span className="font-mono text-sm">{j.kode}</span>,
  },
  { kunci: 'nama', judul: 'Nama', render: (j) => j.nama },
  { kunci: 'tipe', judul: 'Tipe', lebar: '140px', render: (j) => labelTipeJurnal(j.tipe) },
  {
    kunci: 'status', judul: 'Status', lebar: '100px',
    render: (j) => (
      <Badge variant={j.isActive ? 'secondary' : 'outline'}>
        {j.isActive ? 'Aktif' : 'Nonaktif'}
      </Badge>
    ),
  },
  {
    kunci: 'aksi', judul: '', lebar: '80px', rataKanan: true,
    render: (j) => <DialogJurnal jurnal={j} pemicu={<Button variant="ghost" size="sm">Ubah</Button>} />,
  },
]

export default async function HalamanJurnal() {
  await wajibIzin('akuntansi.jurnal-master.kelola')
  const jurnal = await daftarJurnal()

  return (
    <>
      <KepalaHalaman
        judul="Jurnal"
        deskripsi="Setiap jurnal memiliki urutan penomorannya sendiri yang dibuat otomatis."
        aksi={<DialogJurnal pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Jurnal</Button>} />}
      />
      <TabelData
        kolom={kolom}
        baris={jurnal}
        kunciBaris={(j) => j.id}
        pesanKosong="Belum ada jurnal. Jalankan seed data awal untuk memuat jurnal standar."
      />
    </>
  )
}
