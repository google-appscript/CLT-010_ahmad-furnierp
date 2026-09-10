'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatAngka, kurang, tambah } from '@/lib/uang'
import { cn } from '@/lib/utils'
import { aksiSimpanEntri } from './aksi'
import { PemilihPosBiaya, type PilihanPos, type AlokasiBaris } from './pemilih-pos-biaya'

export type PilihanAkun = { id: string; kode: string; nama: string }
export type PilihanJurnal = { id: string; kode: string; nama: string }
export type PilihanPartner = { id: string; nama: string }
export type PilihanProyek = { id: string; kode: string; nama: string }
export type { PilihanPos }

export type BarisFormulir = {
  accountId: string
  label: string
  debit: string
  kredit: string
  partnerId: string
  projectId: string
  alokasiBiaya: AlokasiBaris[]
}

const BARIS_KOSONG: BarisFormulir = {
  accountId: '', label: '', debit: '', kredit: '',
  partnerId: '', projectId: '', alokasiBiaya: [],
}

export type NilaiAwalEntri = {
  id?: string
  journalId: string
  tanggal: string
  referensi: string
  keterangan: string
  partnerId: string
  item: BarisFormulir[]
}

function angka(v: string): string {
  const bersih = v.trim()
  return bersih === '' ? '0' : bersih
}

