import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  projects, customerInvoices, customerInvoiceLines, stockOperations,
  journalItems, journalEntries, accounts,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, kurang, tambah, kali, bagi, type Uang } from '@/lib/uang'
import { hitungTotalDariBaris } from '@/modules/penjualan/layanan/pesanan'
import { rekapTimesheetProyek } from './timesheet'

const DESIMAL = 2

export type ProfitabilitasProyek = {
  proyekId: string
  kode: string
  nama: string
  status: string
  /** Angka berasal dari snapshot saat penguncian, bukan dihitung ulang. */
  terkunci: boolean

  // ── Bagian yang seluruhnya angka buku besar ────────────────────────────────
  /** Difakturkan ke pelanggan atas pesanan proyek ini, di luar PPN. */
  pendapatan: Uang
  /**
   * Harga pokok barang yang dikirim atas pesanan itu. Sudah memuat bahan,
   * upah tukang, dan overhead yang terserap lewat perintah produksi.
   */
  hargaPokok: Uang
  /** Pendapatan dikurangi harga pokok. Dapat diadu langsung dengan buku besar. */
  labaKotor: Uang
  marginKotorPersen: string | null

  // ── Bagian manajerial, di atas angka akuntansi ─────────────────────────────
  /** Beban selain harga pokok yang ditandai ke proyek ini pada item jurnal. */
  bebanLain: Uang
  /**
   * Upah yang tidak melewati perintah produksi — pemasangan di lokasi, survei.
   * Belum menjadi transaksi buku besar tanpa modul penggajian.
   */
  biayaTenagaKerja: Uang
  /**
   * Upah yang sudah terserap produksi. Ditampilkan sebagai keterangan saja:
   * nilainya sudah termasuk di dalam `hargaPokok` dan tidak boleh dikurangkan
   * lagi, sebab itu berarti menghitung upah yang sama dua kali.
   */
  biayaTenagaKerjaTerserap: Uang
  totalHari: Uang
  totalJam: Uang
  /** Laba kotor dikurangi beban lain dan upah yang belum terserap. */
  laba: Uang
  marginPersen: string | null
}

function persen(pembilang: Uang, penyebut: Uang): string | null {
  if (Number(penyebut) === 0) return null
  return bulatkan(kali(bagi(pembilang, penyebut), 100), DESIMAL)
}

/**
 * Profitabilitas sebuah proyek, disajikan dua tingkat.
 *
 * **Laba kotor** murni angka akuntansi: pendapatan dari faktur dikurangi harga
 * pokok dari jurnal pengiriman. Keduanya ada di buku besar, sehingga angka ini
 * dapat dipertanggungjawabkan kepada siapa pun yang membaca neraca.
 *
 * **Laba bersih** adalah pandangan manajerial di atasnya: laba kotor dikurangi
 * beban bertanda proyek dan upah yang belum terserap produksi.
 *
 * Upah tukang sengaja dipisah menurut penyerapannya. Upah yang tertaut sebuah
 * perintah produksi sudah masuk ke Barang Dalam Proses lalu menyatu ke harga
 * pokok barang jadi; menambahkannya lagi sebagai beban akan menghitungnya dua
 * kali dan membuat laba proyek tampak jauh lebih kecil dari yang sebenarnya.
 */
