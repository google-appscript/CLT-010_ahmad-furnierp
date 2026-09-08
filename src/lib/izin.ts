export const WILDCARD = '*'

/**
 * Mengevaluasi apakah daftar izin yang dimiliki mencakup kode yang diperlukan.
 * Mendukung dua bentuk wildcard:
 *   '*'            — mencakup seluruh kode
 *   'akuntansi.*'  — mencakup seluruh kode di bawah segmen 'akuntansi'
 */
export function punyaIzin(dimiliki: string[], diperlukan: string): boolean {
  return dimiliki.some((izin) => {
    if (izin === WILDCARD) return true
    if (izin.endsWith('.*')) return diperlukan.startsWith(izin.slice(0, -1))
    return izin === diperlukan
  })
}

export function punyaSalahSatuIzin(dimiliki: string[], diperlukan: string[]): boolean {
  return diperlukan.some((kode) => punyaIzin(dimiliki, kode))
}
