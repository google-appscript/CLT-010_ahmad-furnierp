/** Periode bawaan: tahun berjalan sampai hari ini. */
export function periodeBawaan(params: Record<string, string | string[] | undefined>) {
  const hariIni = new Date().toISOString().slice(0, 10)
  const tahun = hariIni.slice(0, 4)
  const ambil = (k: string) => (Array.isArray(params[k]) ? params[k][0] : params[k])
  return {
    dari: ambil('dari') ?? `${tahun}-01-01`,
    sampai: ambil('sampai') ?? hariIni,
  }
}

export const penanggalanId = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium', timeZone: 'Asia/Jakarta',
})

export function tanggalPanjang(iso: string): string {
  return penanggalanId.format(new Date(`${iso}T00:00:00Z`))
}
