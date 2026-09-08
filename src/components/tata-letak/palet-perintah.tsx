'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import type { ItemMenu } from '@/lib/navigasi'

export function PaletPerintah({ item }: { item: ItemMenu[] }) {
  const [terbuka, setTerbuka] = useState(false)
  const router = useRouter()

  useEffect(() => {
    function tekan(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setTerbuka((t) => !t)
      }
    }
    document.addEventListener('keydown', tekan)
    return () => document.removeEventListener('keydown', tekan)
  }, [])

  function buka(rute: string) {
    setTerbuka(false)
    router.push(rute)
  }

  return (
    <CommandDialog open={terbuka} onOpenChange={setTerbuka} title="Cari Menu">
      <CommandInput placeholder="Cari menu…" />
      <CommandList>
        <CommandEmpty>Menu tidak ditemukan.</CommandEmpty>
        {item.map((grup) => (
          <CommandGroup key={grup.label} heading={grup.label}>
            {grup.anak
              ? grup.anak.map((anak) => (
                  <CommandItem
                    key={anak.rute}
                    value={`${grup.label} ${anak.label}`}
                    onSelect={() => buka(anak.rute!)}
                  >
                    {anak.label}
                  </CommandItem>
                ))
              : (
                  <CommandItem value={grup.label} onSelect={() => buka(grup.rute!)}>
                    {grup.label}
                  </CommandItem>
                )}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
