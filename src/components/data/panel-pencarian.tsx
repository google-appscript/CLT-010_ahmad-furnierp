'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  CheckIcon, LayersIcon, ListFilterIcon, PlusIcon, SearchIcon, StarIcon, XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { uraikanParameterDaftar, serialisasiParameterDaftar, type ParameterDaftar } from '@/lib/daftar'
import { simpanFilterFavoritAction, hapusFilterFavoritAction } from '@/app/(app)/_bersama/aksi-filter-tersimpan'

export type KolomFilterPanel = {
  kunci: string
  label: string
  opsi: { nilai: string; label: string }[]
}

export type KolomGroupByPanel = { kunci: string; label: string }

export type FavoritPanel = { id: string; nama: string; kriteria: ParameterDaftar }

/**
 * Panel kontrol daftar bergaya Odoo: kotak pencarian, chip filter aktif,
 * dropdown pengelompokan, dan favorit tersimpan.
 *
 * Seluruh interaksi hanya mengubah `searchParams` lewat `router.push()` —
 * komponen ini tidak menyimpan hasil query sendiri. Server Component pemanggil
 * (halaman daftar) yang membaca ulang data setiap `searchParams` berubah.
 */
export function PanelPencarian({
  kunciDaftar, kolomFilter, kolomGroupBy, favorit,
}: {
  kunciDaftar: string
  kolomFilter: KolomFilterPanel[]
  kolomGroupBy: KolomGroupByPanel[]
  favorit: FavoritPanel[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const parameter = uraikanParameterDaftar(searchParams)

  const [cariUrlSebelumnya, setCariUrlSebelumnya] = useState(() => searchParams.get('q') ?? '')
  const [cariInput, setCariInput] = useState(() => searchParams.get('q') ?? '')
  const [dialogSimpanTerbuka, setDialogSimpanTerbuka] = useState(false)
  const [menyimpanFavorit, mulaiSimpanFavorit] = useTransition()
  const [menghapusFavorit, mulaiHapusFavorit] = useTransition()

  // Sinkronkan input pencarian saat URL berubah dari luar (favorit, tombol back,
  // dst.) — disesuaikan langsung saat render, bukan lewat efek, mengikuti pola
  // "adjusting state when a prop changes" agar tidak memicu render berantai.
  const cariUrlSaatIni = searchParams.get('q') ?? ''
  if (cariUrlSaatIni !== cariUrlSebelumnya) {
    setCariUrlSebelumnya(cariUrlSaatIni)
    setCariInput(cariUrlSaatIni)
  }

  // Debounce ~300ms sebelum mendorong perubahan pencarian ke URL.
  useEffect(() => {
    const nilaiUrlSaatIni = searchParams.get('q') ?? ''
    if (cariInput === nilaiUrlSaatIni) return

    const timer = setTimeout(() => {
      const base = new URLSearchParams(searchParams.toString())
      const baru = serialisasiParameterDaftar({ cari: cariInput, halaman: 1 }, base)
      router.push(`${pathname}?${baru.toString()}`, { scroll: false })
    }, 300)

    return () => clearTimeout(timer)
  }, [cariInput, pathname, router, searchParams])

  function terapkan(param: Partial<ParameterDaftar>) {
    const base = new URLSearchParams(searchParams.toString())
    const baru = serialisasiParameterDaftar(param, base)
    router.push(`${pathname}?${baru.toString()}`, { scroll: false })
  }

  function ubahFilter(kunciKolom: string, nilai: string, dipilih: boolean) {
    const filterSaatIni = parameter.filter ?? {}
    const nilaiSaatIni = filterSaatIni[kunciKolom] ?? []
    const nilaiBaru = dipilih
      ? [...nilaiSaatIni, nilai]
      : nilaiSaatIni.filter((v) => v !== nilai)
    terapkan({ filter: { ...filterSaatIni, [kunciKolom]: nilaiBaru }, halaman: 1 })
  }

  function pilihGroupBy(kunci: string) {
    terapkan({ kelompokkan: parameter.kelompokkan === kunci ? '' : kunci, halaman: 1 })
  }

  // Menerapkan favorit MENGGANTI seluruh pencarian/filter/kelompok yang aktif,
  // bukan menggabungkannya dengan yang sudah ada di URL.
  function terapkanFavorit(kriteria: ParameterDaftar) {
    const base = new URLSearchParams(searchParams.toString())
    base.delete('q')
    base.delete('filter')
    base.delete('group')
    base.delete('sort')
    const baru = serialisasiParameterDaftar(
      {
        cari: kriteria.cari,
        filter: kriteria.filter,
        kelompokkan: kriteria.kelompokkan,
        urutkan: kriteria.urutkan,
        halaman: 1,
      },
      base,
    )
    router.push(`${pathname}?${baru.toString()}`, { scroll: false })
  }

  function hapusFavorit(id: string, nama: string) {
    mulaiHapusFavorit(async () => {
      const hasil = await hapusFilterFavoritAction(id)
      if (hasil.berhasil) {
        toast.success(`Favorit "${nama}" dihapus`)
        router.refresh()
      } else {
        toast.error(hasil.pesan ?? 'Gagal menghapus favorit')
      }
    })
  }

  function simpanFavorit(data: FormData) {
    const nama = String(data.get('nama') ?? '').trim()
    if (!nama) return

    mulaiSimpanFavorit(async () => {
      const kriteria: Partial<ParameterDaftar> = { ...parameter }
      delete kriteria.halaman

      const hasil = await simpanFilterFavoritAction(kunciDaftar, nama, kriteria)
      if (hasil.berhasil) {
        toast.success('Filter favorit disimpan')
        setDialogSimpanTerbuka(false)
        router.refresh()
      } else {
        toast.error(hasil.pesan ?? 'Gagal menyimpan filter favorit')
      }
    })
  }

  const chipFilter = Object.entries(parameter.filter ?? {}).flatMap(([kunciKolom, nilaiList]) => {
    const kolom = kolomFilter.find((k) => k.kunci === kunciKolom)
    return nilaiList.map((nilai) => ({
      kunciKolom,
      nilai,
      label: `${kolom?.label ?? kunciKolom}: ${kolom?.opsi.find((o) => o.nilai === nilai)?.label ?? nilai}`,
    }))
  })

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={cariInput}
            onChange={(e) => setCariInput(e.target.value)}
            placeholder="Cari…"
            aria-label="Cari"
            className="pl-8"
          />
        </div>

        {kolomFilter.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <ListFilterIcon />
                Filter
                {chipFilter.length > 0 && (
                  <Badge variant="secondary">{chipFilter.length}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72">
              <div className="space-y-3">
                {kolomFilter.map((kolom) => (
                  <div key={kolom.kunci} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{kolom.label}</p>
                    <div className="space-y-1">
                      {kolom.opsi.map((opsi) => {
                        const id = `panel-filter-${kolom.kunci}-${opsi.nilai}`
                        const dicentang = (parameter.filter?.[kolom.kunci] ?? []).includes(opsi.nilai)
                        return (
                          <div key={opsi.nilai} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent">
                            <Checkbox
                              id={id}
                              checked={dicentang}
                              onCheckedChange={(checked) => ubahFilter(kolom.kunci, opsi.nilai, checked === true)}
                            />
                            <Label htmlFor={id} className="font-normal">{opsi.label}</Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {kolomGroupBy.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <LayersIcon />
                {parameter.kelompokkan
                  ? `Kelompok: ${kolomGroupBy.find((k) => k.kunci === parameter.kelompokkan)?.label ?? parameter.kelompokkan}`
                  : 'Kelompokkan'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Kelompokkan berdasarkan</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {kolomGroupBy.map((kolom) => (
                <DropdownMenuItem key={kolom.kunci} onSelect={() => pilihGroupBy(kolom.kunci)}>
                  {kolom.kunci === parameter.kelompokkan
                    ? <CheckIcon className="size-4" />
                    : <span className="size-4" />}
                  {kolom.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <StarIcon />
              Favorit
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {favorit.length > 0 && (
              <>
                <DropdownMenuLabel>Favorit tersimpan</DropdownMenuLabel>
                {favorit.map((f) => (
                  <div key={f.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className="flex-1 truncate rounded-md px-1.5 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                      onClick={() => terapkanFavorit(f.kriteria)}
                    >
                      {f.nama}
                    </button>
                    <button
                      type="button"
                      aria-label={`Hapus favorit ${f.nama}`}
                      disabled={menghapusFavorit}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      onClick={() => hapusFavorit(f.id, f.nama)}
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </div>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={() => setTimeout(() => setDialogSimpanTerbuka(true), 0)}>
              <PlusIcon />
              Simpan filter saat ini…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {chipFilter.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chipFilter.map((chip) => (
            <Badge key={`${chip.kunciKolom}:${chip.nilai}`} variant="secondary" className="gap-1 pr-1">
              {chip.label}
              <button
                type="button"
                aria-label={`Hapus filter ${chip.label}`}
                className="rounded-full p-0.5 hover:bg-foreground/10"
                onClick={() => ubahFilter(chip.kunciKolom, chip.nilai, false)}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Dialog open={dialogSimpanTerbuka} onOpenChange={setDialogSimpanTerbuka}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Simpan Filter Saat Ini</DialogTitle>
          </DialogHeader>
          <form action={simpanFavorit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nama-favorit">Nama Favorit</Label>
              <Input id="nama-favorit" name="nama" required autoFocus placeholder="mis. Pesanan bulan ini" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogSimpanTerbuka(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={menyimpanFavorit}>
                {menyimpanFavorit ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
