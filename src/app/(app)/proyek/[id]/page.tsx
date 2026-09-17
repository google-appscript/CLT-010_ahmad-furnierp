import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { partners, salesOrders, users } from '@/db/schema'
import { ambilProyek } from '@/modules/proyek/layanan/proyek'
import { daftarTugas } from '@/modules/proyek/layanan/tugas'
import { daftarTimesheet } from '@/modules/proyek/layanan/timesheet'
import { profitabilitasProyek } from '@/modules/proyek/layanan/laporan'
import { kesiapanKunci } from '@/modules/proyek/layanan/penguncian'
import { perintahProduksiProyek } from '@/modules/manufaktur/layanan/perintah-produksi'
import { LABEL_STATUS_PERINTAH_PRODUKSI } from '@/modules/manufaktur/validasi/produksi'
import {
  LABEL_STATUS_PROYEK, LABEL_STATUS_TUGAS, LABEL_SATUAN_TARIF,
} from '@/modules/proyek/validasi/proyek'
import { formatAngka, formatRupiah } from '@/lib/uang'
import { TombolUbah } from '@/components/data/tombol-aksi'
import { LencanaStatus } from '@/components/data/lencana-status'
import { FormulirProyek } from '../formulir-proyek'
import { ambilDataPilihanProyek } from '../data-pilihan'
import { AksiProyek, DialogTugas, AksiTugas, AksiPenguncian } from './aksi-proyek'
import { MenuFormulir } from '@/components/formulir/menu-formulir'

