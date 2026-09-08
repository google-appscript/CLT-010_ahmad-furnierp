import Link from 'next/link'
import { wajibIzin } from '@/lib/sesi'
import { daftarAkun } from '@/modules/akuntansi/layanan/akun'
import { daftarJurnal } from '@/modules/akuntansi/layanan/jurnal'
import { daftarPartner } from '@/modules/akuntansi/layanan/partner'
import { ambilPengaturan } from '@/modules/akuntansi/layanan/konfigurasi'
import { formatTanggalIndonesia } from '@/modules/akuntansi/layanan/penguncian'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Dasbor Akuntansi' }

function Ringkasan({ judul, nilai, rute }: { judul: string; nilai: number; rute: string }) {
  return (
    <Link href={rute}>
      <Card className="transition-colors hover:bg-accent/40">
        <CardHeader>
          <CardDescription>{judul}</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{nilai}</CardTitle>
        </CardHeader>
      </Card>
    </Link>
  )
}

export default async function HalamanDasborAkuntansi() {
  await wajibIzin('akuntansi.dasbor.lihat')
  const [akun, jurnal, mitra, pengaturan] = await Promise.all([
    daftarAkun(), daftarJurnal(), daftarPartner(), ambilPengaturan(),
  ])

  const kunci = pengaturan?.tanggalKunciBuku
    ? formatTanggalIndonesia(new Date(`${pengaturan.tanggalKunciBuku}T00:00:00Z`))
    : null

  return (
    <>
      <KepalaHalaman
        judul="Dasbor Akuntansi"
        deskripsi="Ringkasan konfigurasi akuntansi. Angka keuangan muncul setelah mesin jurnal aktif pada Fase 1B."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Ringkasan
          judul="Akun Aktif" nilai={akun.filter((a) => a.isActive).length}
          rute="/akuntansi/konfigurasi/bagan-akun"
        />
        <Ringkasan
          judul="Jurnal Aktif" nilai={jurnal.filter((j) => j.isActive).length}
          rute="/akuntansi/konfigurasi/jurnal"
        />
        <Ringkasan
          judul="Mitra Usaha" nilai={mitra.filter((m) => m.isActive).length}
          rute="/kontak"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Periode</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {kunci
            ? `Buku terkunci sampai ${kunci}. Transaksi pada tanggal tersebut atau sebelumnya tidak dapat diubah.`
            : 'Belum ada penguncian periode. Seluruh tanggal masih terbuka untuk pencatatan.'}
        </CardContent>
      </Card>
    </>
  )
}
