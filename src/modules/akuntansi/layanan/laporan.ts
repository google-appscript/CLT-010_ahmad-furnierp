import { bulatkan, kurang, negasi, tambah, type Uang } from '@/lib/uang'
import * as repo from '../repositori/laporan'
import type { SaldoAkun, TipeAkun } from '../repositori/laporan'
import { ambilPengaturan } from './konfigurasi'

export type { SaldoAkun }
export {
  itemPerAkun, saldoPerPartner, umurPerPartner, rekapPajak,
} from '../repositori/laporan'
export type { BarisBukuBesar, SaldoPartner, BarisUmur, BarisPajak } from '../repositori/laporan'

const NOL = '0.00'
const DESIMAL = 2

export type BarisLaporan = {
  label: string
  nilai: Uang
  /** Baris ringkasan seperti Laba Kotor dicetak tebal dan bergaris. */
  tegas?: boolean
  akun?: SaldoAkun[]
}

// ── Pembantu agregasi ────────────────────────────────────────────────────────

function saring(saldo: SaldoAkun[], tipe: TipeAkun[]): SaldoAkun[] {
  return saldo.filter((s) => tipe.includes(s.tipeAkun))
}

/** Total bersaldo debit (aset, beban): debit − kredit. */
function totalDebit(saldo: SaldoAkun[], tipe: TipeAkun[]): Uang {
  return bulatkan(tambah(...saring(saldo, tipe).map((s) => s.saldo)), DESIMAL)
}

/** Total bersaldo kredit (liabilitas, ekuitas, pendapatan): kredit − debit. */
function totalKredit(saldo: SaldoAkun[], tipe: TipeAkun[]): Uang {
  return bulatkan(negasi(tambah(...saring(saldo, tipe).map((s) => s.saldo))), DESIMAL)
}

// ── Laba Rugi ────────────────────────────────────────────────────────────────

export type LabaRugi = {
  baris: BarisLaporan[]
  labaBersih: Uang
}

/**
 * Laba Rugi bertingkat sesuai praktik Indonesia. Akun pendapatan bersaldo
 * kredit dan akun beban bersaldo debit, sehingga tandanya dibalik agar
 * keduanya tampil positif pada laporan.
 */
export async function laporanLabaRugi(dariIso: string, sampaiIso: string): Promise<LabaRugi> {
  const saldo = await repo.mutasiPerAkun(dariIso, sampaiIso)

  const pendapatan = totalKredit(saldo, ['pendapatan'])
  const hpp = totalDebit(saldo, ['beban_hpp'])
  const labaKotor = kurang(pendapatan, hpp)

  const bebanOperasional = totalDebit(saldo, ['beban_operasional', 'beban_depresiasi'])
  const labaUsaha = kurang(labaKotor, bebanOperasional)

  const pendapatanLain = totalKredit(saldo, ['pendapatan_lain'])
  const bebanLain = totalDebit(saldo, ['beban_lain'])
  const labaSebelumPajak = kurang(tambah(labaUsaha, pendapatanLain), bebanLain)

  const bebanPajak = totalDebit(saldo, ['beban_pajak'])
  const labaBersih = bulatkan(kurang(labaSebelumPajak, bebanPajak), DESIMAL)

  return {
    labaBersih,
    baris: [
      { label: 'Pendapatan', nilai: pendapatan, akun: saring(saldo, ['pendapatan']) },
      { label: 'Harga Pokok Penjualan', nilai: hpp, akun: saring(saldo, ['beban_hpp']) },
      { label: 'Laba Kotor', nilai: bulatkan(labaKotor, DESIMAL), tegas: true },
      {
        label: 'Beban Operasional', nilai: bebanOperasional,
        akun: saring(saldo, ['beban_operasional', 'beban_depresiasi']),
      },
      { label: 'Laba Usaha', nilai: bulatkan(labaUsaha, DESIMAL), tegas: true },
      { label: 'Pendapatan Lain-lain', nilai: pendapatanLain, akun: saring(saldo, ['pendapatan_lain']) },
      { label: 'Beban Lain-lain', nilai: bebanLain, akun: saring(saldo, ['beban_lain']) },
      { label: 'Laba Sebelum Pajak', nilai: bulatkan(labaSebelumPajak, DESIMAL), tegas: true },
      { label: 'Beban Pajak Penghasilan', nilai: bebanPajak, akun: saring(saldo, ['beban_pajak']) },
      { label: 'Laba Bersih', nilai: labaBersih, tegas: true },
    ],
  }
}

