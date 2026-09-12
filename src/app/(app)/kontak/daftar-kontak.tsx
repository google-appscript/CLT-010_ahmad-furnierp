import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarPartner, type Partner } from '@/modules/akuntansi/layanan/partner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogPartner, TombolStatusPartner } from './dialog-partner'

/** NPWP disimpan sebagai angka; pemformatan hanya untuk tampilan. */
function formatNpwp(npwp: string | null): string {
  if (!npwp) return '—'
  if (npwp.length !== 15) return npwp
  return `${npwp.slice(0, 2)}.${npwp.slice(2, 5)}.${npwp.slice(5, 8)}.${npwp.slice(8, 9)}-${npwp.slice(9, 12)}.${npwp.slice(12)}`
}

const kolom: Kolom<Partner>[] = [
  {
    kunci: 'kode', judul: 'Kode', lebar: '130px',
    render: (m) => <span className="font-mono text-sm">{m.kode}</span>,
  },
  { kunci: 'nama', judul: 'Nama', render: (m) => m.nama },
  {
    kunci: 'peran', judul: 'Peran', lebar: '180px',
    render: (m) => (
      <span className="flex gap-1">
        {m.isPelanggan && <Badge variant="secondary">Pelanggan</Badge>}
        {m.isPemasok && <Badge variant="secondary">Pemasok</Badge>}
      </span>
    ),
  },
  {
    kunci: 'npwp', judul: 'NPWP', lebar: '190px',
    render: (m) => <span className="font-mono text-sm">{formatNpwp(m.npwp)}</span>,
  },
  { kunci: 'kota', judul: 'Kota', render: (m) => m.kota ?? '—' },
  {
    kunci: 'status', judul: 'Status', lebar: '100px',
    render: (m) => (
      <Badge variant={m.isActive ? 'secondary' : 'outline'}>
        {m.isActive ? 'Aktif' : 'Nonaktif'}
      </Badge>
    ),
  },
  {
    kunci: 'aksi', judul: '', lebar: '160px', rataKanan: true,
    render: (m) => (
      <>
        <DialogPartner partner={m} pemicu={<Button variant="ghost" size="sm">Ubah</Button>} />
        <TombolStatusPartner id={m.id} isActive={m.isActive} />
      </>
    ),
  },
]

export async function DaftarKontak({
  judul, deskripsi, peran,
}: {
  judul: string
  deskripsi: string
  peran?: 'pelanggan' | 'pemasok'
}) {
  await wajibIzin('kontak.partner.lihat')
  const mitra = await daftarPartner(peran ? { peran } : {})

  return (
    <>
      <KepalaHalaman
        judul={judul}
        deskripsi={deskripsi}
        aksi={
          <DialogPartner
            peranAwal={peran}
            pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Mitra</Button>}
          />
        }
      />
      <TabelData
        kolom={kolom}
        baris={mitra}
        kunciBaris={(m) => m.id}
        pesanKosong="Belum ada mitra usaha yang terdaftar."
      />
    </>
  )
}
