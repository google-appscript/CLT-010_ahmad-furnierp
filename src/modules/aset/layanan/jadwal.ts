import { bagi, bulatkan, kali, kurang, tambah, type Uang } from '@/lib/uang'
import { ValidasiError } from '@/lib/galat'

/** Nilai rupiah selalu dua desimal. */
export const DESIMAL = 2

export type MetodeDepresiasi = 'garis_lurus' | 'saldo_menurun_ganda'

export type BarisJadwal = {
  urutan: number
  /** Akhir bulan yang dibebani. */
  tanggal: string
  nilai: Uang
  akumulasi: Uang
  nilaiBuku: Uang
}

export type MasukanJadwal = {
  nilaiPerolehan: Uang
  nilaiResidu: Uang
  masaManfaatBulan: number
  metode: MetodeDepresiasi
  /** Bulan pertama yang dibebani; tanggalnya diabaikan, bulannya yang dipakai. */
  tanggalMulai: string
}

/** Akhir bulan ke-`geser` setelah bulan `tanggalIso`, dalam format YYYY-MM-DD. */
export function akhirBulanSetelah(tanggalIso: string, geser: number): string {
  const [tahun, bulan] = tanggalIso.split('-').map(Number)
  // Hari 0 pada bulan berikutnya adalah hari terakhir bulan yang dimaksud.
  const akhir = new Date(Date.UTC(tahun, bulan + geser, 0))
  return akhir.toISOString().slice(0, 10)
}

/**
 * Menyusun jadwal depresiasi bulanan.
 *
 * Kedua metode berhenti tepat di nilai residu: baris terakhir selalu menyerap
 * sisa pembulatan, sehingga jumlah seluruh beban persis sama dengan nilai
 * perolehan dikurangi residu. Tanpa itu, nilai buku aset akan meleset beberapa
 * sen dari saldo akumulasinya di buku besar.
 *
 * Saldo menurun ganda beralih ke garis lurus begitu garis lurus atas sisa
 * masa manfaat memberi beban lebih besar. Tanpa peralihan itu, metode saldo
 * menurun tidak pernah benar-benar mencapai residu dan menyisakan lonjakan
 * beban di bulan terakhir.
 */
export function susunJadwal(masukan: MasukanJadwal): BarisJadwal[] {
  const { nilaiPerolehan, nilaiResidu, masaManfaatBulan, metode, tanggalMulai } = masukan

  if (masaManfaatBulan <= 0) {
    throw new ValidasiError('Masa manfaat harus lebih besar dari nol bulan')
  }
  if (Number(nilaiPerolehan) <= 0) {
    throw new ValidasiError('Nilai perolehan harus lebih besar dari nol')
  }
  if (Number(nilaiResidu) < 0) {
    throw new ValidasiError('Nilai residu tidak boleh negatif')
  }
  if (Number(nilaiResidu) >= Number(nilaiPerolehan)) {
    throw new ValidasiError('Nilai residu harus lebih kecil dari nilai perolehan')
  }

  const dasar = bulatkan(kurang(nilaiPerolehan, nilaiResidu), DESIMAL)
  const nilaiPerBulan = hitungBeban(dasar, masaManfaatBulan, metode)

  const baris: BarisJadwal[] = []
  let akumulasi = '0'
  let urutan = 0

  for (let i = 0; i < nilaiPerBulan.length; i += 1) {
    const nilai = nilaiPerBulan[i]
    // Bulan yang bebannya membulat ke nol tidak menghasilkan jurnal apa pun,
    // jadi tidak perlu menjadi baris jadwal.
    if (Number(nilai) === 0) continue

    akumulasi = bulatkan(tambah(akumulasi, nilai), DESIMAL)
    urutan += 1
    baris.push({
      urutan,
      tanggal: akhirBulanSetelah(tanggalMulai, i),
      nilai,
      akumulasi,
      nilaiBuku: bulatkan(kurang(nilaiPerolehan, akumulasi), DESIMAL),
    })
  }

  return baris
}

/** Besaran beban tiap bulan, belum disaring dari bulan yang bernilai nol. */
function hitungBeban(dasar: Uang, masa: number, metode: MetodeDepresiasi): Uang[] {
  const hasil: Uang[] = []
  let sisa = dasar

  for (let bulan = 0; bulan < masa; bulan += 1) {
    const sisaBulan = masa - bulan
    // Bulan terakhir menyerap seluruh sisa agar totalnya persis.
    if (sisaBulan === 1) {
      hasil.push(bulatkan(sisa, DESIMAL))
      break
    }

    const garisLurus = bulatkan(bagi(sisa, sisaBulan), DESIMAL)
    let nilai = garisLurus

    if (metode === 'saldo_menurun_ganda') {
      const menurun = bulatkan(kali(sisa, bagi('2', masa)), DESIMAL)
      // Peralihan ke garis lurus terjadi sendirinya lewat pemilihan yang
      // lebih besar di antara keduanya.
      nilai = Number(menurun) > Number(garisLurus) ? menurun : garisLurus
    }

    if (Number(nilai) > Number(sisa)) nilai = bulatkan(sisa, DESIMAL)
    hasil.push(nilai)
    sisa = bulatkan(kurang(sisa, nilai), DESIMAL)
  }

  return hasil
}
