import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { sequences } from '@/db/schema'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'

export const metadata = { title: 'Penomoran Dokumen' }

type BarisUrutan = typeof sequences.$inferSelect

const LABEL_RESET: Record<string, string> = {
  tidak_pernah: 'Tidak pernah',
  tahunan: 'Setiap tahun',
  bulanan: 'Setiap bulan',
}

function contohNomor(u: BarisUrutan): string {
  const nomor = String(u.nomorBerikut).padStart(u.panjangDigit, '0')
  if (u.reset === 'bulanan') return `${u.prefix}/2026/09/${nomor}`
  if (u.reset === 'tahunan') return `${u.prefix}/2026/${nomor}`
  return `${u.prefix}/${nomor}`
}

const kolom: Kolom<BarisUrutan>[] = [
  {
    kunci: 'kode', judul: 'Kode', lebar: '200px',
    render: (u) => <span className="font-mono text-sm">{u.kode}</span>,
  },
  { kunci: 'prefix', judul: 'Prefiks', lebar: '100px', render: (u) => u.prefix },
  { kunci: 'reset', judul: 'Reset', lebar: '150px', render: (u) => LABEL_RESET[u.reset] ?? u.reset },
  {
    kunci: 'berikut', judul: 'Nomor Berikutnya', lebar: '160px', rataKanan: true,
    render: (u) => u.nomorBerikut,
  },
  {
    kunci: 'contoh', judul: 'Contoh',
    render: (u) => <span className="font-mono text-sm">{contohNomor(u)}</span>,
  },
]

export default async function HalamanPenomoran() {
  await wajibIzin('pengaturan.penomoran.kelola')
  const urutan = await db.select().from(sequences).orderBy(asc(sequences.kode))

  return (
    <>
      <KepalaHalaman
        judul="Penomoran Dokumen"
        deskripsi="Nomor diberikan saat dokumen diposting, bukan saat draft dibuat, sehingga tidak ada lubang nomor."
      />
      <TabelData
        kolom={kolom}
        baris={urutan}
        kunciBaris={(u) => u.id}
        pesanKosong="Belum ada urutan penomoran."
      />
      <p className="mt-4 text-xs text-muted-foreground">
        Halaman ini hanya menampilkan. Mengubah nomor berikutnya secara manual berisiko
        menghasilkan nomor kembar pada dokumen yang sudah terbit.
      </p>
    </>
  )
}
