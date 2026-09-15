'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Copy, Printer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type HasilAksiMenu = { berhasil: boolean; pesan?: string; id?: string }

/**
 * Menu roda gigi pada bilah kendali dokumen.
 *
 * Isinya tindakan atas dokumen sebagai satu kesatuan — menggandakan, mencetak,
 * menghapus — bukan tindakan atas isinya. Dipisahkan dari tombol alur kerja di
 * sebelahnya supaya "Hapus" tidak pernah bersebelahan dengan tombol yang
 * paling sering ditekan.
 *
 * Mencetak memakai dialog cetak peramban, yang sekaligus menjadi jalan
 * menyimpan dokumen sebagai PDF tanpa perlu penampil tersendiri.
 */
export function MenuFormulir({
  onHapus, onDuplikat, ruteDuplikat, labelDokumen = 'Dokumen', bolehHapus = true,
  alasanTidakBolehHapus,
}: {
  onHapus?: () => Promise<HasilAksiMenu>
  /** Menggandakan dokumen; hasilnya draft baru yang belum bernomor. */
  onDuplikat?: () => Promise<HasilAksiMenu>
  /** Ke mana pengguna dibawa setelah penggandaan berhasil, `:id` diganti id baru. */
  ruteDuplikat?: string
  labelDokumen?: string
  bolehHapus?: boolean
  alasanTidakBolehHapus?: string
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  function duplikat() {
    if (!onDuplikat) return
    mulai(async () => {
      const hasil = await onDuplikat()
      if (!hasil.berhasil) {
        toast.error(hasil.pesan ?? 'Gagal menggandakan')
        return
      }
      toast.success(`${labelDokumen} digandakan sebagai draft baru`)
      if (ruteDuplikat && hasil.id) router.push(ruteDuplikat.replace(':id', hasil.id))
      else router.refresh()
    })
  }

  function hapus() {
    if (!onHapus) return
    mulai(async () => {
      const hasil = await onHapus()
      // Aksi hapus umumnya mengalihkan halaman sendiri, jadi keberhasilannya
      // tidak selalu kembali sebagai nilai.
      if (hasil && !hasil.berhasil) toast.error(hasil.pesan ?? 'Gagal menghapus')
      else toast.success(`${labelDokumen} dihapus`)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={bekerja} aria-label="Menu dokumen">
          <Settings2 />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {onDuplikat && (
          <DropdownMenuItem onSelect={duplikat}>
            <Copy />
            Duplikat
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => window.print()}>
          <Printer />
          Cetak / Simpan PDF
        </DropdownMenuItem>
        {onHapus && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={!bolehHapus}
              title={bolehHapus ? undefined : alasanTidakBolehHapus}
              onSelect={hapus}
            >
              <Trash2 />
              Hapus
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
