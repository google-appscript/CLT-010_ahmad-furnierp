import { koneksi } from '@/db/klien'

export async function bersihkanTabel(namaTabel: string[]) {
  if (namaTabel.length === 0) return
  const daftar = namaTabel.map((n) => `"${n}"`).join(', ')
  await koneksi.unsafe(`TRUNCATE TABLE ${daftar} RESTART IDENTITY CASCADE`)
}

export async function tutupKoneksi() {
  await koneksi.end()
}
