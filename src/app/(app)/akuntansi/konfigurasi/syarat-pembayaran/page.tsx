import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import {
  daftarSyaratPembayaran, type SyaratPembayaran,
} from '@/modules/akuntansi/layanan/syarat-pembayaran'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogSyarat } from './dialog-syarat'

export const metadata = { title: 'Syarat Pembayaran' }

const kolom: Kolom<SyaratPembayaran>[] = [
  { kunci: 'nama', judul: 'Nama', render: (s) => s.nama },
  {
    kunci: 'hari', judul: 'Jatuh Tempo', lebar: '160px', rataKanan: true,
    render: (s) => (s.jumlahHari === 0 ? 'Tunai' : `${s.jumlahHari} hari`),
  },
  { kunci: 'catatan', judul: 'Catatan', render: (s) => s.catatan ?? '—' },
  {
    kunci: 'aksi', judul: '', lebar: '80px', rataKanan: true,
    render: (s) => <DialogSyarat syarat={s} pemicu={<Button variant="ghost" size="sm">Ubah</Button>} />,
  },
]

export default async function HalamanSyaratPembayaran() {
  await wajibIzin('akuntansi.syarat-bayar.kelola')
  const syarat = await daftarSyaratPembayaran()

  return (
    <>
      <KepalaHalaman
        judul="Syarat Pembayaran"
        deskripsi="Menentukan tanggal jatuh tempo faktur dan tagihan."
        aksi={<DialogSyarat pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Syarat</Button>} />}
      />
      <TabelData
        kolom={kolom}
        baris={syarat}
        kunciBaris={(s) => s.id}
        pesanKosong="Belum ada syarat pembayaran."
      />
    </>
  )
}
