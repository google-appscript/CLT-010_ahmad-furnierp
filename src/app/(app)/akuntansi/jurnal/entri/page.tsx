import Link from 'next/link'
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarEntri } from '@/modules/akuntansi/layanan/entri'
import { daftarJurnal } from '@/modules/akuntansi/layanan/jurnal'
import { LABEL_STATUS } from '@/modules/akuntansi/validasi/entri'
import { uraikanParameterDaftar, type ParameterDaftar } from '@/lib/daftar'
import { daftarFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PanelPencarian } from '@/components/data/panel-pencarian'
import { TabelData, type Kolom } from '@/components/data/tabel-data'

export const metadata = { title: 'Entri Jurnal' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  diposting: 'default', draft: 'secondary', dibatalkan: 'outline',
}

const KUNCI_DAFTAR = 'akuntansi.jurnal.entri'

export default async function HalamanEntriJurnal({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesi = await wajibIzin('akuntansi.jurnal.lihat')

  const sp = await searchParams
  const params = new URLSearchParams()
  for (const [kunci, nilai] of Object.entries(sp)) {
    if (nilai === undefined) continue
    for (const v of Array.isArray(nilai) ? nilai : [nilai]) params.append(kunci, v)
  }
  const param = uraikanParameterDaftar(params)

  const [{ data: entri, totalBaris }, jurnal, favorit] = await Promise.all([
    daftarEntri(param),
    daftarJurnal(),
    daftarFilter(sesi.penggunaId, KUNCI_DAFTAR),
  ])
  const jurnalLewatId = new Map(jurnal.map((j) => [j.id, j.kode]))

  const kolom: Kolom<(typeof entri)[number]>[] = [
    { kunci: 'nomor', judul: 'Nomor', render: (e) => <span className="font-mono text-xs">{e.nomor ?? '—'}</span> },
    { kunci: 'tanggal', judul: 'Tanggal', render: (e) => e.tanggal },
    { kunci: 'jurnal', judul: 'Jurnal', render: (e) => jurnalLewatId.get(e.journalId) ?? '—' },
    { kunci: 'keterangan', judul: 'Keterangan', render: (e) => e.keterangan ?? '—' },
    { kunci: 'referensi', judul: 'Referensi', render: (e) => <span className="text-muted-foreground">{e.referensi ?? '—'}</span> },
    {
      kunci: 'status', judul: 'Status',
      render: (e) => <Badge variant={VARIAN[e.status]}>{LABEL_STATUS[e.status]}</Badge>,
    },
  ]

  const pengelompokan = param.kelompokkan === 'status'
    ? {
        kelompokkanDari: (e: (typeof entri)[number]) => e.status,
        label: (nilaiGrup: string) => LABEL_STATUS[nilaiGrup as keyof typeof LABEL_STATUS] ?? nilaiGrup,
      }
    : param.kelompokkan === 'journalId'
      ? {
          kelompokkanDari: (e: (typeof entri)[number]) => e.journalId,
          label: (nilaiGrup: string) => jurnalLewatId.get(nilaiGrup) ?? '—',
        }
      : undefined

  return (
    <>
      <KepalaHalaman
        judul="Entri Jurnal"
        deskripsi="Nomor diberikan saat posting. Entri yang sudah diposting dikoreksi lewat entri pembalik."
        aksi={
          <Button asChild>
            <Link href="/akuntansi/jurnal/entri/baru">
              <Plus className="mr-2 h-4 w-4" />Buat Entri
            </Link>
          </Button>
        }
      />
      <PanelPencarian
        kunciDaftar={KUNCI_DAFTAR}
        kolomFilter={[
          {
            kunci: 'status',
            label: 'Status',
            opsi: Object.entries(LABEL_STATUS).map(([nilai, label]) => ({ nilai, label })),
          },
        ]}
        kolomGroupBy={[
          { kunci: 'status', label: 'Status' },
          { kunci: 'journalId', label: 'Jurnal' },
        ]}
        favorit={favorit.map((f) => ({ ...f, kriteria: f.kriteria as ParameterDaftar }))}
      />
      <TabelData
        kolom={kolom}
        baris={entri}
        kunciBaris={(e) => e.id}
        pesanKosong="Belum ada entri jurnal."
        hrefBaris={(e) => `/akuntansi/jurnal/entri/${e.id}`}
        pagination={{ halaman: param.halaman, ukuranHalaman: param.ukuranHalaman, totalBaris }}
        pengelompokan={pengelompokan}
      />
    </>
  )
}
