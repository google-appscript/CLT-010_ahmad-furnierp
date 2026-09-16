import Link from 'next/link'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { projects } from '@/db/schema'
import { daftarTimesheet } from '@/modules/proyek/layanan/timesheet'
import { LABEL_SATUAN_TARIF } from '@/modules/proyek/validasi/proyek'
import { formatAngka, bulatkan, tambah } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PenyaringPeriode } from '@/components/laporan/penyaring-periode'
import { periodeBawaan, tanggalPanjang } from '@/app/(app)/akuntansi/laporan/periode'
import { ambilProyekTerbuka } from '../data-pilihan'
import { FormulirTimesheet } from './formulir-timesheet'
import { TombolHapusTimesheet } from './tombol-hapus'
import { DialogUbahTimesheet } from './dialog-ubah-timesheet'

export const metadata = { title: 'Timesheet' }

export default async function HalamanTimesheet({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await wajibIzin('proyek.timesheet.kelola')
  const { dari, sampai } = periodeBawaan(await searchParams)

  const [{ proyek, tugas, perintahProduksi, pegawai }, baris, statusProyek] = await Promise.all([
    ambilProyekTerbuka(),
    daftarTimesheet({ dari, sampai }),
    db.select({ id: projects.id, status: projects.status }).from(projects),
  ])

  const proyekTertutup = new Set(
    statusProyek
      .filter((p) => p.status === 'selesai' || p.status === 'dibatalkan' || p.status === 'terkunci')
      .map((p) => p.id),
  )

  const jumlah = (pilih: (b: typeof baris[number]) => string) =>
    baris.length > 0 ? bulatkan(tambah(...baris.map(pilih)), 2) : '0.00'

  // Hari dan jam tidak dijumlahkan menjadi satu angka: keduanya satuan yang
  // berbeda, dan mencampurnya akan melaporkan total yang tidak punya arti.
  const totalHari = bulatkan(
    tambah(...baris.filter((b) => b.satuanTarif === 'harian').map((b) => b.kuantitas), '0'), 2,
  )
  const totalJam = bulatkan(
    tambah(...baris.filter((b) => b.satuanTarif === 'jam').map((b) => b.kuantitas), '0'), 2,
  )
  const totalBiaya = jumlah((b) => b.biaya)
  const totalTerserap = baris.length > 0
    ? bulatkan(tambah(...baris.filter((b) => b.woId).map((b) => b.biaya), '0'), 2)
    : '0.00'

  return (
    <>
      <KepalaHalaman
        judul="Timesheet"
        deskripsi="Pekerjaan yang tercatat pada proyek. Baris yang tertaut perintah produksi diserap ke harga pokok; sisanya hanya muncul di laba bersih proyek."
      />

      <FormulirTimesheet
        proyek={proyek}
        tugas={tugas}
        perintahProduksi={perintahProduksi}
        pegawai={pegawai}
      />

      <PenyaringPeriode dari={dari} sampai={sampai} />

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Periode {tanggalPanjang(dari)} sampai {tanggalPanjang(sampai)}
        {Number(totalTerserap) > 0 && (
          <> · diserap produksi {formatAngka(totalTerserap)}</>
        )}
      </h2>

      {baris.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Belum ada pekerjaan tercatat pada periode ini.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left font-medium">Proyek</th>
                <th className="px-4 py-2 text-left font-medium">Pegawai</th>
                <th className="px-4 py-2 text-left font-medium">Produksi</th>
                <th className="px-4 py-2 text-left font-medium">Uraian</th>
                <th className="px-4 py-2 text-right font-medium">Jumlah</th>
                <th className="px-4 py-2 text-right font-medium">Tarif</th>
                <th className="px-4 py-2 text-right font-medium">Biaya</th>
                <th className="w-32 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.id} className="border-b">
                  <td className="px-4 py-1.5">{b.tanggal}</td>
                  <td className="px-4 py-1.5">
                    <Link href={`/proyek/${b.proyekId}`} className="font-mono text-xs underline">
                      {b.kodeProyek}
                    </Link>
                    <span className="ml-2 text-muted-foreground">{b.namaTugas ?? b.namaProyek}</span>
                  </td>
                  <td className="px-4 py-1.5">{b.namaPegawai}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {b.nomorPerintahProduksi ?? '—'}
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">{b.deskripsi}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatAngka(b.kuantitas, 2)}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {LABEL_SATUAN_TARIF[b.satuanTarif].toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.tarif)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(b.biaya)}</td>
                  <td className="px-4 py-1.5 text-right">
                    {!proyekTertutup.has(b.proyekId) && (
                      <>
                        <DialogUbahTimesheet
                          baris={{
                            id: b.id, proyekId: b.proyekId, tugasId: b.tugasId,
                            woId: b.woId, pegawaiId: b.pegawaiId, tanggal: b.tanggal,
                            kuantitas: b.kuantitas, satuanTarif: b.satuanTarif,
                            deskripsi: b.deskripsi,
                          }}
                          tugas={tugas}
                          perintahProduksi={perintahProduksi}
                          pegawai={pegawai}
                        />
                        <TombolHapusTimesheet id={b.id} />
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 bg-muted/40 font-semibold">
              <tr>
                <td colSpan={5} className="px-4 py-2 text-right">Total</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {Number(totalHari) > 0 && <>{formatAngka(totalHari, 2)} hari</>}
                  {Number(totalHari) > 0 && Number(totalJam) > 0 && ' · '}
                  {Number(totalJam) > 0 && <>{formatAngka(totalJam, 2)} jam</>}
                </td>
                <td />
                <td className="px-4 py-2 text-right tabular-nums">{formatAngka(totalBiaya)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
