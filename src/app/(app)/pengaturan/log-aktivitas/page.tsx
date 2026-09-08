import { wajibIzin } from '@/lib/sesi'
import { daftarAudit, type BarisAudit } from '@/modules/identitas/layanan/audit'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'

export const metadata = { title: 'Log Aktivitas' }

const LABEL_AKSI: Record<string, string> = {
  buat: 'Buat', ubah: 'Ubah', hapus: 'Hapus',
  posting: 'Posting', balik: 'Balik', masuk: 'Masuk',
}

const LABEL_ENTITAS: Record<string, string> = {
  accounts: 'Bagan Akun',
  partners: 'Mitra Usaha',
  taxes: 'Pajak',
  journals: 'Jurnal',
  payment_terms: 'Syarat Pembayaran',
  company_settings: 'Profil Perusahaan',
  users: 'Pengguna',
  sistem: 'Sistem',
}

const penanggalan = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
})

const kolom: Kolom<BarisAudit>[] = [
  { kunci: 'waktu', judul: 'Waktu', lebar: '200px', render: (l) => penanggalan.format(l.waktu) },
  { kunci: 'pengguna', judul: 'Pengguna', lebar: '180px', render: (l) => l.namaPengguna ?? 'Sistem' },
  {
    kunci: 'entitas', judul: 'Objek', lebar: '180px',
    render: (l) => LABEL_ENTITAS[l.entitas] ?? l.entitas,
  },
  {
    kunci: 'aksi', judul: 'Aksi', lebar: '110px',
    render: (l) => <Badge variant="outline">{LABEL_AKSI[l.aksi] ?? l.aksi}</Badge>,
  },
  {
    kunci: 'detail', judul: 'Perubahan',
    render: (l) => (
      <code className="text-xs text-muted-foreground">
        {l.dataBaru ? JSON.stringify(l.dataBaru).slice(0, 110) : '—'}
      </code>
    ),
  },
]

export default async function HalamanLogAktivitas() {
  await wajibIzin('pengaturan.log.lihat')
  const log = await daftarAudit()

  return (
    <>
      <KepalaHalaman
        judul="Log Aktivitas"
        deskripsi="Menampilkan 200 aktivitas terakhir. Jejak ini tidak dapat dihapus dari antarmuka."
      />
      <TabelData
        kolom={kolom}
        baris={log}
        kunciBaris={(l) => l.id}
        pesanKosong="Belum ada aktivitas tercatat."
      />
    </>
  )
}
