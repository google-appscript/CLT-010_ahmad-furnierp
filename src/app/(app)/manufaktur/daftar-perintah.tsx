import { asc } from 'drizzle-orm'
import { db } from '@/db/klien'
import { products, uoms } from '@/db/schema'
import { daftarPerintahProduksi } from '@/modules/manufaktur/layanan/perintah-produksi'
import { LABEL_STATUS_PERINTAH_PRODUKSI } from '@/modules/manufaktur/validasi/produksi'
import { formatAngka } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import type { ParameterDaftar } from '@/lib/daftar'

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  selesai: 'default', dikonfirmasi: 'default', draft: 'secondary', dibatalkan: 'outline',
}

export async function DaftarPerintah({ param }: { param: ParameterDaftar }) {
  const [{ data: perintah, totalBaris }, semuaProduk, semuaSatuan] = await Promise.all([
    daftarPerintahProduksi(param),
    db.select({ id: products.id, kode: products.kode, nama: products.nama })
      .from(products).orderBy(asc(products.kode)),
    db.select({ id: uoms.id, nama: uoms.nama }).from(uoms),
  ])

  const produkLewatId = new Map(semuaProduk.map((p) => [p.id, `${p.kode} — ${p.nama}`]))
  const satuanLewatId = new Map(semuaSatuan.map((s) => [s.id, s.nama]))

  const kolom: Kolom<(typeof perintah)[number]>[] = [
    { kunci: 'nomor', judul: 'Nomor', render: (p) => <span className="font-mono text-xs">{p.nomor ?? '—'}</span> },
    { kunci: 'tanggal', judul: 'Tanggal', render: (p) => p.tanggal },
    { kunci: 'produk', judul: 'Produk', render: (p) => produkLewatId.get(p.produkId) ?? '—' },
    {
      kunci: 'kuantitas', judul: 'Kuantitas', rataKanan: true,
      render: (p) => `${formatAngka(p.kuantitas, 2)} ${satuanLewatId.get(p.uomId) ?? ''}`,
    },
    {
      kunci: 'hargaPokokSatuan', judul: 'Harga Pokok Satuan', rataKanan: true,
      render: (p) => (p.hargaPokokSatuan ? formatAngka(p.hargaPokokSatuan) : '—'),
    },
    {
      kunci: 'status', judul: 'Status',
      render: (p) => <Badge variant={VARIAN[p.status]}>{LABEL_STATUS_PERINTAH_PRODUKSI[p.status]}</Badge>,
    },
  ]

  const pengelompokan = param.kelompokkan === 'status'
    ? {
        kelompokkanDari: (p: (typeof perintah)[number]) => p.status,
        label: (nilaiGrup: string) => LABEL_STATUS_PERINTAH_PRODUKSI[nilaiGrup] ?? nilaiGrup,
      }
    : undefined

  return (
    <TabelData
      kolom={kolom}
      baris={perintah}
      kunciBaris={(p) => p.id}
      pesanKosong="Belum ada perintah produksi."
      hrefBaris={(p) => `/manufaktur/perintah-produksi/${p.id}`}
      pagination={{ halaman: param.halaman, ukuranHalaman: param.ukuranHalaman, totalBaris }}
      pengelompokan={pengelompokan}
    />
  )
}
