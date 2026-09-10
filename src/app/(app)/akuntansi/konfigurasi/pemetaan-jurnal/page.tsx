import { asc, eq } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { accounts, journals, companySettings } from '@/db/schema'
import { daftarPemetaanJurnal, AKUN_OTOMATIS } from '@/modules/akuntansi/layanan/pemetaan'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { PemilihJurnal, FormulirAkunOtomatis, type BarisAkun } from './panel-pemetaan'

export const metadata = { title: 'Pemetaan Jurnal' }

/** Penjelasan tiap akun otomatis dalam bahasa yang dikenal pengguna. */
const KETERANGAN_AKUN: Record<string, string> = {
  akunPenerimaanBelumDitagihId:
    'Dikredit saat barang diterima, didebit kembali saat tagihan pemasok terbit',
  akunBarangDalamProsesId:
    'Menampung bahan dan biaya konversi selama produksi berjalan',
  akunTenagaKerjaLangsungId:
    'Dikredit saat biaya tenaga kerja diserap ke harga pokok produksi',
  akunOverheadPabrikId:
    'Dikredit saat overhead pabrik diserap ke harga pokok produksi',
  akunLabaPelepasanAsetId:
    'Dikredit bila aset dilepas di atas nilai bukunya',
  akunRugiPelepasanAsetId:
    'Didebit bila aset dilepas di bawah nilai bukunya',
  akunPembulatanId:
    'Menyerap selisih sen akibat pembulatan harga pokok satuan',
  akunLabaDitahanId:
    'Akumulasi laba periode-periode sebelumnya',
}

export default async function HalamanPemetaanJurnal() {
  await wajibIzin('akuntansi.pemetaan-jurnal.kelola')

  const [pemetaan, daftarJurnal, daftarAkun, pengaturan] = await Promise.all([
    daftarPemetaanJurnal(),
    db.select({ id: journals.id, kode: journals.kode, nama: journals.nama })
      .from(journals).where(eq(journals.isActive, true)).orderBy(asc(journals.kode)),
    db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama })
      .from(accounts).where(eq(accounts.isActive, true)).orderBy(asc(accounts.kode)),
    db.select().from(companySettings).limit(1).then((r) => r[0]),
  ])

  const barisAkun: BarisAkun[] = Object.entries(AKUN_OTOMATIS).map(([bidang, label]) => ({
    bidang,
    label,
    keterangan: KETERANGAN_AKUN[bidang] ?? '',
    akunId: (pengaturan?.[bidang as keyof typeof pengaturan] as string | null) ?? null,
  }))

  const belumLengkap = barisAkun.filter((b) => b.akunId === null).length

  return (
    <>
      <KepalaHalaman
        judul="Pemetaan Jurnal"
        deskripsi="Menentukan jurnal tujuan dan akun yang dipakai setiap posting otomatis. Mengubahnya di sini berlaku untuk transaksi berikutnya; jurnal yang sudah terbit tidak tersentuh."
      />

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-medium">Jurnal Tujuan</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Setiap jenis transaksi diposting ke jurnal yang dipilih di sini.
        </p>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Jenis Posting</th>
                <th className="px-4 py-2 text-left font-medium">Cakupan</th>
                <th className="w-72 px-4 py-2 text-left font-medium">Jurnal Tujuan</th>
              </tr>
            </thead>
            <tbody>
              {pemetaan.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className="px-4 py-1.5">
                    <span className="font-medium">{m.nama}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{m.kode}</span>
                    {!m.jurnalAktif && (
                      <Badge variant="outline" className="ml-2">Jurnal nonaktif</Badge>
                    )}
                  </td>
                  <td className="px-4 py-1.5 text-muted-foreground">{m.deskripsi ?? '—'}</td>
                  <td className="px-4 py-1.5">
                    <PemilihJurnal
                      baris={{
                        id: m.id, kode: m.kode, nama: m.nama,
                        deskripsi: m.deskripsi, journalId: m.journalId,
                      }}
                      jurnal={daftarJurnal}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium">Akun Otomatis</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Akun yang dipakai posting tertentu tetapi tidak melekat pada kategori produk maupun
          kategori aset. Akun persediaan, harga pokok, dan depresiasi diatur lewat kategorinya
          masing-masing.
          {belumLengkap > 0 && (
            <span className="ml-1 font-medium text-destructive">
              {belumLengkap} akun belum diatur — posting yang memerlukannya akan ditolak.
            </span>
          )}
        </p>

        <FormulirAkunOtomatis baris={barisAkun} akun={daftarAkun} />
      </section>
    </>
  )
}