// ── Neraca ───────────────────────────────────────────────────────────────────

export type Neraca = {
  aset: BarisLaporan[]
  liabilitas: BarisLaporan[]
  ekuitas: BarisLaporan[]
  totalAset: Uang
  totalLiabilitas: Uang
  totalEkuitas: Uang
  labaTahunBerjalan: Uang
  seimbang: boolean
  selisih: Uang
}

const ASET_LANCAR: TipeAkun[] = [
  'aset_kas', 'aset_bank', 'aset_piutang', 'aset_persediaan', 'aset_lancar_lain',
]
const ASET_TIDAK_LANCAR: TipeAkun[] = [
  'aset_tetap', 'aset_akumulasi_depresiasi', 'aset_tidak_lancar_lain',
]
const LIABILITAS_PENDEK: TipeAkun[] = [
  'liabilitas_utang_usaha', 'liabilitas_pajak', 'liabilitas_jangka_pendek',
]

/**
 * Neraca tidak bergantung pada tutup buku. Baris Laba Tahun Berjalan dihitung
 * dinamis dari selisih pendapatan dikurangi beban sejak awal tahun buku,
 * sehingga neraca selalu seimbang bahkan sebelum tutup buku dilakukan.
 */
export async function laporanNeraca(sampaiIso: string): Promise<Neraca> {
  const saldo = await repo.saldoPerAkun(sampaiIso)
  const pengaturan = await ambilPengaturan()

  const bulanAwal = pengaturan?.bulanAwalTahunBuku ?? 1
  const tahun = Number(sampaiIso.slice(0, 4))
  const awalTahunBuku = `${tahun}-${String(bulanAwal).padStart(2, '0')}-01`
  const { labaBersih } = await laporanLabaRugi(awalTahunBuku, sampaiIso)

  const asetLancar = totalDebit(saldo, ASET_LANCAR)
  const asetTidakLancar = totalDebit(saldo, ASET_TIDAK_LANCAR)
  const totalAset = bulatkan(tambah(asetLancar, asetTidakLancar), DESIMAL)

  const liabPendek = totalKredit(saldo, LIABILITAS_PENDEK)
  const liabPanjang = totalKredit(saldo, ['liabilitas_jangka_panjang'])
  const totalLiabilitas = bulatkan(tambah(liabPendek, liabPanjang), DESIMAL)

  const modal = totalKredit(saldo, ['ekuitas'])
  const labaDitahan = totalKredit(saldo, ['ekuitas_laba_ditahan'])
  const ekuitasBerjalan = totalKredit(saldo, ['ekuitas_laba_berjalan'])
  const totalEkuitas = bulatkan(
    tambah(modal, labaDitahan, ekuitasBerjalan, labaBersih), DESIMAL,
  )

  const selisih = bulatkan(
    kurang(totalAset, tambah(totalLiabilitas, totalEkuitas)), DESIMAL,
  )

  return {
    totalAset, totalLiabilitas, totalEkuitas,
    labaTahunBerjalan: labaBersih,
    seimbang: Number(selisih) === 0,
    selisih,
    aset: [
      { label: 'Aset Lancar', nilai: asetLancar, akun: saring(saldo, ASET_LANCAR) },
      { label: 'Aset Tidak Lancar', nilai: asetTidakLancar, akun: saring(saldo, ASET_TIDAK_LANCAR) },
      { label: 'Total Aset', nilai: totalAset, tegas: true },
    ],
    liabilitas: [
      { label: 'Liabilitas Jangka Pendek', nilai: liabPendek, akun: saring(saldo, LIABILITAS_PENDEK) },
      {
        label: 'Liabilitas Jangka Panjang', nilai: liabPanjang,
        akun: saring(saldo, ['liabilitas_jangka_panjang']),
      },
      { label: 'Total Liabilitas', nilai: totalLiabilitas, tegas: true },
    ],
    ekuitas: [
      { label: 'Modal', nilai: modal, akun: saring(saldo, ['ekuitas']) },
      { label: 'Laba Ditahan', nilai: labaDitahan, akun: saring(saldo, ['ekuitas_laba_ditahan']) },
      { label: 'Laba Tahun Berjalan', nilai: labaBersih },
      { label: 'Total Ekuitas', nilai: totalEkuitas, tegas: true },
    ],
  }
}

// ── Arus Kas (metode tidak langsung) ─────────────────────────────────────────

