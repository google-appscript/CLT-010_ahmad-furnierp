'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { temukanJalurAktif, type ItemMenu } from '@/lib/navigasi'

/**
 * Bilah menu mendatar berisi halaman-halaman dari seksi yang sedang aktif.
 *
 * Tingkat terdalam navigasi sengaja ditempatkan di sini, bukan di sidebar,
 * agar sidebar tidak menumpuk puluhan halaman sekaligus. Bilah ini hanya
 * muncul bila halaman yang sedang dibuka berada di dalam sebuah seksi.
 */
export function BilahMenu({ item }: { item: ItemMenu[] }) {
  const jalur = usePathname()
  const { grup, seksi, halaman } = temukanJalurAktif(item, jalur)

  if (!seksi?.anak || seksi.anak.length === 0) return null

  return (
    <nav
      aria-label={`Menu ${seksi.label}`}
      className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-chrome-border bg-chrome-background px-4 text-chrome-foreground"
    >
      <span className="mr-2 shrink-0 text-xs text-chrome-muted-foreground">
        {grup?.label} · {seksi.label}
      </span>
      {seksi.anak.map((h) => (
        <Link
          key={h.rute}
          href={h.rute!}
          aria-current={halaman?.rute === h.rute ? 'page' : undefined}
          className={cn(
            'shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors',
            halaman?.rute === h.rute
              ? 'border-b-2 border-primary font-medium text-chrome-foreground'
              : 'text-chrome-muted-foreground hover:text-chrome-foreground',
          )}
        >
          {h.label}
        </Link>
      ))}
    </nav>
  )
}
