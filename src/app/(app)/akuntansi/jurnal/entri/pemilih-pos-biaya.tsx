'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type PilihanPos = { id: string; kode: string; nama: string }

/** Satu baris pembagian: pos biaya beserta porsinya dalam persen. */
export type AlokasiBaris = { costCenterId: string; persentase: string }

const TANPA_POS = 'tanpa-pos'
const BAGI = 'bagi-beberapa'

/**
 * Pemilih pos biaya untuk satu baris jurnal.
 *
 * Satu pos adalah kasus yang jauh lebih sering, jadi ia cukup dipilih langsung
 * dari daftar. Pembagian ke beberapa pos — tagihan listrik satu gedung yang
 * dipakai dua unit, misalnya — dibuka lewat dialog tersendiri agar barisnya
 * tidak menjadi sesak untuk kasus yang biasa.
 *
 * Apa pun bentuknya, hasilnya disimpan dalam satu bentuk: daftar baris
 * berpersentase yang jumlahnya seratus.
 */
export function PemilihPosBiaya({
  nilai, pos, onUbah,
}: {
  nilai: AlokasiBaris[]
  pos: PilihanPos[]
  onUbah: (baris: AlokasiBaris[]) => void
}) {
  const [dialogTerbuka, setDialogTerbuka] = useState(false)

  const tunggal = nilai.length === 1 && Number(nilai[0].persentase) === 100
  const terpilih = nilai.length === 0 ? TANPA_POS : tunggal ? nilai[0].costCenterId : BAGI

  function pilih(v: string) {
    if (v === TANPA_POS) {
      onUbah([])
      return
    }
    if (v === BAGI) {
      setDialogTerbuka(true)
      return
    }
    onUbah([{ costCenterId: v, persentase: '100' }])
  }

  const ringkas = nilai.length > 1
    ? `Terbagi ${nilai.length} pos`
    : undefined

  return (
    <>
      <Select value={terpilih} onValueChange={pilih}>
        <SelectTrigger className="w-full min-w-40">
          <SelectValue placeholder="—">{ringkas}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TANPA_POS}>Tanpa pos</SelectItem>
          {pos.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.kode} — {p.nama}</SelectItem>
          ))}
          <SelectItem value={BAGI}>Bagi ke beberapa pos…</SelectItem>
        </SelectContent>
      </Select>

      <DialogAlokasi
        terbuka={dialogTerbuka}
        onTutup={() => setDialogTerbuka(false)}
        nilai={nilai}
        pos={pos}
        onSimpan={(baris) => { onUbah(baris); setDialogTerbuka(false) }}
      />
    </>
  )
}

function DialogAlokasi({
  terbuka, onTutup, nilai, pos, onSimpan,
}: {
  terbuka: boolean
  onTutup: () => void
  nilai: AlokasiBaris[]
  pos: PilihanPos[]
  onSimpan: (baris: AlokasiBaris[]) => void
}) {
  const [baris, setBaris] = useState<AlokasiBaris[]>(
    nilai.length > 1 ? nilai : [{ costCenterId: '', persentase: '' }, { costCenterId: '', persentase: '' }],
  )

  const terisi = baris.filter((b) => b.costCenterId && Number(b.persentase) > 0)
  const total = terisi.reduce((t, b) => t + Number(b.persentase), 0)
  const posGanda = new Set(terisi.map((b) => b.costCenterId)).size !== terisi.length
  const sah = terisi.length >= 1 && Math.abs(total - 100) < 0.0001 && !posGanda

  function ubah(i: number, u: Partial<AlokasiBaris>) {
    setBaris((l) => l.map((b, j) => (j === i ? { ...b, ...u } : b)))
  }

  /** Membagi sisa persentase rata ke baris yang belum terisi. */
  function ratakan() {
    const n = baris.length
    const rata = (100 / n).toFixed(4)
    const sisa = (100 - Number(rata) * (n - 1)).toFixed(4)
    setBaris((l) => l.map((b, i) => ({ ...b, persentase: i === n - 1 ? sisa : rata })))
  }

  return (
    <Dialog open={terbuka} onOpenChange={(o) => { if (!o) onTutup() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bagi Beban ke Beberapa Pos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Nilai baris jurnal dibagi menurut persentase di bawah. Jumlahnya harus tepat 100%
            agar laporan per pos selalu menjumlah kembali ke laba rugi keseluruhan.
          </p>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Pos Biaya</th>
                  <th className="w-32 px-3 py-2 text-right font-medium">Persen</th>
                  <th className="w-12 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {baris.map((b, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-1.5">
                      <Select
                        value={b.costCenterId}
                        onValueChange={(v) => ubah(i, { costCenterId: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih pos" />
                        </SelectTrigger>
                        <SelectContent>
                          {pos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.kode} — {p.nama}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        value={b.persentase}
                        onChange={(e) => ubah(i, { persentase: e.target.value })}
                        type="number" step="0.0001" min="0" max="100"
                        className="text-right tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Button
                        type="button" variant="ghost" size="icon"
                        aria-label={`Hapus pembagian ${i + 1}`}
                        disabled={baris.length <= 2}
                        onClick={() => setBaris((l) => l.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setBaris((l) => [...l, { costCenterId: '', persentase: '' }])}
            >
              <Plus className="mr-2 h-4 w-4" />Tambah Pos
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={ratakan}>
              Ratakan
            </Button>
            <Label className={`text-sm ${sah ? 'text-muted-foreground' : 'text-destructive'}`}>
              Total {total.toFixed(2)}%
              {posGanda && ' · satu pos muncul dua kali'}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onTutup}>Batal</Button>
          <Button type="button" disabled={!sah} onClick={() => onSimpan(terisi)}>
            Terapkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