export type ArusKas = {
  operasi: BarisLaporan[]
  investasi: BarisLaporan[]
  pendanaan: BarisLaporan[]
  kasBersihOperasi: Uang
  kasBersihInvestasi: Uang
  kasBersihPendanaan: Uang
  kenaikanKas: Uang
  kasAwal: Uang
  kasAkhir: Uang
  /** Saldo kas dan bank sesungguhnya pada akhir periode. */
  kasAkhirAktual: Uang
  selisihTakTeridentifikasi: Uang
  cocok: boolean
}

const KAS_DAN_BANK: TipeAkun[] = ['aset_kas', 'aset_bank']

function hariSebelum(iso: string): string {
  const t = new Date(`${iso}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() - 1)
  return t.toISOString().slice(0, 10)
}

/**
 * Kontribusi sebuah akun neraca terhadap kas, dalam satu rumus seragam.
 *
 * Berlaku identitas berpasangan: jumlah seluruh mutasi (debit − kredit) atas
 * semua akun adalah nol. Karena itu, untuk setiap akun neraca non-kas —
 * baik aset, liabilitas, maupun ekuitas — kontribusinya terhadap kas selalu
 * `−(debit − kredit)`. Aset yang naik mengurangi kas, liabilitas yang naik
 * menambah kas, dan keduanya tercakup rumus yang sama.
 */
function kontribusiKas(saldo: SaldoAkun[], tipe: TipeAkun[]): Uang {
  return bulatkan(negasi(tambah(...saring(saldo, tipe).map((s) => s.saldo))), DESIMAL)
}

const MODAL_KERJA: TipeAkun[] = [
  'aset_piutang', 'aset_persediaan', 'aset_lancar_lain',
  'liabilitas_utang_usaha', 'liabilitas_pajak', 'liabilitas_jangka_pendek',
]
const INVESTASI: TipeAkun[] = [
  'aset_tetap', 'aset_akumulasi_depresiasi', 'aset_tidak_lancar_lain',
]
const PENDANAAN: TipeAkun[] = [
  'liabilitas_jangka_panjang', 'ekuitas', 'ekuitas_laba_ditahan', 'ekuitas_laba_berjalan',
]

/**
 * Arus kas metode tidak langsung.
 *
 * Rekonsiliasinya terjamin secara konstruksi: ketiga bagian bersama-sama
 * mencakup tepat seluruh akun neraca non-kas, dan laba bersih mencakup tepat
 * seluruh akun laba rugi. Depresiasi ditambahkan kembali di arus operasi
 * untuk penyajian, lalu dikurangkan lagi di arus investasi supaya akun
 * akumulasi depresiasi yang ikut terhitung di sana tidak menggandakannya.
 *
 * Hasil akhirnya tetap divalidasi silang terhadap saldo kas dan bank yang
 * sesungguhnya; bila meleset, selisihnya ditampilkan eksplisit alih-alih
 * disembunyikan.
 */
export async function laporanArusKas(dariIso: string, sampaiIso: string): Promise<ArusKas> {
  const { labaBersih } = await laporanLabaRugi(dariIso, sampaiIso)
  const mutasi = await repo.mutasiPerAkun(dariIso, sampaiIso)

  const depresiasi = totalDebit(mutasi, ['beban_depresiasi'])
  const dPiutang = kontribusiKas(mutasi, ['aset_piutang'])
  const dPersediaan = kontribusiKas(mutasi, ['aset_persediaan'])
  const dLancarLain = kontribusiKas(mutasi, ['aset_lancar_lain'])
  const dUtangUsaha = kontribusiKas(mutasi, ['liabilitas_utang_usaha'])
  const dUtangPajak = kontribusiKas(mutasi, ['liabilitas_pajak'])
  const dLiabPendek = kontribusiKas(mutasi, ['liabilitas_jangka_pendek'])

  const kasOperasi = bulatkan(tambah(
    labaBersih, depresiasi, kontribusiKas(mutasi, MODAL_KERJA),
  ), DESIMAL)

  const dAsetTetap = kontribusiKas(mutasi, ['aset_tetap', 'aset_akumulasi_depresiasi'])
  const dTidakLancarLain = kontribusiKas(mutasi, ['aset_tidak_lancar_lain'])
  const kasInvestasi = bulatkan(
    kurang(kontribusiKas(mutasi, INVESTASI), depresiasi), DESIMAL,
  )

  const dUtangPanjang = kontribusiKas(mutasi, ['liabilitas_jangka_panjang'])
  const dEkuitas = kontribusiKas(
    mutasi, ['ekuitas', 'ekuitas_laba_ditahan', 'ekuitas_laba_berjalan'],
  )
  const kasPendanaan = kontribusiKas(mutasi, PENDANAAN)

  const kenaikanKas = bulatkan(tambah(kasOperasi, kasInvestasi, kasPendanaan), DESIMAL)

  const saldoAwal = await repo.saldoPerAkun(hariSebelum(dariIso))
  const kasAwal = totalDebit(saldoAwal, KAS_DAN_BANK)
  const kasAkhir = bulatkan(tambah(kasAwal, kenaikanKas), DESIMAL)

  const saldoAkhir = await repo.saldoPerAkun(sampaiIso)
  const kasAkhirAktual = totalDebit(saldoAkhir, KAS_DAN_BANK)
  const selisih = bulatkan(kurang(kasAkhirAktual, kasAkhir), DESIMAL)

  return {
    kasBersihOperasi: kasOperasi,
    kasBersihInvestasi: kasInvestasi,
    kasBersihPendanaan: kasPendanaan,
    kenaikanKas, kasAwal, kasAkhir, kasAkhirAktual,
    selisihTakTeridentifikasi: selisih,
    cocok: Number(selisih) === 0,
    operasi: [
      { label: 'Laba Bersih', nilai: labaBersih },
      { label: 'Depresiasi dan Amortisasi', nilai: depresiasi },
      { label: 'Perubahan Piutang Usaha', nilai: dPiutang },
      { label: 'Perubahan Persediaan', nilai: dPersediaan },
      { label: 'Perubahan Aset Lancar Lainnya', nilai: dLancarLain },
      { label: 'Perubahan Utang Usaha', nilai: dUtangUsaha },
      { label: 'Perubahan Utang Pajak', nilai: dUtangPajak },
      { label: 'Perubahan Liabilitas Jangka Pendek Lainnya', nilai: dLiabPendek },
      { label: 'Kas Bersih dari Aktivitas Operasi', nilai: kasOperasi, tegas: true },
    ],
    investasi: [
      {
        label: 'Perubahan Aset Tetap',
        nilai: bulatkan(kurang(dAsetTetap, depresiasi), DESIMAL),
      },
      { label: 'Perubahan Aset Tidak Lancar Lainnya', nilai: dTidakLancarLain },
      { label: 'Kas Bersih dari Aktivitas Investasi', nilai: kasInvestasi, tegas: true },
    ],
    pendanaan: [
      { label: 'Perubahan Utang Jangka Panjang', nilai: dUtangPanjang },
      { label: 'Perubahan Ekuitas', nilai: dEkuitas },
      { label: 'Kas Bersih dari Aktivitas Pendanaan', nilai: kasPendanaan, tegas: true },
    ],
  }
}

// ── Neraca Saldo ─────────────────────────────────────────────────────────────

export type NeracaSaldo = {
  baris: (SaldoAkun & { saldoAwal: Uang; saldoAkhir: Uang })[]
  totalDebit: Uang
  totalKredit: Uang
  seimbang: boolean
}

export async function laporanNeracaSaldo(dariIso: string, sampaiIso: string): Promise<NeracaSaldo> {
  const [awal, mutasi, akhir] = await Promise.all([
    repo.saldoPerAkun(hariSebelum(dariIso)),
    repo.mutasiPerAkun(dariIso, sampaiIso),
    repo.saldoPerAkun(sampaiIso),
  ])

  const awalLewatAkun = new Map(awal.map((a) => [a.akunId, a.saldo]))
  const akhirLewatAkun = new Map(akhir.map((a) => [a.akunId, a.saldo]))

  const baris = mutasi
    .map((m) => ({
      ...m,
      saldoAwal: awalLewatAkun.get(m.akunId) ?? NOL,
      saldoAkhir: akhirLewatAkun.get(m.akunId) ?? NOL,
    }))
    .filter((b) =>
      Number(b.debit) !== 0 || Number(b.kredit) !== 0 ||
      Number(b.saldoAwal) !== 0 || Number(b.saldoAkhir) !== 0,
    )

  const td = bulatkan(tambah(...baris.map((b) => b.debit)), DESIMAL)
  const tk = bulatkan(tambah(...baris.map((b) => b.kredit)), DESIMAL)

  return { baris, totalDebit: td, totalKredit: tk, seimbang: Number(kurang(td, tk)) === 0 }
}
