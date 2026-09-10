'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Tidak ada sumber eksternal untuk dilanggan — hanya membedakan snapshot server/klien. */
const langganKosong = () => () => {}

/** Sesudah hidrasi klien mengambil alih. Sebelum itu (server & render pertama klien), false. */
function useSudahTerpasang() {
  return useSyncExternalStore(langganKosong, () => true, () => false)
}

export function TombolTema() {
  const mounted = useSudahTerpasang()
  const { resolvedTheme, setTheme } = useTheme()

  if (!mounted) {
    return <div className="size-8" aria-hidden="true" />
  }

  const gelap = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={gelap ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      onClick={() => setTheme(gelap ? 'light' : 'dark')}
    >
      {gelap ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
