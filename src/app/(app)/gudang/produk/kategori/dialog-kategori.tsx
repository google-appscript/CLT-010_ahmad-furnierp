'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { aksiSimpanKategoriProduk, aksiUbahStatusKategoriProduk } from './aksi'

export type PilihanAkun = { id: string; kode: string; nama: string; tipeAkun: string }

export type NilaiKategori = {
  id?: string
  kode: string
  nama: string
  akunPersediaanId: string
  akunHppId: string
  akunSelisihId: string
  akunBarangRusakId: string
}

/** Akun yang masuk akal untuk tiap peran, disaring dari tipenya. */
const TIPE_SAH: Record<string, string[]> = {
  akunPersediaanId: ['aset_persediaan'],
  akunHppId: ['beban_hpp'],
  akunSelisihId: ['beban_hpp', 'beban_operasional', 'beban_lain'],
  akunBarangRusakId: ['beban_hpp', 'beban_operasional', 'beban_lain'],
}

const LABEL: Record<string, string> = {
  akunPersediaanId: 'Akun Persediaan',
  akunHppId: 'Akun Harga Pokok',
  akunSelisihId: 'Akun Selisih Opname',
  akunBarangRusakId: 'Akun Barang Rusak',
}

export function DialogKategoriProduk({
  kategori, akun, pemicu,
}: {
  kategori?: NilaiKategori
  akun: PilihanAkun[]
  pemicu: React.ReactNode
}) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [bekerja, mulai] = useTransition()
  const [nilai, setNilai] = useState<Record<string, string>>({
    akunPersediaanId: kategori?.akunPersediaanId ?? '',
    akunHppId: kategori?.akunHppId ?? '',
    akunSelisihId: kategori?.akunSelisihId ?? '',
    akunBarangRusakId: kategori?.akunBarangRusakId ?? '',
  })

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanKategoriProduk(kategori?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        akunPersediaanId: nilai.akunPersediaanId,
        akunHppId: nilai.akunHppId,
        akunSelisihId: nilai.akunSelisihId,
        akunBarangRusakId: nilai.akunBarangRusakId,
      })
      if (hasil.berhasil) {
        toast.success(kategori ? 'Kategori diperbarui' : 'Kategori dibuat')
        setTerbuka(false)
        router.refresh()
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>{pemicu}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{kategori ? 'Ubah Kategori Produk' : 'Tambah Kategori Produk'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kode">Kode</Label>
              <Input id="kode" name="kode" required defaultValue={kategori?.kode} placeholder="BB" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nama">Nama</Label>
              <Input id="nama" name="nama" required defaultValue={kategori?.nama} />
            </div>
          </div>

          {Object.keys(TIPE_SAH).map((peran) => {
            const pilihan = akun.filter((a) => TIPE_SAH[peran].includes(a.tipeAkun))
            return (
              <div key={peran} className="space-y-2">
                <Label htmlFor={peran}>{LABEL[peran]}</Label>
                <Select
                  value={nilai[peran]}
                  onValueChange={(v) => setNilai((l) => ({ ...l, [peran]: v }))}
                  required
                >
                  <SelectTrigger id={peran} className="w-full">
                    <SelectValue placeholder="Pilih akun" />
                  </SelectTrigger>
                  <SelectContent>
                    {pilihan.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}

          <p className="text-sm text-muted-foreground">
            Perubahan berlaku untuk pergerakan stok berikutnya. Jurnal yang sudah terbit memakai
            akun yang berlaku saat itu dan tidak ikut berubah.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={bekerja}>
              {bekerja ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TombolStatusKategoriProduk({
  id, isActive,
}: {
  id: string
  isActive: boolean
}) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  return (
    <Button
      variant="ghost" size="sm" disabled={bekerja}
      onClick={() => mulai(async () => {
        const hasil = await aksiUbahStatusKategoriProduk(id, !isActive)
        if (hasil.berhasil) {
          toast.success(isActive ? 'Kategori dinonaktifkan' : 'Kategori diaktifkan')
          router.refresh()
        } else {
          toast.error(hasil.pesan)
        }
      })}
    >
      {isActive ? 'Nonaktifkan' : 'Aktifkan'}
    </Button>
  )
}
