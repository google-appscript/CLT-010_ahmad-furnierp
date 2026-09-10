'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { TableRow, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { serialisasiParameterDaftar } from '@/lib/daftar'

/**
 * Potongan interaktif `TabelData` yang membutuhkan hook klien (router, state).
 * Dipisah dari `tabel-data.tsx` — yang tetap Server Component agar prop fungsi
 * (`kolom[].render`, `kunciBaris`) dari pemanggil boleh terus lewat tanpa
 * melanggar batas serialisasi Server→Client Component. Komponen di sini hanya
 * menerima data serializable dan anak yang sudah dirender.
 */

/** Membungkus satu baris tabel agar seluruh barisnya bisa diklik untuk navigasi. */
export function BarisKlik({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter()

  return (
    <TableRow
      className="cursor-pointer"
      onClick={(e) => {
        // Jangan navigasi bila klik jatuh pada elemen interaktif di dalam sel
        // (tombol aksi, tautan, dsb.) — hanya area kosong baris yang menavigasi.
        const target = e.target as HTMLElement
        if (target.closest('button, a, [role="button"], input, [role="checkbox"]')) return
        router.push(href)
      }}
    >
      {children}
    </TableRow>
  )
}

/** Pager kompak bergaya Odoo: "dari-sampai / total" plus tombol prev/next. */
export function PagerTabel({
  pagination,
}: {
  pagination: { halaman: number; ukuranHalaman: number; totalBaris: number }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { halaman, ukuranHalaman, totalBaris } = pagination

  const dari = totalBaris === 0 ? 0 : (halaman - 1) * ukuranHalaman + 1
  const sampai = Math.min(halaman * ukuranHalaman, totalBaris)
  const adaSebelumnya = halaman > 1
  const adaBerikutnya = sampai < totalBaris

  function keHalaman(halamanBaru: number) {
    const base = new URLSearchParams(searchParams.toString())
    const baru = serialisasiParameterDaftar({ halaman: halamanBaru }, base)
    router.push(`${pathname}?${baru.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center justify-end gap-2 border-t px-4 py-2 text-sm text-muted-foreground">
      <span className="tabular-nums">{`${dari}-${sampai} / ${totalBaris}`}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={!adaSebelumnya}
        onClick={() => keHalaman(halaman - 1)}
        aria-label="Halaman sebelumnya"
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={!adaBerikutnya}
        onClick={() => keHalaman(halaman + 1)}
        aria-label="Halaman berikutnya"
      >
        <ChevronRightIcon />
      </Button>
    </div>
  )
}

/** Header grup yang bisa dilipat; anggotanya (baris tabel) dikirim sebagai children. */
export function KelompokBaris({
  label, jumlah, jumlahKolom, children,
}: {
  label: string
  jumlah: number
  jumlahKolom: number
  children: React.ReactNode
}) {
  const [terbuka, setTerbuka] = useState(true)

  return (
    <>
      <TableRow
        className="cursor-pointer bg-muted/30 hover:bg-muted/50"
        aria-expanded={terbuka}
        onClick={() => setTerbuka((t) => !t)}
      >
        <TableCell colSpan={jumlahKolom} className="font-medium">
          <span className="inline-flex items-center gap-1.5">
            {terbuka ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
            {label}
            <span className="font-normal text-muted-foreground">({jumlah})</span>
          </span>
        </TableCell>
      </TableRow>
      {terbuka && children}
    </>
  )
}
