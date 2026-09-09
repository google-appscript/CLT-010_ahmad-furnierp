import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { BarisKlik, KelompokBaris, PagerTabel } from '@/components/data/tabel-data-interaktif'

export type Kolom<T> = {
  kunci: string
  judul: string
  render: (baris: T) => React.ReactNode
  rataKanan?: boolean
  lebar?: string
}

/**
 * `TabelData` tetap Server Component: `kolom[].render` dan `kunciBaris` adalah
 * fungsi yang dipanggil di sini, di server, sehingga tidak pernah melewati
 * batas serialisasi Server→Client Component. Bagian yang butuh interaktivitas
 * (klik baris, pager, lipat grup) didelegasikan ke komponen klien kecil di
 * `tabel-data-interaktif.tsx` yang hanya menerima data serializable dan anak
 * yang sudah dirender — bukan fungsi.
 */
export function TabelData<T>({
  kolom, baris, kunciBaris, pesanKosong = 'Belum ada data.',
  hrefBaris, pagination, pengelompokan,
}: {
  kolom: Kolom<T>[]
  baris: T[]
  kunciBaris: (baris: T) => string
  pesanKosong?: string
  /** Bila diberikan, seluruh baris jadi bisa diklik untuk navigasi ke halaman detail. */
  hrefBaris?: (baris: T) => string
  /** Bila diberikan, render pager kompak di bawah tabel dan biarkan pemanggil mengendalikan `hal` di URL. */
  pagination?: { halaman: number; ukuranHalaman: number; totalBaris: number }
  /** Bila diberikan, kelompokkan `baris` (data page saat ini, bukan re-query) berdasarkan kunci turunan. */
  pengelompokan?: { kelompokkanDari: (baris: T) => string; label: (nilaiGrup: string) => string }
}) {
  if (baris.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        {pesanKosong}
      </div>
    )
  }

  function renderSelBaris(b: T) {
    return kolom.map((k) => (
      <TableCell key={k.kunci} className={cn(k.rataKanan && 'text-right tabular-nums')}>
        {k.render(b)}
      </TableCell>
    ))
  }

  function renderBaris(b: T) {
    const kunci = kunciBaris(b)
    if (hrefBaris) {
      return (
        <BarisKlik key={kunci} href={hrefBaris(b)}>
          {renderSelBaris(b)}
        </BarisKlik>
      )
    }
    return (
      <TableRow key={kunci}>
        {renderSelBaris(b)}
      </TableRow>
    )
  }

  let isiBaris: React.ReactNode

  if (pengelompokan) {
    const { kelompokkanDari, label } = pengelompokan
    const urutanGrup: string[] = []
    const anggotaGrup = new Map<string, T[]>()
    for (const b of baris) {
      const nilaiGrup = kelompokkanDari(b)
      const anggota = anggotaGrup.get(nilaiGrup)
      if (anggota) {
        anggota.push(b)
      } else {
        anggotaGrup.set(nilaiGrup, [b])
        urutanGrup.push(nilaiGrup)
      }
    }

    isiBaris = urutanGrup.map((nilaiGrup) => {
      const anggota = anggotaGrup.get(nilaiGrup)!
      return (
        <KelompokBaris
          key={nilaiGrup}
          label={label(nilaiGrup)}
          jumlah={anggota.length}
          jumlahKolom={kolom.length}
        >
          {anggota.map((b) => renderBaris(b))}
        </KelompokBaris>
      )
    })
  } else {
    isiBaris = baris.map((b) => renderBaris(b))
  }

  return (
    <div className="rounded-md border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {kolom.map((k) => (
                <TableHead
                  key={k.kunci}
                  className={cn(k.rataKanan && 'text-right')}
                  style={{ width: k.lebar }}
                >
                  {k.judul}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isiBaris}
          </TableBody>
        </Table>
      </div>
      {pagination && <PagerTabel pagination={pagination} />}
    </div>
  )
}
