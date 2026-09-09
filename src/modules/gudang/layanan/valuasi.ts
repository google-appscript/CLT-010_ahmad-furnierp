import { bagi, bulatkan, kali, kurang, tambah, type Uang } from '@/lib/uang'
import { ValidasiError } from '@/lib/galat'

/** Kuantitas dan harga pokok satuan disimpan dengan enam desimal. */
export const DESIMAL_KUANTITAS = 6
export const DESIMAL_HARGA = 6
/** Nilai rupiah tetap dua desimal. */
export const DESIMAL_NILAI = 2

/**
 * Menghitung harga pokok rata-rata bergerak setelah barang masuk.
 *
 *   rata-rata baru = (nilai persediaan lama + nilai barang masuk)
 *                    ÷ (kuantitas lama + kuantitas masuk)
 *
 * Bila kuantitas sebelumnya nol atau minus, harga masuk langsung menjadi
 * rata-rata baru. Rata-rata atas kuantitas nol tidak punya arti ekonomis, dan
 * rata-rata atas kuantitas minus akan menyeret nilai persediaan ke arah yang
 * keliru; keduanya lebih baik direset ke harga beli terbaru yang nyata.
 */
export function hitungRataRataBaru(
  kuantitasLama: Uang,
  rataRataLama: Uang,
  kuantitasMasuk: Uang,
  hargaMasuk: Uang,
): Uang {
  if (Number(kuantitasMasuk) <= 0) {
    throw new ValidasiError('Kuantitas barang masuk harus lebih besar dari nol')
  }
  if (Number(hargaMasuk) < 0) {
    throw new ValidasiError('Harga barang masuk tidak boleh negatif')
  }

  if (Number(kuantitasLama) <= 0) return bulatkan(hargaMasuk, DESIMAL_HARGA)

  const nilaiGabungan = tambah(
    kali(kuantitasLama, rataRataLama),
    kali(kuantitasMasuk, hargaMasuk),
  )
  return bulatkan(
    bagi(nilaiGabungan, tambah(kuantitasLama, kuantitasMasuk)),
    DESIMAL_HARGA,
  )
}

/** Nilai rupiah sebuah pergerakan stok, dibulatkan ke dua desimal. */
export function hitungNilaiPergerakan(kuantitas: Uang, hargaSatuan: Uang): Uang {
  return bulatkan(kali(kuantitas, hargaSatuan), DESIMAL_NILAI)
}

/**
 * Mengonversi kuantitas antar satuan dalam kategori yang sama.
 *
 * `faktor` menyatakan berapa satuan acuan yang setara dengan satu satuan
 * tersebut, sehingga konversi adalah perkalian ke acuan lalu pembagian ke
 * satuan tujuan.
 */
export function konversiSatuan(
  kuantitas: Uang,
  faktorAsal: Uang,
  faktorTujuan: Uang,
): Uang {
  if (Number(faktorTujuan) <= 0 || Number(faktorAsal) <= 0) {
    throw new ValidasiError('Faktor satuan harus lebih besar dari nol')
  }
  return bulatkan(bagi(kali(kuantitas, faktorAsal), faktorTujuan), DESIMAL_KUANTITAS)
}

export type DampakValuasi = {
  /** Harga pokok satuan yang dipakai pergerakan ini. */
  hargaPokokSatuan: Uang
  /** Nilai rupiah pergerakan ini. */
  nilaiTotal: Uang
  /** Harga pokok rata-rata produk setelah pergerakan ini. */
  rataRataBaru: Uang
  /** Kuantitas tersedia setelah pergerakan ini. */
  kuantitasBaru: Uang
}

/**
 * Menghitung dampak sebuah pergerakan stok terhadap valuasi produk.
 *
 * Barang masuk memperbarui rata-rata bergerak dengan harga belinya. Barang
 * keluar tidak mengubah rata-rata, hanya memakainya — inilah yang membuat
 * metode ini disebut rata-rata *bergerak*: harga hanya bergerak saat membeli.
 */
export function hitungDampakValuasi(masukan: {
  arah: 'masuk' | 'keluar'
  kuantitas: Uang
  kuantitasSaatIni: Uang
  rataRataSaatIni: Uang
  /** Wajib untuk arah masuk; diabaikan untuk arah keluar. */
  hargaMasuk?: Uang
}): DampakValuasi {
  const { arah, kuantitas, kuantitasSaatIni, rataRataSaatIni } = masukan

  if (Number(kuantitas) <= 0) {
    throw new ValidasiError('Kuantitas pergerakan harus lebih besar dari nol')
  }

  if (arah === 'masuk') {
    const hargaMasuk = masukan.hargaMasuk ?? rataRataSaatIni
    const rataRataBaru = hitungRataRataBaru(
      kuantitasSaatIni, rataRataSaatIni, kuantitas, hargaMasuk,
    )
    return {
      hargaPokokSatuan: bulatkan(hargaMasuk, DESIMAL_HARGA),
      nilaiTotal: hitungNilaiPergerakan(kuantitas, hargaMasuk),
      rataRataBaru,
      kuantitasBaru: bulatkan(tambah(kuantitasSaatIni, kuantitas), DESIMAL_KUANTITAS),
    }
  }

  return {
    hargaPokokSatuan: bulatkan(rataRataSaatIni, DESIMAL_HARGA),
    nilaiTotal: hitungNilaiPergerakan(kuantitas, rataRataSaatIni),
    rataRataBaru: bulatkan(rataRataSaatIni, DESIMAL_HARGA),
    kuantitasBaru: bulatkan(kurang(kuantitasSaatIni, kuantitas), DESIMAL_KUANTITAS),
  }
}
