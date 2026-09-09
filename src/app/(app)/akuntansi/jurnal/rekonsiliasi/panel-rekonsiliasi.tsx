'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatAngka } from '@/lib/uang'
import { aksiRekonsiliasi } from './aksi'

export type ItemPanel = {
  itemId: string
  entryId: string
  nomor: string | null
  tanggal: string
  akunKode: string
  akunNama: string
  namaPartner: string | null
  label: string
  debit: string
  kredit: string
}

export type PilihanAkun = { id: string; kode: string; nama: string }

export function PanelRekonsiliasi({
  item, akun, akunTerpilih,
}: {
  item: ItemPanel[]
  akun: PilihanAkun[]
  akunTerpilih: string
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()
  const [dipilih, setDipilih] = useState<Set<string>>(new Set())

  const ringkas = useMemo(() => {
    const terpilih = item.filter((b) => dipilih.has(b.itemId))
    const debit = terpilih.reduce((s, b) => s + Number(b.debit), 0)
    const kredit = terpilih.reduce((s, b) => s + Number(b.kredit), 0)
    const akunUnik = new Set(terpilih.map((b) => b.akunKode))
    return {
      jumlah: terpilih.length,
      debit, kredit,
      selisih: debit - kredit,
      lintasAkun: akunUnik.size > 1,
    }
  }, [item, dipilih])

  const dapatDirekonsiliasi =
    ringkas.jumlah >= 2 && !ringkas.lintasAkun && Math.abs(ringkas.selisih) < 0.005

  function alih(id: string, aktif: boolean) {
    setDipilih((lama) => {
      const baru = new Set(lama)
      if (aktif) baru.add(id)
      else baru.delete(id)
      return baru
    })
  }

  function jalankan() {
    mulai(async () => {
      const hasil = await aksiRekonsiliasi(
        [...dipilih], new Date().toISOString().slice(0, 10),
      )
      if (hasil.berhasil) {
        toast.success('Item jurnal direkonsiliasi')
        setDipilih(new Set())
        router.refresh()
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="akun">Akun</Label>
          <Select
            value={akunTerpilih}
            onValueChange={(v) => router.push(
              v === 'semua' ? '/akuntansi/jurnal/rekonsiliasi'
                : `/akuntansi/jurnal/rekonsiliasi?akun=${v}`,
            )}
          >
            <SelectTrigger id="akun" className="w-80">
              <SelectValue placeholder="Semua akun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua akun</SelectItem>
              {akun.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 rounded-md border bg-muted/40 px-4 py-2 text-sm">
          {ringkas.jumlah === 0 ? (
            <span className="text-muted-foreground">
              Pilih item yang saling menutup. Debit harus sama dengan kredit.
            </span>
          ) : (
            <span>
              {ringkas.jumlah} item · Debit {formatAngka(ringkas.debit.toFixed(2))} · Kredit{' '}
              {formatAngka(ringkas.kredit.toFixed(2))} · Selisih{' '}
              <span className={dapatDirekonsiliasi ? '' : 'font-medium text-destructive'}>
                {formatAngka(ringkas.selisih.toFixed(2))}
              </span>
              {ringkas.lintasAkun && (
                <span className="ml-2 text-destructive">Item harus berada pada satu akun.</span>
              )}
            </span>
          )}
        </div>

        <Button onClick={jalankan} disabled={!dapatDirekonsiliasi || bekerja}>
          {bekerja ? 'Memproses…' : 'Rekonsiliasi Terpilih'}
        </Button>
      </div>

      {item.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Tidak ada item terbuka pada akun yang dapat direkonsiliasi.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="w-10 px-4 py-2" />
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left font-medium">Jurnal</th>
                <th className="px-4 py-2 text-left font-medium">Akun</th>
                <th className="px-4 py-2 text-left font-medium">Mitra</th>
                <th className="px-4 py-2 text-left font-medium">Keterangan</th>
                <th className="px-4 py-2 text-right font-medium">Debit</th>
                <th className="px-4 py-2 text-right font-medium">Kredit</th>
              </tr>
            </thead>
            <tbody>
              {item.map((b) => (
                <tr key={b.itemId} className="border-b">
                  <td className="px-4 py-1.5">
                    <Checkbox
                      checked={dipilih.has(b.itemId)}
                      onCheckedChange={(v) => alih(b.itemId, v === true)}
                      aria-label={`Pilih item ${b.nomor ?? ''}`}
                    />
                  </td>
                  <td className="px-4 py-1.5">{b.tanggal}</td>
                  <td className="px-4 py-1.5 font-mono text-xs">{b.nomor ?? '—'}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {b.akunKode} — {b.akunNama}
                  </td>
                  <td className="px-4 py-1.5">{b.namaPartner ?? '—'}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">{b.label}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {Number(b.debit) > 0 ? formatAngka(b.debit) : '—'}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {Number(b.kredit) > 0 ? formatAngka(b.kredit) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
