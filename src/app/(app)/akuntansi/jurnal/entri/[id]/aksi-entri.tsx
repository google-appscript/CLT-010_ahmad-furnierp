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
import {
  aksiPostingEntri, aksiBalikEntri, aksiBatalkanDraft, aksiHapusDraft,
} from '../aksi'

export function AksiDraft({ id }: { id: string }) {
  const router = useRouter()
  const [bekerja, mulai] = useTransition()

  function posting() {
    mulai(async () => {
      const hasil = await aksiPostingEntri(id)
      if (hasil.berhasil) {
        toast.success('Entri berhasil diposting')
        router.refresh()
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  function batalkan() {
    mulai(async () => {
      const hasil = await aksiBatalkanDraft(id)
      if (hasil.berhasil) {
        toast.success('Draft dibatalkan')
        router.refresh()
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  function hapus() {
    mulai(async () => {
      const hasil = await aksiHapusDraft(id)
      // Bila berhasil, aksi mengalihkan halaman; hanya kegagalan yang kembali.
      if (hasil && !hasil.berhasil) toast.error(hasil.pesan)
    })
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={posting} disabled={bekerja}>
        {bekerja ? 'Memproses…' : 'Posting Entri'}
      </Button>
      <Button variant="outline" onClick={batalkan} disabled={bekerja}>Batalkan</Button>
      <Button variant="outline" onClick={hapus} disabled={bekerja}>Hapus</Button>
    </div>
  )
}

export function AksiBalik({ id, nomor }: { id: string; nomor: string }) {
  const router = useRouter()
  const [terbuka, setTerbuka] = useState(false)
  const [bekerja, mulai] = useTransition()

  function balik(data: FormData) {
    mulai(async () => {
      const hasil = await aksiBalikEntri(id, String(data.get('tanggal') ?? ''))
      if (hasil.berhasil) {
        toast.success('Entri pembalik berhasil dibuat')
        setTerbuka(false)
        router.push(`/akuntansi/jurnal/entri/${hasil.id}`)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        <Button variant="outline">Balik Entri</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Balik Entri {nomor}</DialogTitle>
        </DialogHeader>
        <form action={balik} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Entri asal tidak diubah maupun dihapus. Yang dibuat adalah entri baru dengan posisi
            debit dan kredit tertukar, sehingga gabungan keduanya bersaldo nol.
          </p>
          <div className="space-y-2">
            <Label htmlFor="tanggal">Tanggal Pembalikan</Label>
            <Input
              id="tanggal" name="tanggal" type="date" required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={bekerja}>
              {bekerja ? 'Memproses…' : 'Buat Entri Pembalik'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
