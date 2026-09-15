import Link from 'next/link'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from 'cn'

/**
 * Tiga aksi yang muncul di hampir setiap layar — membuat, mengubah, menghapus —
 * dipusatkan di sini supaya ikon dan warnanya sama di seluruh aplikasi.
 *
 * Warna membawa arti: biru primer mengajak menambah, kuning menandai perubahan
 * pada data yang sudah ada, merah memperingatkan bahwa datanya akan hilang.
 * Pengguna mengenali aksi dari warnanya sebelum sempat membaca labelnya.
 */

const KELAS_UBAH =
  'text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 ' +
  'dark:text-amber-400 dark:hover:bg-amber-400/10 dark:hover:text-amber-300'

type PropsTombol = React.ComponentProps<typeof Button> & { href?: string }

function bungkus(
  ikon: React.ReactNode,
  { href, children, ...props }: PropsTombol,
) {
  if (href) {
    return (
      <Button {...props} asChild>
        <Link href={href}>{ikon}{children}</Link>
      </Button>
    )
  }
  return <Button {...props}>{ikon}{children}</Button>
}

export function TombolBuat({ children = 'Tambah', ...props }: PropsTombol) {
  return bungkus(<Plus />, { ...props, children })
}

export function TombolUbah({
  children = 'Ubah', variant = 'ghost', size = 'sm', className, ...props
}: PropsTombol) {
  return bungkus(<Pencil />, {
    ...props, variant, size, className: cn(KELAS_UBAH, className), children,
  })
}

export function TombolHapus({
  children = 'Hapus', variant = 'destructive', size = 'sm', ...props
}: PropsTombol) {
  return bungkus(<Trash2 />, { ...props, variant, size, children })
}
