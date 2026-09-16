import { Suspense } from 'react'

import { wajibIzin } from '@/lib/sesi'
import { formatRupiah } from '@/lib/uang'
import { daftarPartner, type Partner } from '@/modules/akuntansi/layanan/partner'
import { LABEL_SATUAN_TARIF } from '@/modules/proyek/validasi/proyek'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { TombolBuat, TombolUbah } from '@/components/data/tombol-aksi'
import { LencanaStatus } from '@/components/data/lencana-status'
import { DialogPartner, TombolStatusPartner } from './dialog-partner'

/** NPWP disimpan sebagai angka; pemformatan hanya untuk tampilan. */
function formatNpwp(npwp: string | null): string {
  if (!npwp) return '—'
  if (npwp.length !== 15) return npwp
  return `${npwp.slice(0, 2)}.${npwp.slice(2, 5)}.${npwp.slice(5, 8)}.${npwp.slice(8, 9)}-${npwp.slice(9, 12)}.${npwp.slice(12)}`
}

export type PeranKontak = 'pelanggan' | 'pemasok' | 'pegawai'

/**
 * Kolom disusun per peran. Halaman Pegawai menampilkan upah menggantikan NPWP
 * dan kota — yang dicari saat membuka daftar tukang adalah tarifnya, bukan
 * data perpajakannya.
 */
function susunKolom(peran?: PeranKontak): Kolom<Partner>[] {
  const identitas: Kolom<Partner>[] = [
    {
      kunci: 'kode', judul: 'Kode', lebar: '130px',
      render: (m) => <span className="font-mono text-sm">{m.kode}</span>,
    },
    { kunci: 'nama', judul: 'Nama', render: (m) => m.nama },
    {
      kunci: 'peran', judul: 'Peran', lebar: '220px',
      render: (m) => (
        <span className="flex flex-wrap gap-1">
          {m.isPelanggan && <Badge variant="secondary">Pelanggan</Badge>}
          {m.isPemasok && <Badge variant="secondary">Pemasok</Badge>}
          {m.isPegawai && <Badge variant="secondary">Pegawai</Badge>}
        </span>
      ),
    },
  ]

  const rinci: Kolom<Partner>[] = peran === 'pegawai'
    ? [
        {
          kunci: 'tarif', judul: 'Upah', lebar: '200px', rataKanan: true,
          render: (m) => (
            <span>
              {formatRupiah(m.tarif)}
              <span className="text-muted-foreground"> / {LABEL_SATUAN_TARIF[m.satuanTarif]}</span>
            </span>
          ),
        },
        { kunci: 'telepon', judul: 'Telepon', render: (m) => m.telepon ?? '—' },
      ]
    : [
        {
          kunci: 'npwp', judul: 'NPWP', lebar: '190px',
          render: (m) => <span className="font-mono text-sm">{formatNpwp(m.npwp)}</span>,
        },
        { kunci: 'kota', judul: 'Kota', render: (m) => m.kota ?? '—' },
      ]

  return [
    ...identitas,
    ...rinci,
    {
      kunci: 'status', judul: 'Status', lebar: '100px',
      render: (m) => (
        <LencanaStatus status={m.isActive ? 'aktif' : 'nonaktif'} label={m.isActive ? 'Aktif' : 'Nonaktif'} />
      ),
    },
    {
      kunci: 'aksi', judul: '', lebar: '160px', rataKanan: true,
      render: (m) => (
        <>
          <DialogPartner partner={m} pemicu={<TombolUbah />} />
          <TombolStatusPartner id={m.id} isActive={m.isActive} />
        </>
      ),
    },
  ]
}

/**
 * Isi tabel dipisah ke komponennya sendiri supaya judul dan deskripsi halaman
 * — yang tidak memerlukan data apa pun — dapat digambar lebih dulu sementara
 * kuerinya masih berjalan. Tanpa pemisahan ini seluruh halaman menunggu kueri
 * selesai, dan teks pertama yang tergambar (deskripsi halaman) menjadi penanda
 * Largest Contentful Paint yang ikut tertunda.
 */
async function IsiDaftarKontak({ peran }: { peran?: PeranKontak }) {
  const mitra = await daftarPartner(peran ? { peran } : {})

  return (
    <TabelData
      kolom={susunKolom(peran)}
      baris={mitra}
      kunciBaris={(m) => m.id}
      pesanKosong={
        peran === 'pegawai'
          ? 'Belum ada pegawai yang terdaftar.'
          : 'Belum ada mitra usaha yang terdaftar.'
      }
    />
  )
}

function KerangkaTabel() {
  return (
    <div className="animate-pulse space-y-2 rounded-md border p-4" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-8 rounded bg-muted/50" />
      ))}
    </div>
  )
}

export async function DaftarKontak({
  judul, deskripsi, peran,
}: {
  judul: string
  deskripsi: string
  peran?: PeranKontak
}) {
  // Izin diperiksa sebelum apa pun digambar. Pemeriksaannya membaca sesi dari
  // JWT dan tidak menyentuh basis data, jadi tidak menahan tampilan.
  await wajibIzin('kontak.partner.lihat')

  return (
    <>
      <KepalaHalaman
        judul={judul}
        deskripsi={deskripsi}
        aksi={
          <DialogPartner
            peranAwal={peran}
            pemicu={<TombolBuat>Tambah Mitra</TombolBuat>}
          />
        }
      />
      <Suspense fallback={<KerangkaTabel />}>
        <IsiDaftarKontak peran={peran} />
      </Suspense>
    </>
  )
}
