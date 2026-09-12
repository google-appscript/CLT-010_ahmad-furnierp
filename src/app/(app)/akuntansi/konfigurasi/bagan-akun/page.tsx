import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarAkun, type Akun } from '@/modules/akuntansi/layanan/akun'
import { labelTipeAkun } from '@/modules/akuntansi/validasi/akun'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogAkun, TombolStatusAkun } from './dialog-akun'

export const metadata = { title: 'Bagan Akun' }

const kolom: Kolom<Akun>[] = [
  {
    kunci: 'kode', judul: 'Kode', lebar: '110px',
    render: (a) => <span className="font-mono text-sm">{a.kode}</span>,
  },
  { kunci: 'nama', judul: 'Nama Akun', render: (a) => a.nama },
  { kunci: 'tipe', judul: 'Tipe Akun', render: (a) => labelTipeAkun(a.tipeAkun) },
  {
    kunci: 'rekonsiliasi', judul: 'Rekonsiliasi', lebar: '120px',
    render: (a) => (a.dapatDirekonsiliasi ? 'Ya' : '—'),
  },
  {
    kunci: 'status', judul: 'Status', lebar: '100px',
    render: (a) => (
      <Badge variant={a.isActive ? 'secondary' : 'outline'}>
        {a.isActive ? 'Aktif' : 'Nonaktif'}
      </Badge>
    ),
  },
  {
    kunci: 'aksi', judul: '', lebar: '160px', rataKanan: true,
    render: (a) => (
      <>
        <DialogAkun akun={a} pemicu={<Button variant="ghost" size="sm">Ubah</Button>} />
        <TombolStatusAkun id={a.id} isActive={a.isActive} />
      </>
    ),
  },
]

export default async function HalamanBaganAkun() {
  await wajibIzin('akuntansi.coa.kelola')
  const akun = await daftarAkun()

  return (
    <>
      <KepalaHalaman
        judul="Bagan Akun"
        deskripsi="Tipe akun menentukan penempatan setiap akun pada Laba Rugi dan Neraca."
        aksi={
          <DialogAkun pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Akun</Button>} />
        }
      />
      <TabelData
        kolom={kolom}
        baris={akun}
        kunciBaris={(a) => a.id}
        pesanKosong="Belum ada akun. Jalankan seed data awal atau tambahkan akun secara manual."
      />
    </>
  )
}
