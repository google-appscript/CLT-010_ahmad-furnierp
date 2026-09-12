import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarPengguna, type BarisPengguna } from '@/modules/identitas/layanan/pengguna'
import { daftarPeranDenganIzin } from '@/modules/identitas/repositori/peran'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogPengguna, TombolStatusPengguna, type PilihanPeran } from './dialog-pengguna'

export const metadata = { title: 'Pengguna' }

const penanggalan = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
})

function kolomPengguna(peran: PilihanPeran[]): Kolom<BarisPengguna>[] {
  return [
    { kunci: 'nama', judul: 'Nama', render: (p) => p.nama },
    { kunci: 'email', judul: 'Email', render: (p) => p.email },
    {
      kunci: 'peran', judul: 'Peran', lebar: '160px',
      render: (p) => (
        <span className="flex gap-1">
          {p.peran.map((n) => <Badge key={n} variant="secondary">{n}</Badge>)}
        </span>
      ),
    },
    {
      kunci: 'masuk', judul: 'Terakhir Masuk', lebar: '200px',
      render: (p) => (p.lastLoginAt ? penanggalan.format(p.lastLoginAt) : 'Belum pernah'),
    },
    {
      kunci: 'status', judul: 'Status', lebar: '100px',
      render: (p) => (
        <Badge variant={p.isActive ? 'secondary' : 'outline'}>
          {p.isActive ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
    {
      kunci: 'aksi', judul: '', lebar: '160px', rataKanan: true,
      render: (p) => (
        <>
          <DialogPengguna
            pengguna={{ id: p.id, email: p.email, nama: p.nama }}
            peran={peran}
            pemicu={<Button variant="ghost" size="sm">Ubah</Button>}
          />
          <TombolStatusPengguna id={p.id} isActive={p.isActive} />
        </>
      ),
    },
  ]
}

export default async function HalamanPengguna() {
  await wajibIzin('pengaturan.pengguna.kelola')
  const [pengguna, peranLengkap] = await Promise.all([daftarPengguna(), daftarPeranDenganIzin()])
  const peran: PilihanPeran[] = peranLengkap.map((p) => ({ id: p.id, nama: p.nama }))

  return (
    <>
      <KepalaHalaman
        judul="Pengguna"
        deskripsi="Satu pengguna memegang satu peran. Pengguna dinonaktifkan, tidak dihapus."
        aksi={
          <DialogPengguna
            peran={peran}
            pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Pengguna</Button>}
          />
        }
      />
      <TabelData
        kolom={kolomPengguna(peran)}
        baris={pengguna}
        kunciBaris={(p) => p.id}
        pesanKosong="Belum ada pengguna."
      />
    </>
  )
}
