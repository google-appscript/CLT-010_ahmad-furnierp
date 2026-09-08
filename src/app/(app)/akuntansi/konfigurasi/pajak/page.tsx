import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarPajak, type Pajak } from '@/modules/akuntansi/layanan/pajak'
import { daftarAkun } from '@/modules/akuntansi/layanan/akun'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogPajak, type PilihanAkun } from './dialog-pajak'

export const metadata = { title: 'Pajak' }

/**
 * Tarif disimpan sebagai numeric(9,4) sehingga terbaca '11.0000'. Nilainya
 * persentase kecil, bukan uang, jadi aman melewati Number untuk membuang nol
 * di belakang; pemisah desimal lalu diubah ke koma sesuai gaya Indonesia.
 */
function formatTarif(tarif: string): string {
  return `${String(Number(tarif)).replace('.', ',')}%`
}

function kolomPajak(akunPajak: PilihanAkun[]): Kolom<Pajak>[] {
  return [
    {
      kunci: 'kode', judul: 'Kode', lebar: '130px',
      render: (p) => <span className="font-mono text-sm">{p.kode}</span>,
    },
    { kunci: 'nama', judul: 'Nama', render: (p) => p.nama },
    {
      kunci: 'lingkup', judul: 'Ruang Lingkup', lebar: '150px',
      render: (p) => (p.ruangLingkup === 'penjualan' ? 'Penjualan' : 'Pembelian'),
    },
    {
      kunci: 'tarif', judul: 'Tarif', lebar: '90px', rataKanan: true,
      render: (p) => formatTarif(p.tarif),
    },
    {
      kunci: 'sifat', judul: 'Sifat', lebar: '180px',
      render: (p) => (
        <span className="flex gap-1">
          {p.isPemotongan && <Badge variant="outline">Pemotongan</Badge>}
          {p.hargaTermasukPajak && <Badge variant="outline">Termasuk Harga</Badge>}
        </span>
      ),
    },
    {
      kunci: 'status', judul: 'Status', lebar: '100px',
      render: (p) => (
        <Badge variant={p.isActive ? 'secondary' : 'outline'}>
          {p.isActive ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
    {
      kunci: 'aksi', judul: '', lebar: '80px', rataKanan: true,
      render: (p) => (
        <DialogPajak pajak={p} akunPajak={akunPajak} pemicu={<Button variant="ghost" size="sm">Ubah</Button>} />
      ),
    },
  ]
}

export default async function HalamanPajak() {
  await wajibIzin('akuntansi.pajak.kelola')
  const [pajak, semuaAkun] = await Promise.all([daftarPajak(), daftarAkun()])

  const akunPajak: PilihanAkun[] = semuaAkun
    .filter((a) => a.isActive && (a.tipeAkun === 'liabilitas_pajak' || a.tipeAkun === 'aset_lancar_lain'))
    .map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }))

  return (
    <>
      <KepalaHalaman
        judul="Pajak"
        deskripsi="Tarif tersimpan di basis data dan dapat diubah tanpa penerapan ulang saat regulasi berubah."
        aksi={
          <DialogPajak
            akunPajak={akunPajak}
            pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Pajak</Button>}
          />
        }
      />
      <TabelData
        kolom={kolomPajak(akunPajak)}
        baris={pajak}
        kunciBaris={(p) => p.id}
        pesanKosong="Belum ada pajak. Jalankan seed data awal untuk memuat PPN dan PPh."
      />
    </>
  )
}
