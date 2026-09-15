
import { wajibIzin } from '@/lib/sesi'
import { daftarJurnal, labelTipeJurnal, type Jurnal } from '@/modules/akuntansi/layanan/jurnal'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { TombolBuat, TombolUbah } from '@/components/data/tombol-aksi'
import { LencanaStatus } from '@/components/data/lencana-status'
import { DialogJurnal, TombolStatusJurnal } from './dialog-jurnal'

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
      <LencanaStatus status={j.isActive ? 'aktif' : 'nonaktif'} label={j.isActive ? 'Aktif' : 'Nonaktif'} />
    ),
  },
  {
    kunci: 'aksi', judul: '', lebar: '160px', rataKanan: true,
    render: (j) => (
      <>
        <DialogJurnal jurnal={j} pemicu={<TombolUbah />} />
        <TombolStatusJurnal id={j.id} isActive={j.isActive} />
      </>
    ),
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
        aksi={<DialogJurnal pemicu={<TombolBuat>Tambah Jurnal</TombolBuat>} />}
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