export const metadata = { title: 'Detail Proyek' }

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

  const awal = {
    id: proyek.id,
    kode: proyek.kode,
    nama: proyek.nama,
    soId: proyek.soId,
    tanggalMulai: proyek.tanggalMulai,
    tanggalTarget: proyek.tanggalTarget ?? '',
    manajerId: proyek.manajerId ?? '',
    catatan: proyek.catatan ?? '',
  }

  if (proyek.status === 'draft') {
    return (
      <FormulirProyek
        awal={awal}
        pesanan={pesanan}
        pengguna={pengguna}
        aksiTambahan={<AksiProyek key="aksi-draft" id={proyek.id} status={proyek.status} />}
        menu={
          <MenuFormulir labelDokumen="Proyek" />
        }
      />
    )
  }

  // Dokumen non-draft dapat merujuk pelanggan/pengguna yang sejak itu
  // dinonaktifkan — `pilihan` hanya berisi yang masih aktif, jadi tampilan
  // readonly memakai daftar tanpa filter aktif supaya nama tetap terlihat.
  const [
    tugas, timesheet, laba, produksi, semuaPengguna, semuaMitra, semuaPesanan, kesiapan,
  ] = await Promise.all([
    daftarTugas({ proyekId: id }),
    daftarTimesheet({ proyekId: id }),
    profitabilitasProyek(id),
    perintahProduksiProyek(id),
    db.select({ id: users.id, nama: users.nama }).from(users).orderBy(asc(users.nama)),
    db.select({ id: partners.id, nama: partners.nama }).from(partners).orderBy(asc(partners.nama)),
    db.select({
      id: salesOrders.id, nomor: salesOrders.nomor, tanggal: salesOrders.tanggal,
      tanggalPengiriman: salesOrders.tanggalPengiriman, partnerId: salesOrders.partnerId,
    })
      .from(salesOrders).orderBy(asc(salesOrders.nomor)),
    kesiapanKunci(id),
  ])

  const mitraLewatId = new Map(semuaMitra.map((m) => [m.id, m.nama]))
  // Baris pesanan tidak ikut dibaca di sini: rincian pesanan hanya tampil saat
  // formulirnya dapat diubah, sedangkan layar ini selalu readonly.
  const pesananReadonly = semuaPesanan.map((p) => ({
    id: p.id, nomor: p.nomor ?? '—', tanggal: p.tanggal,
    namaPelanggan: mitraLewatId.get(p.partnerId) ?? '—',
    tanggalPengiriman: p.tanggalPengiriman,
    baris: [],
  }))

  const terbuka = proyek.status === 'berjalan'

  const tabProfitabilitas = (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b bg-muted/20">
              <td colSpan={2} className="px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Laba Kotor — angka buku besar
              </td>
            </tr>
            <BarisAngka label="Pendapatan (dasar pengenaan pajak)" nilai={laba.pendapatan} />
            <BarisAngka label="Harga Pokok Penjualan" nilai={laba.hargaPokok} />
            <tr className="border-t-2 bg-muted/40 font-semibold">
              <td className="px-4 py-2">Laba Kotor</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatRupiah(laba.labaKotor)}</td>
            </tr>
            <tr className="border-b">
              <td className="px-4 py-1.5 text-muted-foreground">Margin Kotor</td>
              <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">
                {laba.marginKotorPersen === null ? '—' : `${formatAngka(laba.marginKotorPersen, 2)}%`}
              </td>
            </tr>

            <tr className="border-b bg-muted/20">
              <td colSpan={2} className="px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Laba Bersih — pandangan manajerial
              </td>
            </tr>
            <BarisAngka label="Beban Bertanda Proyek" nilai={laba.bebanLain} />
            <BarisAngka
              label="Upah Belum Terserap Produksi"
              nilai={laba.biayaTenagaKerja}
            />
            <tr className="border-t-2 bg-muted/40 font-semibold">
              <td className="px-4 py-2">Laba Bersih</td>
              <td className={`px-4 py-2 text-right tabular-nums ${
                Number(laba.laba) < 0 ? 'text-destructive' : ''
              }`}>
                {formatRupiah(laba.laba)}
              </td>
            </tr>
            <tr className="border-t">
              <td className="px-4 py-2">Margin Bersih</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {laba.marginPersen === null ? '—' : `${formatAngka(laba.marginPersen, 2)}%`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Laba kotor murni angka buku besar dan dapat diadu dengan neraca; harga pokoknya
        sudah memuat bahan, upah, dan overhead yang terserap lewat perintah produksi
        {Number(laba.biayaTenagaKerjaTerserap) > 0 && (
          <> — termasuk {formatRupiah(laba.biayaTenagaKerjaTerserap)} upah tukang</>
        )}
        . Laba bersih menguranginya dengan beban bertanda proyek dan upah yang tidak
        melewati produksi, yang belum menjadi transaksi buku besar.
        {laba.terkunci
          ? ' Angka ini dibekukan saat proyek dikunci dan tidak lagi dihitung ulang.'
          : ` Difakturkan ${formatRupiah(kesiapan.totalDifakturkan)}, diterima ` +
            `${formatRupiah(kesiapan.totalDiterima)}, sisa piutang ` +
            `${formatRupiah(kesiapan.sisaPiutang)}.`}
      </p>
    </div>
  )

  const tabProduksi = produksi.length === 0 ? (
    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
      Belum ada perintah produksi untuk proyek ini.{' '}
      {terbuka && (
        <Link href="/manufaktur/perintah-produksi/baru" className="underline">
          Buat perintah produksi
        </Link>
      )}
    </div>
  ) : (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Nomor</th>
              <th className="px-4 py-2 text-left font-medium">Produk</th>
              <th className="px-4 py-2 text-right font-medium">Kuantitas</th>
              <th className="px-4 py-2 text-left font-medium">Target</th>
              <th className="px-4 py-2 text-right font-medium">Tenaga Kerja</th>
              <th className="px-4 py-2 text-right font-medium">Overhead</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {produksi.map((w) => (
              <tr key={w.id} className="border-b">
                <td className="px-4 py-1.5">
                  <Link
                    href={`/manufaktur/perintah-produksi/${w.id}`}
                    className="font-mono text-xs underline"
                  >
                    {w.nomor ?? 'Draft'}
                  </Link>
                </td>
                <td className="px-4 py-1.5">{w.namaProduk}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(w.kuantitas, 2)}
                </td>
                <td className="px-4 py-1.5 text-muted-foreground">{w.tanggalTarget ?? '—'}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(w.biayaTenagaKerja)}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(w.biayaOverhead)}
                </td>
                <td className="px-4 py-1.5">
                  <LencanaStatus
                    status={w.status}
                    label={LABEL_STATUS_PERINTAH_PRODUKSI[w.status]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Bahan baku proyek ini ada di resep masing-masing perintah produksi. Pengiriman
        pesanan ditahan selama masih ada perintah yang belum tuntas, karena barangnya
        belum berwujud dan harga pokoknya belum lengkap.
      </p>
    </div>
  )

  const tabTugas = (
    <div className="space-y-3">
      {terbuka && (
        <div className="flex justify-end">
          <DialogTugas proyekId={proyek.id} pengguna={semuaPengguna} />
        </div>
      )}
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
                    <LencanaStatus status={t.status} label={LABEL_STATUS_TUGAS[t.status]} />
                  </td>
                  {terbuka && (
                    <td className="px-4 py-1.5">
                      <div className="flex justify-end gap-1">
                        <DialogTugas
                          proyekId={proyek.id}
                          pengguna={semuaPengguna}
                          tugas={{
                            id: t.id, nama: t.nama, deskripsi: t.deskripsi,
                            penanggungJawabId: t.penanggungJawabId,
                            tanggalMulai: t.tanggalMulai, tenggat: t.tenggat,
                            estimasiJam: t.estimasiJam,
                          }}
                          pemicu={<TombolUbah />}
                        />
                        <AksiTugas
                          id={t.id} status={t.status}
                          dapatDihapus={Number(t.jamTercatat) === 0}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const tabTimesheet = timesheet.length === 0 ? (
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
            <th className="px-4 py-2 text-left font-medium">Pegawai</th>
            <th className="px-4 py-2 text-left font-medium">Produksi</th>
            <th className="px-4 py-2 text-left font-medium">Uraian</th>
            <th className="px-4 py-2 text-right font-medium">Jumlah</th>
            <th className="px-4 py-2 text-right font-medium">Tarif</th>
            <th className="px-4 py-2 text-right font-medium">Biaya</th>
          </tr>
        </thead>
        <tbody>
          {timesheet.map((t) => (
            <tr key={t.id} className="border-b">
              <td className="px-4 py-1.5">{t.tanggal}</td>
              <td className="px-4 py-1.5">{t.namaPegawai}</td>
              <td className="px-4 py-1.5 text-muted-foreground">
                {t.nomorPerintahProduksi ?? '—'}
              </td>
              <td className="px-4 py-1.5 text-muted-foreground">{t.deskripsi}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">
                {formatAngka(t.kuantitas, 2)}
                <span className="ml-1 text-xs text-muted-foreground">
                  {LABEL_SATUAN_TARIF[t.satuanTarif].toLowerCase()}
                </span>
              </td>
              <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(t.tarif)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{formatAngka(t.biaya)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 bg-muted/40 font-semibold">
          <tr>
            <td colSpan={4} className="px-4 py-2 text-right">Total</td>
            <td className="px-4 py-2 text-right tabular-nums">
              {Number(laba.totalHari) > 0 && <>{formatAngka(laba.totalHari, 2)} hari</>}
              {Number(laba.totalHari) > 0 && Number(laba.totalJam) > 0 && ' · '}
              {Number(laba.totalJam) > 0 && <>{formatAngka(laba.totalJam, 2)} jam</>}
            </td>
            <td />
            <td className="px-4 py-2 text-right tabular-nums">
              {formatAngka(
                String(Number(laba.biayaTenagaKerja) + Number(laba.biayaTenagaKerjaTerserap)),
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )

  return (
    <FormulirProyek
      awal={awal}
      pesanan={pesananReadonly}
      pengguna={semuaPengguna}
      readOnly
      nomor={`${proyek.kode} — ${proyek.nama}`}
      statusBadge={<LencanaStatus status={proyek.status} label={LABEL_STATUS_PROYEK[proyek.status]} />}
      aksiTambahan={terbuka ? <AksiProyek key="aksi-berjalan" id={proyek.id} status={proyek.status} /> : undefined}
      menu={
        <MenuFormulir labelDokumen="Proyek" />
      }
      bannerTambahan={
        (proyek.status === 'selesai' || proyek.status === 'terkunci') ? (
          <div className="rounded-md border p-4">
            <AksiPenguncian
              id={proyek.id}
              status={proyek.status}
              siap={kesiapan.siap}
              penghalang={kesiapan.penghalang}
              sisaPiutang={kesiapan.sisaPiutang}
            />
          </div>
        ) : undefined
      }
      tabTambahan={[
        { id: 'profitabilitas', label: 'Profitabilitas', children: tabProfitabilitas },
        { id: 'produksi', label: 'Produksi', children: tabProduksi },
        { id: 'tugas', label: 'Tugas', children: tabTugas },
        { id: 'timesheet', label: 'Timesheet', children: tabTimesheet },
      ]}
    />
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
