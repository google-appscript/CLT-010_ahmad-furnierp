import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarMataUang, daftarKurs, type BarisKurs } from '@/modules/akuntansi/layanan/konfigurasi'
import { MATA_UANG_FUNGSIONAL } from '@/modules/akuntansi/layanan/kurs'
import { formatAngka } from '@/lib/uang'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogKurs, type PilihanMataUang } from './dialog-kurs'

export const metadata = { title: 'Mata Uang & Kurs' }

const kolomKurs: Kolom<BarisKurs>[] = [
  { kunci: 'tanggal', judul: 'Tanggal', lebar: '160px', render: (k) => k.tanggal },
  { kunci: 'mataUang', judul: 'Mata Uang', lebar: '140px', render: (k) => k.kodeMataUang },
  { kunci: 'kurs', judul: 'Kurs (IDR)', rataKanan: true, render: (k) => formatAngka(k.kurs, 2) },
]

export default async function HalamanMataUang() {
  await wajibIzin('akuntansi.mata-uang.kelola')
  const [mataUang, kurs] = await Promise.all([daftarMataUang(), daftarKurs()])

  const pilihan: PilihanMataUang[] = mataUang
    .filter((m) => m.isActive && m.kode !== MATA_UANG_FUNGSIONAL)
    .map((m) => ({ kode: m.kode, nama: m.nama }))

  return (
    <>
      <KepalaHalaman
        judul="Mata Uang & Kurs"
        deskripsi="Kurs bermakna jumlah Rupiah per satu unit mata uang asing."
        aksi={
          <DialogKurs
            mataUang={pilihan}
            pemicu={<Button><Plus className="mr-2 h-4 w-4" />Catat Kurs</Button>}
          />
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Mata Uang Terdaftar</h2>
        <div className="flex flex-wrap gap-2">
          {mataUang.map((m) => (
            <Badge key={m.kode} variant={m.kode === MATA_UANG_FUNGSIONAL ? 'default' : 'secondary'}>
              {m.kode} — {m.nama}{m.kode === MATA_UANG_FUNGSIONAL ? ' (fungsional)' : ''}
            </Badge>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Riwayat Kurs</h2>
        <TabelData
          kolom={kolomKurs}
          baris={kurs}
          kunciBaris={(k) => k.id}
          pesanKosong="Belum ada kurs tercatat."
        />
      </section>
    </>
  )
}
