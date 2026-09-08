'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import * as Ikon from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { halamanPertama, temukanJalurAktif, type ItemMenu } from '@/lib/navigasi'

function IkonDinamis({ nama, className }: { nama?: string; className?: string }) {
  if (!nama) return null
  const daftar = Ikon as unknown as Record<string, React.ComponentType<{ className?: string }>>
  const Komponen = daftar[nama]
  return Komponen ? <Komponen className={className} /> : null
}

/**
 * Sidebar hanya menampilkan dua tingkat: grup dan isinya. Halaman di dalam
 * sebuah seksi tidak muncul di sini melainkan di bilah menu mendatar, supaya
 * sidebar tetap pendek meski jumlah halaman banyak.
 */
export function Sidebar({ item }: { item: ItemMenu[] }) {
  const jalur = usePathname()
  const aktif = temukanJalurAktif(item, jalur)
  // Hanya satu grup terbuka pada satu waktu; grup yang memuat halaman aktif
  // terbuka otomatis saat pertama dirender.
  const [terbuka, setTerbuka] = useState<string | null>(aktif.grup?.label ?? null)

  return (
    <nav
      aria-label="Navigasi utama"
      className="flex h-full w-60 shrink-0 flex-col border-r bg-background"
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Ikon.Armchair className="h-5 w-5 text-primary" />
        <span className="font-semibold tracking-tight">ERP Furni</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {item.map((grup) => {
          if (!grup.anak) {
            return (
              <Link
                key={grup.label}
                href={grup.rute!}
                className={cn(
                  'mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  aktif.grup?.label === grup.label
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'hover:bg-accent/50',
                )}
              >
                <IkonDinamis nama={grup.ikon} className="h-4 w-4" />
                {grup.label}
              </Link>
            )
          }

          const dibuka = grup.label === terbuka

          return (
            <div key={grup.label} className="mb-1">
              <button
                type="button"
                aria-expanded={dibuka}
                onClick={() => setTerbuka(dibuka ? null : grup.label)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent/50',
                  aktif.grup?.label === grup.label && 'font-medium',
                )}
              >
                <IkonDinamis nama={grup.ikon} className="h-4 w-4" />
                <span className="flex-1 text-left">{grup.label}</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', dibuka && 'rotate-180')} />
              </button>

              {dibuka && (
                <ul className="ml-4 mt-1 space-y-0.5 border-l pl-4">
                  {grup.anak.map((anak) => {
                    const rute = halamanPertama(anak)
                    if (!rute) return null
                    // Seksi disorot bila salah satu halamannya sedang dibuka.
                    const sedangAktif = anak.anak
                      ? aktif.seksi?.label === anak.label && aktif.grup?.label === grup.label
                      : aktif.halaman?.rute === anak.rute

                    return (
                      <li key={anak.label}>
                        <Link
                          href={rute}
                          className={cn(
                            'block rounded-md px-3 py-1.5 text-sm transition-colors',
                            sedangAktif
                              ? 'bg-accent font-medium text-accent-foreground'
                              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                          )}
                        >
                          {anak.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
