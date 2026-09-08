import { wajibIzin } from '@/lib/sesi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Dasbor' }

export default async function HalamanDasbor() {
  const sesi = await wajibIzin('dasbor.ringkasan.lihat')

  return (
    <>
      <KepalaHalaman judul="Dasbor" deskripsi={`Selamat datang kembali, ${sesi.nama}.`} />
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Keuangan</CardTitle>
          <CardDescription>
            Angka keuangan terisi setelah mesin jurnal aktif pada Fase 1B.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Mulailah dengan menyiapkan Bagan Akun dan Mitra Usaha melalui menu Akuntansi.
        </CardContent>
      </Card>
    </>
  )
}
