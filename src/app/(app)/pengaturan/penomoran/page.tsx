import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { sequences, sequencePeriods } from '@/db/schema'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'

export const metadata = { title: 'Penomoran Dokumen' }

type BarisUrutan = typeof sequences.$inferSelect & { berikut: number }

const LABEL_RESET: Record<string, string> = {
  tidak_pernah: 'Tidak pernah',
  tahunan: 'Setiap tahun',
  bulanan: 'Setiap bulan',
}

function contohNomor(u: BarisUrutan): string {
  const nomor = String(u.berikut).padStart(u.panjangDigit, '0')
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
    render: (u) => u.berikut,
  },
  {
    kunci: 'contoh', judul: 'Contoh',
    render: (u) => <span className="font-mono text-sm">{contohNomor(u)}</span>,
  },
]

export default async function HalamanPenomoran() {
  await wajibIzin('pengaturan.penomoran.kelola')

  // Pencacah disimpan per periode, jadi yang ditampilkan adalah pencacah
  // periode berjalan — bukan satu angka yang berlaku untuk semua bulan.
  const kini = new Date()
  const tahun = kini.getUTCFullYear()
  const bulan = kini.getUTCMonth() + 1

  const [daftar, periode] = await Promise.all([
    db.select().from(sequences).orderBy(asc(sequences.kode)),
    db.select().from(sequencePeriods),
  ])

  function pencacah(u: typeof sequences.$inferSelect): number {
    const cocok = periode.find((p) =>
      p.sequenceId === u.id &&
      p.tahun === (u.reset === 'tidak_pernah' ? 0 : tahun) &&
      p.bulan === (u.reset === 'bulanan' ? bulan : 0))
    return cocok?.nomorBerikut ?? u.nomorBerikut
  }

  const urutan: BarisUrutan[] = daftar.map((u) => ({ ...u, berikut: pencacah(u) }))

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
        Halaman ini hanya menampilkan, dan angkanya berlaku untuk periode berjalan. Setiap
        periode punya pencacahnya sendiri sehingga dokumen bertanggal mundur tidak pernah
        menabrak nomor yang sudah terbit.
      </p>
    </>
  )
}