export function FormulirEntri({
  awal, akun, jurnal, partner, proyek, posBiaya,
}: {
  awal: NilaiAwalEntri
  akun: PilihanAkun[]
  jurnal: PilihanJurnal[]
  partner: PilihanPartner[]
  proyek: PilihanProyek[]
  posBiaya: PilihanPos[]
}) {
  const router = useRouter()
  const [menyimpan, mulai] = useTransition()
  const [baris, setBaris] = useState<BarisFormulir[]>(
    awal.item.length > 0 ? awal.item : [{ ...BARIS_KOSONG }, { ...BARIS_KOSONG }],
  )
  const [journalId, setJournalId] = useState(awal.journalId)
  const [partnerId, setPartnerId] = useState(awal.partnerId)

  const totalDebit = tambah(...baris.map((b) => angka(b.debit)))
  const totalKredit = tambah(...baris.map((b) => angka(b.kredit)))
  const selisih = kurang(totalDebit, totalKredit)
  const seimbang = Number(selisih) === 0 && Number(totalDebit) > 0

  function ubahBaris(i: number, isi: Partial<BarisFormulir>) {
    setBaris((b) => b.map((x, j) => (j === i ? { ...x, ...isi } : x)))
  }

  function tambahBaris() {
    setBaris((b) => [...b, { ...BARIS_KOSONG }])
  }

  function hapusBaris(i: number) {
    setBaris((b) => (b.length <= 2 ? b : b.filter((_, j) => j !== i)))
  }

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanEntri(awal.id ?? null, {
        journalId,
        tanggal: String(data.get('tanggal') ?? ''),
        referensi: String(data.get('referensi') ?? '') || null,
        keterangan: String(data.get('keterangan') ?? '') || null,
        mataUangId: 'IDR',
        partnerId: partnerId || null,
        item: baris.map((b) => ({
          accountId: b.accountId,
          partnerId: b.partnerId || null,
          label: b.label,
          debit: angka(b.debit),
          kredit: angka(b.kredit),
          nilaiMataUang: null,
          taxId: null,
          projectId: b.projectId || null,
          alokasiBiaya: b.alokasiBiaya,
        })),
      })

      if (hasil.berhasil) {
        toast.success(awal.id ? 'Entri berhasil disimpan' : 'Entri draft berhasil dibuat')
        router.push(`/akuntansi/jurnal/entri/${hasil.id}`)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <form action={simpan} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="journalId">Jurnal</Label>
          <Select value={journalId} onValueChange={setJournalId} required>
            <SelectTrigger id="journalId" className="w-full">
              <SelectValue placeholder="Pilih jurnal" />
            </SelectTrigger>
            <SelectContent>
              {jurnal.map((j) => (
                <SelectItem key={j.id} value={j.id}>{j.kode} — {j.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tanggal">Tanggal</Label>
          <Input id="tanggal" name="tanggal" type="date" defaultValue={awal.tanggal} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="referensi">Referensi</Label>
          <Input id="referensi" name="referensi" defaultValue={awal.referensi} placeholder="Opsional" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="partnerId">Mitra Usaha</Label>
          <Select value={partnerId} onValueChange={setPartnerId}>
            <SelectTrigger id="partnerId" className="w-full">
              <SelectValue placeholder="Opsional" />
            </SelectTrigger>
            <SelectContent>
              {partner.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="keterangan">Keterangan</Label>
        <Textarea id="keterangan" name="keterangan" defaultValue={awal.keterangan} rows={2} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Baris Jurnal</h2>
          <Button type="button" variant="outline" size="sm" onClick={tambahBaris}>
            <Plus className="mr-2 h-4 w-4" />Tambah Baris
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Akun</th>
                <th className="px-3 py-2 text-left font-medium">Keterangan</th>
                <th className="px-3 py-2 text-left font-medium">Mitra</th>
                <th className="px-3 py-2 text-left font-medium">Proyek</th>
                <th className="px-3 py-2 text-left font-medium">Pos Biaya</th>
                <th className="w-40 px-3 py-2 text-right font-medium">Debit</th>
                <th className="w-40 px-3 py-2 text-right font-medium">Kredit</th>
                <th className="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {baris.map((b, i) => (
                <tr key={i} className="border-b">
                  <td className="px-3 py-1.5">
                    <Select
                      value={b.accountId}
                      onValueChange={(v) => ubahBaris(i, { accountId: v })}
                    >
                      <SelectTrigger className="w-full min-w-56">
                        <SelectValue placeholder="Pilih akun" />
                      </SelectTrigger>
                      <SelectContent>
                        {akun.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={b.label}
                      onChange={(e) => ubahBaris(i, { label: e.target.value })}
                      placeholder="Keterangan baris"
                      className="min-w-40"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Select
                      value={b.partnerId}
                      onValueChange={(v) => ubahBaris(i, { partnerId: v })}
                    >
                      <SelectTrigger className="w-full min-w-36">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {partner.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5">
                    <Select
                      value={b.projectId}
                      onValueChange={(v) => ubahBaris(i, { projectId: v })}
                    >
                      <SelectTrigger className="w-full min-w-36">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {proyek.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.kode} — {p.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5">
                    <PemilihPosBiaya
                      nilai={b.alokasiBiaya}
                      pos={posBiaya}
                      onUbah={(alokasiBiaya) => ubahBaris(i, { alokasiBiaya })}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={b.debit}
                      onChange={(e) => ubahBaris(i, { debit: e.target.value, kredit: '' })}
                      type="number" step="0.01" min="0" placeholder="0"
                      className="text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={b.kredit}
                      onChange={(e) => ubahBaris(i, { kredit: e.target.value, debit: '' })}
                      type="number" step="0.01" min="0" placeholder="0"
                      className="text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Button
                      type="button" variant="ghost" size="icon"
                      onClick={() => hapusBaris(i)}
                      disabled={baris.length <= 2}
                      aria-label={`Hapus baris ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 bg-muted/40 font-semibold">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatAngka(totalDebit)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatAngka(totalKredit)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <p
          role="status"
          className={cn(
            'mt-3 text-sm',
            seimbang ? 'text-muted-foreground' : 'font-medium text-destructive',
          )}
        >
          {seimbang
            ? 'Entri seimbang.'
            : Number(totalDebit) === 0 && Number(totalKredit) === 0
              ? 'Isi nilai debit dan kredit pada baris di atas.'
              : `Entri belum seimbang — selisih ${formatAngka(selisih)}.`}
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={menyimpan || !seimbang}>
          {menyimpan ? 'Menyimpan…' : 'Simpan Draft'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
      </div>
    </form>
  )
}
