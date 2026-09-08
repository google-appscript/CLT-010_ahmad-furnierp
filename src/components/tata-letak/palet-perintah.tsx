'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Command, CommandDialog, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { type ItemMenu } from '@/lib/navigasi'

type Entri = { rute: string; label: string; jalurLengkap: string; grup: string }

/** Meratakan navigasi menjadi daftar halaman beserta jalur menunya. */
function kumpulkanHalaman(item: ItemMenu[]): Entri[] {
  const hasil: Entri[] = []

  for (const grup of item) {
    for (const anak of grup.anak ?? [grup]) {
      if (anak.anak) {
        for (const halaman of anak.anak) {
          if (!halaman.rute) continue
          hasil.push({
            rute: halaman.rute,
            label: halaman.label,
            jalurLengkap: `${grup.label} › ${anak.label} › ${halaman.label}`,
            grup: grup.label,
          })
        }
      } else if (anak.rute) {
        hasil.push({
          rute: anak.rute,
          label: anak.label,
          jalurLengkap: `${grup.label} › ${anak.label}`,
          grup: grup.label,
        })
      }
    }
  }

  return hasil
}

export function PaletPerintah({ item }: { item: ItemMenu[] }) {
  const [terbuka, setTerbuka] = useState(false)
  const router = useRouter()
  const halaman = kumpulkanHalaman(item)

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

  const perGrup = halaman.reduce<Record<string, Entri[]>>((peta, h) => {
    peta[h.grup] = [...(peta[h.grup] ?? []), h]
    return peta
  }, {})

  return (
    <CommandDialog open={terbuka} onOpenChange={setTerbuka} title="Cari Menu">
      {/*
        CommandDialog versi ini merender children langsung di dalam dialog dan
        tidak menyediakan konteks cmdk, sehingga pembungkus Command wajib
        ditulis di sini. Tanpa itu CommandInput gagal saat dipasang.
      */}
      <Command>
        <CommandInput placeholder="Cari menu…" />
        <CommandList>
          <CommandEmpty>Menu tidak ditemukan.</CommandEmpty>
          {Object.entries(perGrup).map(([grup, daftar]) => (
            <CommandGroup key={grup} heading={grup}>
              {daftar.map((h) => (
                <CommandItem
                  key={h.rute}
                  value={h.jalurLengkap}
                  onSelect={() => buka(h.rute)}
                >
                  <span>{h.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{h.jalurLengkap}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
