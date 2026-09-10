import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  projects, customerInvoices, stockOperations, journalItems, journalEntries, accounts,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, kurang, tambah, kali, bagi, type Uang } from '@/lib/uang'
import { totalFaktur } from '@/modules/penjualan/layanan/faktur'
import { rekapTimesheetProyek } from './timesheet'

const DESIMAL = 2

export type ProfitabilitasProyek = {
  proyekId: string
  kode: string
  nama: string
  status: string
  /** Angka berasal dari snapshot saat penguncian, bukan dihitung ulang. */
  terkunci: boolean
  /** Difakturkan ke pelanggan atas pesanan proyek ini, di luar PPN. */
  pendapatan: Uang
  /** Harga pokok barang yang dikirim atas pesanan itu. */
  hargaPokok: Uang
  labaKotor: Uang
  /** Beban lain yang ditandai ke proyek ini pada item jurnal. */
  bebanLain: Uang
  /** Jam kerja dikali tarif; angka manajerial, belum masuk buku besar. */
  biayaTenagaKerja: Uang
  totalJam: Uang
  laba: Uang
  /** Laba dibagi pendapatan, dalam persen; null bila belum ada pendapatan. */
  marginPersen: string | null
}

/**
 * Profitabilitas sebuah proyek.
 *
 * Pendapatan dan harga pokok diturunkan dari pesanan penjualan yang dipegang
 * proyek — itulah gunanya aturan satu proyek satu pesanan: tidak ada alokasi
 * yang perlu ditebak. Beban lain datang dari item jurnal yang ditandai ke
 * proyek ini, dan biaya tenaga kerja dari timesheet.
 *
 * Biaya tenaga kerja sengaja dipisah karena belum menyentuh buku besar; tanpa
 * modul penggajian, upahnya belum menjadi transaksi. Laba kotor tetap murni
 * angka akuntansi, dan laba proyek adalah pandangan manajerial di atasnya.
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
    return {
      proyekId: proyek.id,
      kode: proyek.kode,
      nama: proyek.nama,
      status: proyek.status,
      terkunci: true,
      pendapatan,
      hargaPokok,
      labaKotor: bulatkan(kurang(pendapatan, hargaPokok), DESIMAL),
      bebanLain: proyek.bebanLainFinal ?? '0.00',
      biayaTenagaKerja: proyek.biayaTenagaKerjaFinal ?? '0.00',
      totalJam: proyek.totalJamFinal ?? '0.00',
      laba: proyek.labaFinal,
      marginPersen: Number(pendapatan) === 0
        ? null
        : bulatkan(kali(bagi(proyek.labaFinal, pendapatan), 100), DESIMAL),
    }
  }

  // ── Pendapatan: faktur terposting atas pesanan proyek ini ──────────────────
  const faktur = await db.select().from(customerInvoices)
    .where(and(
      eq(customerInvoices.soId, proyek.soId),
      eq(customerInvoices.status, 'diposting'),
    ))

  let pendapatan = '0'
  for (const f of faktur) {
    // Dasar pengenaan pajak, bukan total tagihan: PPN Keluaran adalah titipan
    // untuk negara, bukan pendapatan proyek.
    const { totalDpp } = await totalFaktur(f.id)
    // Nota kredit membalik arah faktur, jadi mengurangi pendapatan.
    pendapatan = f.tipe === 'nota_kredit'
      ? kurang(pendapatan, totalDpp)
      : tambah(pendapatan, totalDpp)
  }

  // ── Harga pokok: nilai pengiriman atas pesanan itu ─────────────────────────
  const pengiriman = await db.select({ id: stockOperations.id }).from(stockOperations)
    .where(and(
      eq(stockOperations.sumberTipe, 'penjualan:pesanan'),
      eq(stockOperations.sumberId, proyek.soId),
      eq(stockOperations.status, 'selesai'),
    ))

  const idJurnalPengiriman = pengiriman.length > 0
    ? (await db.select({ jurnalEntryId: stockOperations.jurnalEntryId })
        .from(stockOperations)
        .where(inArray(stockOperations.id, pengiriman.map((p) => p.id))))
        .map((o) => o.jurnalEntryId).filter((x): x is string => !!x)
    : []

  const itemHpp = idJurnalPengiriman.length > 0
    ? await db
        .select({ debit: journalItems.debit, kredit: journalItems.kredit })
        .from(journalItems)
        .innerJoin(accounts, eq(accounts.id, journalItems.accountId))
        .where(and(
          inArray(journalItems.entryId, idJurnalPengiriman),
          eq(accounts.tipeAkun, 'beban_hpp'),
        ))
    : []

  const hargaPokok = bulatkan(
    tambah(...itemHpp.map((i) => kurang(i.debit, i.kredit))), DESIMAL,
  )

  // ── Beban lain: item jurnal yang ditandai ke proyek ini ────────────────────
  const itemProyek = await db
    .select({ debit: journalItems.debit, kredit: journalItems.kredit, tipe: accounts.tipeAkun })
    .from(journalItems)
    .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
    .innerJoin(accounts, eq(accounts.id, journalItems.accountId))
    .where(and(
      eq(journalItems.projectId, proyekId),
      eq(journalEntries.status, 'diposting'),
    ))

  const bebanLain = bulatkan(
    tambah(...itemProyek
      .filter((i) => i.tipe.startsWith('beban_'))
      .map((i) => kurang(i.debit, i.kredit))),
    DESIMAL,
  )

  const rekap = await rekapTimesheetProyek(proyekId)

  const pendapatanBulat = bulatkan(pendapatan, DESIMAL)
  const labaKotor = bulatkan(kurang(pendapatanBulat, hargaPokok), DESIMAL)
  const laba = bulatkan(
    kurang(kurang(labaKotor, bebanLain), rekap.totalBiaya), DESIMAL,
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
    bebanLain,
    biayaTenagaKerja: rekap.totalBiaya,
    totalJam: rekap.totalJam,
    laba,
    marginPersen: Number(pendapatanBulat) === 0
      ? null
      : bulatkan(kali(bagi(laba, pendapatanBulat), 100), DESIMAL),
  }
}

export async function profitabilitasSeluruhProyek(): Promise<ProfitabilitasProyek[]> {
  const daftar = await db.select({ id: projects.id }).from(projects)
  return Promise.all(daftar.map((p) => profitabilitasProyek(p.id)))
}
