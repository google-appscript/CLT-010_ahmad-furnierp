import { wajibIzin } from '@/lib/sesi'
import { ambilPengaturan } from '@/modules/akuntansi/layanan/konfigurasi'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirPerusahaan } from './formulir-perusahaan'

export const metadata = { title: 'Profil Perusahaan' }

export default async function HalamanPerusahaan() {
  await wajibIzin('pengaturan.perusahaan.kelola')
  const pengaturan = await ambilPengaturan()

  if (!pengaturan) {
    return (
      <>
        <KepalaHalaman judul="Profil Perusahaan" />
        <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Pengaturan perusahaan belum dibuat. Jalankan <code>pnpm db:seed</code> terlebih dahulu.
        </p>
      </>
    )
  }

  return (
    <>
      <KepalaHalaman
        judul="Profil Perusahaan"
        deskripsi="Identitas perusahaan yang tampil pada dokumen dan laporan."
      />
      <FormulirPerusahaan
        awal={{
          nama: pengaturan.nama,
          npwp: pengaturan.npwp ?? '',
          alamat: pengaturan.alamat ?? '',
          kota: pengaturan.kota ?? '',
          provinsi: pengaturan.provinsi ?? '',
          kodePos: pengaturan.kodePos ?? '',
          telepon: pengaturan.telepon ?? '',
          email: pengaturan.email ?? '',
        }}
      />
    </>
  )
}
