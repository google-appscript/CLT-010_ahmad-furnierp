import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 40 })

/** Nilai uang selalu dibawa sebagai string desimal, tidak pernah sebagai number. */
export type Uang = string

function d(nilai: Uang | number): Decimal {
  return new Decimal(nilai)
}

export function tambah(...nilai: Uang[]): Uang {
  return nilai.reduce((total, n) => total.plus(d(n)), new Decimal(0)).toString()
}

export function kurang(a: Uang, b: Uang): Uang {
  return d(a).minus(d(b)).toString()
}

export function kali(a: Uang, pengali: Uang | number): Uang {
  return d(a).times(d(pengali)).toString()
}

export function bagi(a: Uang, pembagi: Uang | number): Uang {
  const p = d(pembagi)
  if (p.isZero()) throw new Error('Pembagian dengan nol tidak diizinkan')
  return d(a).dividedBy(p).toString()
}

export function negasi(a: Uang): Uang {
  return d(a).negated().toString()
}

export function bulatkan(nilai: Uang, desimal: number): Uang {
  return d(nilai).toFixed(desimal, Decimal.ROUND_HALF_UP)
}

export function bandingkan(a: Uang, b: Uang): -1 | 0 | 1 {
  return d(a).comparedTo(d(b)) as -1 | 0 | 1
}

export function samaDengan(a: Uang, b: Uang): boolean {
  return d(a).equals(d(b))
}

export function nol(desimal = 0): Uang {
  return new Decimal(0).toFixed(desimal)
}

export function adalahNol(nilai: Uang): boolean {
  return d(nilai).isZero()
}

/**
 * Pemformatan dilakukan manual, bukan lewat Intl.NumberFormat, karena Intl
 * memerlukan konversi ke number yang kehilangan presisi pada nilai besar.
 */
export function formatAngka(nilai: Uang, desimal = 2): string {
  const tetap = d(nilai).toFixed(desimal, Decimal.ROUND_HALF_UP)
  const negatif = tetap.startsWith('-')
  const [bulat, pecahan] = tetap.replace('-', '').split('.')
  const bulatBerpemisah = bulat.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const hasil = pecahan ? `${bulatBerpemisah},${pecahan}` : bulatBerpemisah
  return negatif ? `-${hasil}` : hasil
}

export function formatRupiah(nilai: Uang, desimal = 2): string {
  const angka = formatAngka(nilai, desimal)
  return angka.startsWith('-') ? `-Rp ${angka.slice(1)}` : `Rp ${angka}`
}

/** Mengubah input bergaya Indonesia (1.234.567,89) menjadi Uang. */
export function uraiInput(teks: string): Uang {
  const bersih = teks
    .replace(/Rp/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
  if (bersih === '' || bersih === '-') return '0'
  if (!/^-?\d+(\.\d+)?$/.test(bersih)) {
    throw new Error(`Nilai tidak valid: ${teks}`)
  }
  return new Decimal(bersih).toString()
}
