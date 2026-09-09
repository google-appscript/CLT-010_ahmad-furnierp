import { bulatkan, kali, kurang, tambah, type Uang } from '@/lib/uang'
import { hitungPajak } from './pajak'

export const DESIMAL_NILAI = 2

export type PajakBaris = {
  tarif: Uang
  hargaTermasukPajak: boolean
  isPemotongan: boolean
} | null

export type BarisHitung = {
  kuantitas: Uang
  hargaSatuan: Uang
  pajak: PajakBaris
}

export type HasilBaris = {
  /** Dasar pengenaan pajak untuk baris ini. */
  dpp: Uang
  /** Pajak yang menambah nilai tagihan, misalnya PPN Masukan. */
  ppn: Uang
  /** Pajak yang dipotong dari pembayaran, misalnya PPh 23. */
  pemotongan: Uang
  /** DPP ditambah PPN — nilai yang tercantum pada faktur pemasok. */
  totalBaris: Uang
}

/**
 * Menghitung satu baris dokumen pembelian maupun penjualan.
 *
 * PPN dan PPh diperlakukan berbeda karena memang berbeda secara ekonomi:
 * PPN Masukan menambah jumlah yang ditagihkan pemasok dan dapat dikreditkan,
 * sedangkan PPh adalah pajak yang perusahaan potong dari pembayaran kepada
 * pemasok — nilai tagihannya tidak berubah, yang berkurang adalah kasnya.
 */
export function hitungBaris(baris: BarisHitung): HasilBaris {
  const bruto = kali(baris.kuantitas, baris.hargaSatuan)

  if (!baris.pajak || Number(baris.pajak.tarif) === 0) {
    const dpp = bulatkan(bruto, DESIMAL_NILAI)
    return { dpp, ppn: '0.00', pemotongan: '0.00', totalBaris: dpp }
  }

  const { dasar, pajak } = hitungPajak(
    bruto, baris.pajak.tarif, baris.pajak.hargaTermasukPajak,
  )

  if (baris.pajak.isPemotongan) {
    // Pemotongan dihitung dari dasar yang sama, tetapi tidak menambah tagihan.
    return { dpp: dasar, ppn: '0.00', pemotongan: pajak, totalBaris: dasar }
  }

  return {
    dpp: dasar,
    ppn: pajak,
    pemotongan: '0.00',
    totalBaris: bulatkan(tambah(dasar, pajak), DESIMAL_NILAI),
  }
}

export type HasilTotal = {
  totalDpp: Uang
  totalPpn: Uang
  totalPemotongan: Uang
  /** Nilai faktur pemasok: DPP ditambah PPN. */
  totalTagihan: Uang
  /** Kas yang benar-benar keluar: tagihan dikurangi pemotongan. */
  totalDibayar: Uang
  baris: HasilBaris[]
}

export function hitungTotal(baris: BarisHitung[]): HasilTotal {
  const hasil = baris.map(hitungBaris)

  const totalDpp = bulatkan(tambah(...hasil.map((h) => h.dpp)), DESIMAL_NILAI)
  const totalPpn = bulatkan(tambah(...hasil.map((h) => h.ppn)), DESIMAL_NILAI)
  const totalPemotongan = bulatkan(tambah(...hasil.map((h) => h.pemotongan)), DESIMAL_NILAI)
  const totalTagihan = bulatkan(tambah(totalDpp, totalPpn), DESIMAL_NILAI)

  return {
    totalDpp, totalPpn, totalPemotongan, totalTagihan,
    totalDibayar: bulatkan(kurang(totalTagihan, totalPemotongan), DESIMAL_NILAI),
    baris: hasil,
  }
}

/** Sisa kuantitas yang belum diterima atau belum ditagih. */
export function sisaKuantitas(dipesan: Uang, sudah: Uang): Uang {
  const sisa = kurang(dipesan, sudah)
  return Number(sisa) < 0 ? '0' : bulatkan(sisa, 6)
}