export async function profitabilitasProyek(proyekId: string): Promise<ProfitabilitasProyek> {
  const [proyek] = await db.select().from(projects).where(eq(projects.id, proyekId)).limit(1)
  if (!proyek) throw new ValidasiError('Proyek tidak ditemukan')

  // Proyek terkunci melaporkan angka yang dibekukan saat dikunci. Menghitung
  // ulang akan membuat laba proyek yang sudah tuntas bergeser setiap harga
  // pokok rata-rata berubah oleh pembelian berikutnya.
  if (proyek.status === 'terkunci' && proyek.labaFinal !== null) {
    const pendapatan = proyek.pendapatanFinal ?? '0.00'
    const hargaPokok = proyek.hargaPokokFinal ?? '0.00'
    const labaKotor = proyek.labaKotorFinal ?? bulatkan(kurang(pendapatan, hargaPokok), DESIMAL)
    return {
      proyekId: proyek.id,
      kode: proyek.kode,
      nama: proyek.nama,
      status: proyek.status,
      terkunci: true,
      pendapatan,
      hargaPokok,
      labaKotor,
      marginKotorPersen: persen(labaKotor, pendapatan),
      bebanLain: proyek.bebanLainFinal ?? '0.00',
      biayaTenagaKerja: proyek.biayaTenagaKerjaFinal ?? '0.00',
      // Sudah termasuk di harga pokok yang dibekukan; tidak disimpan terpisah.
      biayaTenagaKerjaTerserap: '0.00',
      totalHari: proyek.totalHariFinal ?? '0.00',
      totalJam: proyek.totalJamFinal ?? '0.00',
      laba: proyek.labaFinal,
      marginPersen: persen(proyek.labaFinal, pendapatan),
    }
  }

  // ── Pendapatan: faktur terposting atas pesanan proyek ini ──────────────────
  //
  // Seluruh barisnya diambil sekali lalu dikelompokkan, bukan satu kueri per
  // faktur. Laporan yang memuat banyak proyek sekaligus akan menjalankan
  // fungsi ini berulang kali, dan kueri per faktur membuat jumlah perjalanan
  // ke basis data tumbuh sebanding dengan jumlah dokumen.
  const faktur = await db
    .select({ id: customerInvoices.id, tipe: customerInvoices.tipe })
    .from(customerInvoices)
    .where(and(
      eq(customerInvoices.soId, proyek.soId),
      eq(customerInvoices.status, 'diposting'),
    ))

  let pendapatan = '0'
  if (faktur.length > 0) {
    const baris = await db
      .select({
        invoiceId: customerInvoiceLines.invoiceId,
        kuantitas: customerInvoiceLines.kuantitas,
        hargaSatuan: customerInvoiceLines.hargaSatuan,
        taxId: customerInvoiceLines.taxId,
      })
      .from(customerInvoiceLines)
      .where(inArray(customerInvoiceLines.invoiceId, faktur.map((f) => f.id)))

    const barisLewatFaktur = new Map<string, typeof baris>()
    for (const b of baris) {
      barisLewatFaktur.set(b.invoiceId, [...(barisLewatFaktur.get(b.invoiceId) ?? []), b])
    }

    for (const f of faktur) {
      // Dasar pengenaan pajak, bukan total tagihan: PPN Keluaran adalah titipan
      // untuk negara, bukan pendapatan proyek.
      const { totalDpp } = await hitungTotalDariBaris(barisLewatFaktur.get(f.id) ?? [])
      // Nota kredit membalik arah faktur, jadi mengurangi pendapatan.
      pendapatan = f.tipe === 'nota_kredit'
        ? kurang(pendapatan, totalDpp)
        : tambah(pendapatan, totalDpp)
    }
  }

  // ── Harga pokok dan beban lain, dari item jurnal ───────────────────────────
  //
  // Harga pokok dikenali dua arah supaya dokumen lama yang diposting sebelum
  // penandaan proyek otomatis berlaku tetap terbaca: lewat jurnal pengiriman
  // atas pesanan ini, atau lewat penanda proyek pada itemnya. Item yang cocok
  // keduanya tetap satu baris karena dikumpulkan berdasarkan id itemnya.
  const idJurnalPengiriman = (
    await db.select({ jurnalEntryId: stockOperations.jurnalEntryId })
      .from(stockOperations)
      .where(and(
        eq(stockOperations.sumberTipe, 'penjualan:pesanan'),
        eq(stockOperations.sumberId, proyek.soId),
        eq(stockOperations.status, 'selesai'),
      ))
  ).map((o) => o.jurnalEntryId).filter((x): x is string => !!x)

  const penandaHargaPokok = [
    eq(journalItems.projectId, proyekId),
    ...(idJurnalPengiriman.length > 0
      ? [inArray(journalItems.entryId, idJurnalPengiriman)]
      : []),
  ]

  const itemHargaPokok = await db
    .select({
      id: journalItems.id,
      debit: journalItems.debit,
      kredit: journalItems.kredit,
    })
    .from(journalItems)
    .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
    .innerJoin(accounts, eq(accounts.id, journalItems.accountId))
    .where(and(
      eq(journalEntries.status, 'diposting'),
      eq(accounts.tipeAkun, 'beban_hpp'),
      or(...penandaHargaPokok),
    ))

  const hargaPokok = bulatkan(
    tambah(...itemHargaPokok.map((i) => kurang(i.debit, i.kredit))), DESIMAL,
  )

  // Beban lain sengaja mengecualikan harga pokok. Tanpa pengecualian ini,
  // jurnal pengiriman yang bertanda proyek akan terhitung dua kali: sekali
  // sebagai harga pokok, sekali lagi sebagai beban.
  const itemBebanLain = await db
    .select({ debit: journalItems.debit, kredit: journalItems.kredit })
    .from(journalItems)
    .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
    .innerJoin(accounts, eq(accounts.id, journalItems.accountId))
    .where(and(
      eq(journalItems.projectId, proyekId),
      eq(journalEntries.status, 'diposting'),
      sql`${accounts.tipeAkun}::text LIKE 'beban_%'`,
      sql`${accounts.tipeAkun} <> 'beban_hpp'`,
    ))

  const bebanLain = bulatkan(
    tambah(...itemBebanLain.map((i) => kurang(i.debit, i.kredit))), DESIMAL,
  )

  const rekap = await rekapTimesheetProyek(proyekId)

  const pendapatanBulat = bulatkan(pendapatan, DESIMAL)
  const labaKotor = bulatkan(kurang(pendapatanBulat, hargaPokok), DESIMAL)
  const laba = bulatkan(
    kurang(kurang(labaKotor, bebanLain), rekap.biayaBelumTerserap), DESIMAL,
  )

  return {
    proyekId: proyek.id,
    kode: proyek.kode,
    nama: proyek.nama,
    status: proyek.status,
    terkunci: false,
    pendapatan: pendapatanBulat,
    hargaPokok,
    labaKotor,
    marginKotorPersen: persen(labaKotor, pendapatanBulat),
    bebanLain,
    biayaTenagaKerja: rekap.biayaBelumTerserap,
    biayaTenagaKerjaTerserap: rekap.biayaTerserap,
    totalHari: rekap.totalHari,
    totalJam: rekap.totalJam,
    laba,
    marginPersen: persen(laba, pendapatanBulat),
  }
}

export async function profitabilitasSeluruhProyek(): Promise<ProfitabilitasProyek[]> {
  const daftar = await db.select({ id: projects.id }).from(projects)
  return Promise.all(daftar.map((p) => profitabilitasProyek(p.id)))
}
