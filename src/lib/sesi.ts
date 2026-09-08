import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { punyaIzin } from './izin'

export type Sesi = {
  penggunaId: string
  nama: string
  email: string
  izin: string[]
}

export async function ambilSesi(): Promise<Sesi> {
  const sesi = await auth()
  if (!sesi?.user?.id) redirect('/masuk')
  return {
    penggunaId: sesi.user.id,
    nama: sesi.user.name ?? '',
    email: sesi.user.email ?? '',
    izin: sesi.user.izin ?? [],
  }
}

export class TanpaIzinError extends Error {
  constructor(kode: string) {
    super(`Anda tidak memiliki izin untuk tindakan ini (${kode})`)
    this.name = 'TanpaIzinError'
  }
}

/** Dipakai di komponen server dan Server Action sebelum mengakses data. */
export async function wajibIzin(kode: string): Promise<Sesi> {
  const sesi = await ambilSesi()
  if (!punyaIzin(sesi.izin, kode)) throw new TanpaIzinError(kode)
  return sesi
}
