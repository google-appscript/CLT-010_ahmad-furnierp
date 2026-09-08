'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  buatSyaratPembayaran, ubahSyaratPembayaran,
} from '@/modules/akuntansi/layanan/syarat-pembayaran'
import type { MasukanSyaratPembayaran } from '@/modules/akuntansi/validasi/pajak'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

export async function aksiSimpanSyarat(
  id: string | null, masukan: MasukanSyaratPembayaran,
): Promise<HasilAksi> {
  await wajibIzin('akuntansi.syarat-bayar.kelola')
  try {
    if (id) await ubahSyaratPembayaran(id, masukan)
    else await buatSyaratPembayaran(masukan)
    revalidatePath('/akuntansi/konfigurasi/syarat-pembayaran')
    return { berhasil: true }
  } catch (galat) {
    return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
  }
}
