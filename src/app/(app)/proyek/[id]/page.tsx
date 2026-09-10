import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { partners, salesOrders, users } from '@/db/schema'
import { ambilProyek } from '@/modules/proyek/layanan/proyek'
import { daftarTugas } from '@/modules/proyek/layanan/tugas'
import { daftarTimesheet } from '@/modules/proyek/layanan/timesheet'
import { profitabilitasProyek } from '@/modules/proyek/layanan/laporan'
import { kesiapanKunci } from '@/modules/proyek/layanan/penguncian'
import {
  LABEL_STATUS_PROYEK, LABEL_STATUS_TUGAS,
} from '@/modules/proyek/validasi/proyek'
import { formatAngka, formatRupiah } from '@/lib/uang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirProyek } from '../formulir-proyek'
import { ambilDataPilihanProyek } from '../data-pilihan'
import { AksiProyek, DialogTugas, AksiTugas, AksiPenguncian } from './aksi-proyek'

export const metadata = { title: 'Detail Proyek' }

const VARIAN: Record<string, 'default' | 'secondary' | 'outline'> = {
  berjalan: 'default', selesai: 'default', terkunci: 'default',
  draft: 'secondary', dibatalkan: 'outline', belum_mulai: 'secondary',
}

export default async function HalamanDetailProyek({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await wajibIzin('proyek.proyek.kelola')
  const { id } = await params
  const proyek = await ambilProyek(id)
  if (!proyek) notFound()

  const { pesanan, pengguna } = await ambilDataPilihanProyek(proyek.soId)

  if (proyek.status === 'draft') {
    return (
      <>
        <KepalaHalaman
          judul={`${proyek.kode} — ${proyek.nama}`}
          deskripsi="Proyek masih draft; tugas dan timesheet baru dapat dicatat setelah dimulai."
        />
        <div className="mb-6"><AksiProyek id={proyek.id} status={proyek.status} /></div>
        <FormulirProyek
          awal={{
            id: proyek.id,
            kode: proyek.kode,
            nama: proyek.nama,
            soId: proyek.soId,
            tanggalMulai: proyek.tanggalMulai,
            tanggalTarget: proyek.tanggalTarget ?? '',
            manajerId: proyek.manajerId ?? '',
            tarifPerJam: String(Number(proyek.tarifPerJam)),
            catatan: proyek.catatan ?? '',
          }}
          pesanan={pesanan}
          pengguna={pengguna}
        />
      </>
    )
  }

  const [tugas, timesheet, laba, semuaPengguna, kesiapan] = await Promise.all([
    daftarTugas({ proyekId: id }),
    daftarTimesheet({ proyekId: id }),
    profitabilitasProyek(id),
    db.select({ id: users.id, nama: users.nama }).from(users).orderBy(asc(users.nama)),
    kesiapanKunci(id),
  ])

  const [pelanggan] = await db.select({ nama: partners.nama }).from(partners)
    .where(eq(partners.id, proyek.partnerId)).limit(1)
  const [pesananProyek] = await db.select({ nomor: salesOrders.nomor }).from(salesOrders)
    .where(eq(salesOrders.id, proyek.soId)).limit(1)
  const namaManajer = proyek.manajerId
    ? semuaPengguna.find((u) => u.id === proyek.manajerId)?.nama ?? '—'
    : '—'

  const terbuka = proyek.status === 'berjalan'

  return (
    <>
      <KepalaHalaman
        judul={`${proyek.kode} — ${proyek.nama}`}
        deskripsi={proyek.catatan ?? undefined}
      />

      {terbuka && (
        <div className="mb-6"><AksiProyek id={proyek.id} status={proyek.status} /></div>
      )}

      {(proyek.status === 'selesai' || proyek.status === 'terkunci') && (
        <div className="mb-6 rounded-md border p-4">
          <AksiPenguncian
            id={proyek.id}
            status={proyek.status}
            siap={kesiapan.siap}
            penghalang={kesiapan.penghalang}
            sisaPiutang={kesiapan.sisaPiutang}
          />
        </div>
      )}

      <dl className="mb-6 grid gap-4 rounded-md border p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Bidang label="Status">
          <Badge variant={VARIAN[proyek.status]}>{LABEL_STATUS_PROYEK[proyek.status]}</Badge>
        </Bidang>
        <Bidang label="Pesanan">
          <Link href={`/penjualan/pesanan/${proyek.soId}`} className="underline">
            {pesananProyek?.nomor ?? '—'}
          </Link>
        </Bidang>
        <Bidang label="Pelanggan">{pelanggan?.nama ?? '—'}</Bidang>
        <Bidang label="Manajer">{namaManajer}</Bidang>
        <Bidang label="Mulai">{proyek.tanggalMulai}</Bidang>
        <Bidang label="Target Selesai">{proyek.tanggalTarget ?? '—'}</Bidang>
        <Bidang label="Selesai">{proyek.tanggalSelesai ?? '—'}</Bidang>
        <Bidang label="Tarif per Jam">{formatRupiah(proyek.tarifPerJam)}</Bidang>
      </dl>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Profitabilitas</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <tbody>
              <BarisAngka label="Pendapatan (dasar pengenaan pajak)" nilai={laba.pendapatan} />
              <BarisAngka label="Harga Pokok Penjualan" nilai={laba.hargaPokok} />
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <td className="px-4 py-2">Laba Kotor</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatRupiah(laba.labaKotor)}
                </td>
              </tr>
              <BarisAngka label="Beban Bertanda Proyek" nilai={laba.bebanLain} />
              <BarisAngka
                label={`Biaya Tenaga Kerja (${formatAngka(laba.totalJam, 2)} jam)`}
                nilai={laba.biayaTenagaKerja}
              />
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <td className="px-4 py-2">Laba Proyek</td>
                <td className={`px-4 py-2 text-right tabular-nums ${
                  Number(laba.laba) < 0 ? 'text-destructive' : ''
                }`}>
                  {formatRupiah(laba.laba)}
                </td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2">Margin</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {laba.marginPersen === null ? '—' : `${formatAngka(laba.marginPersen, 2)}%`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Laba kotor murni angka buku besar. Biaya tenaga kerja berasal dari timesheet dan belum
          diposting ke buku besar, jadi laba proyek adalah pandangan manajerial di atasnya.
          {laba.terkunci
            ? ' Angka ini dibekukan saat proyek dikunci dan tidak lagi dihitung ulang.'
            : ` Difakturkan ${formatRupiah(kesiapan.totalDifakturkan)}, diterima ` +
              `${formatRupiah(kesiapan.totalDiterima)}, sisa piutang ` +
              `${formatRupiah(kesiapan.sisaPiutang)}.`}
        </p>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Tugas</h2>
          {terbuka && <DialogTugas proyekId={proyek.id} pengguna={semuaPengguna} />}
        </div>

        {tugas.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Belum ada tugas.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-right font-medium">No</th>
                  <th className="px-4 py-2 text-left font-medium">Tugas</th>
                  <th className="px-4 py-2 text-left font-medium">Penanggung Jawab</th>
                  <th className="px-4 py-2 text-left font-medium">Tenggat</th>
                  <th className="px-4 py-2 text-right font-medium">Estimasi</th>
                  <th className="px-4 py-2 text-right font-medium">Tercatat</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  {terbuka && <th className="w-56 px-4 py-2" />}
                </tr>
              </thead>
              <tbody>
                {tugas.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="px-4 py-1.5 text-right tabular-nums">{t.urutan}</td>
                    <td className="px-4 py-1.5">{t.nama}</td>
                    <td className="px-4 py-1.5 text-muted-foreground">
                      {t.namaPenanggungJawab ?? '—'}
                    </td>
                    <td className="px-4 py-1.5 text-muted-foreground">{t.tenggat ?? '—'}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(t.estimasiJam, 2)}
                    </td>
                    <td className={`px-4 py-1.5 text-right tabular-nums ${
                      Number(t.jamTercatat) > Number(t.estimasiJam) ? 'font-medium' : ''
                    }`}>
                      {formatAngka(t.jamTercatat, 2)}
                    </td>
                    <td className="px-4 py-1.5">
                      <Badge variant={VARIAN[t.status] ?? 'outline'}>
                        {LABEL_STATUS_TUGAS[t.status]}
                      </Badge>
                    </td>
                    {terbuka && (
                      <td className="px-4 py-1.5">
                        <AksiTugas
                          id={t.id} status={t.status}
                          dapatDihapus={Number(t.jamTercatat) === 0}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Timesheet</h2>
        {timesheet.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Belum ada jam kerja tercatat.{' '}
            {terbuka && <Link href="/proyek/timesheet" className="underline">Catat sekarang</Link>}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                  <th className="px-4 py-2 text-left font-medium">Pelaksana</th>
                  <th className="px-4 py-2 text-left font-medium">Tugas</th>
                  <th className="px-4 py-2 text-left font-medium">Uraian</th>
                  <th className="px-4 py-2 text-right font-medium">Jam</th>
                  <th className="px-4 py-2 text-right font-medium">Tarif</th>
                  <th className="px-4 py-2 text-right font-medium">Biaya</th>
                </tr>
              </thead>
              <tbody>
                {timesheet.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="px-4 py-1.5">{t.tanggal}</td>
                    <td className="px-4 py-1.5">{t.namaPengguna}</td>
                    <td className="px-4 py-1.5 text-muted-foreground">{t.namaTugas ?? '—'}</td>
                    <td className="px-4 py-1.5 text-muted-foreground">{t.deskripsi}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(t.jam, 2)}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(t.tarifPerJam)}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {formatAngka(t.biaya)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/40 font-semibold">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-right">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatAngka(laba.totalJam, 2)}
                  </td>
                  <td />
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatAngka(laba.biayaTenagaKerja)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/proyek">Kembali ke Daftar</Link>
        </Button>
      </div>
    </>
  )
}

function Bidang({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  )
}

function BarisAngka({ label, nilai }: { label: string; nilai: string }) {
  return (
    <tr className="border-b">
      <td className="px-4 py-1.5">{label}</td>
      <td className="px-4 py-1.5 text-right tabular-nums">{formatRupiah(nilai)}</td>
    </tr>
  )
}
