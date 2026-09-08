'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { buatPajak, ubahPajak } from '@/modules/akuntansi/layanan/pajak'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanPajak } from '@/modules/akuntansi/validasi/pajak'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

export async function aksiSimpanPajak(id: string | null, masukan: MasukanPajak): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.pajak.kelola')
  try {
    const pajak = id ? await ubahPajak(id, masukan) : await buatPajak(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'taxes', entitasId: pajak.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: masukan,
    })
    revalidatePath('/akuntansi/konfigurasi/pajak')
    return { berhasil: true }
  } catch (galat) {
    return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
  }
}
