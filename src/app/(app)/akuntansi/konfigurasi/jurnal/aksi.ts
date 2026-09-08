'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { buatJurnal, ubahJurnal } from '@/modules/akuntansi/layanan/jurnal'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanJurnal } from '@/modules/akuntansi/validasi/jurnal'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

export async function aksiSimpanJurnal(
  id: string | null, masukan: MasukanJurnal,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.jurnal-master.kelola')
  try {
    const jurnal = id ? await ubahJurnal(id, masukan) : await buatJurnal(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'journals', entitasId: jurnal.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: masukan,
    })
    revalidatePath('/akuntansi/konfigurasi/jurnal')
    return { berhasil: true }
  } catch (galat) {
    return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
  }
}
