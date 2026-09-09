'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { wajibIzin } from '@/lib/sesi'
import {
  buatOperasi, ubahOperasi, selesaikanOperasi, batalkanOperasi, hapusOperasi,
} from '@/modules/gudang/layanan/operasi'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import { TIPE_KE_SLUG, type MasukanOperasi } from '@/modules/gudang/validasi/operasi'

export type HasilAksi =
  | { berhasil: true; id?: string }
  | { berhasil: false; pesan: string }

/** Setiap tipe operasi punya kode izinnya sendiri. */
const IZIN: Record<string, string> = {
  penerimaan: 'gudang.penerimaan.kelola',
  pengiriman: 'gudang.pengiriman.kelola',
  transfer: 'gudang.transfer.kelola',
  barang_rusak: 'gudang.scrap.kelola',
  opname: 'gudang.opname.kelola',
  // Operasi produksi hanya dapat dilihat oleh yang berhak atas perintahnya.
  konsumsi_produksi: 'manufaktur.mo.lihat',
  hasil_produksi: 'manufaktur.mo.lihat',
}

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

function segarkan(tipe: string) {
  revalidatePath(`/gudang/operasi/${TIPE_KE_SLUG[tipe] ?? tipe}`)
  revalidatePath('/gudang/laporan/stok-tersedia')
  revalidatePath('/gudang/laporan/valuasi')
  revalidatePath('/gudang/laporan/kartu-stok')
  revalidatePath('/akuntansi/jurnal/entri')
}

export async function aksiSimpanOperasi(
  id: string | null, masukan: MasukanOperasi,
): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN[masukan.tipe] ?? 'gudang.penerimaan.kelola')
  try {
    const operasi = id
      ? await ubahOperasi(id, masukan)
      : await buatOperasi(masukan, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'stock_operations', entitasId: operasi.id,
      aksi: id ? 'ubah' : 'buat',
      dataBaru: { tipe: masukan.tipe, tanggal: masukan.tanggal },
    })
    segarkan(masukan.tipe)
    return { berhasil: true, id: operasi.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiSelesaikanOperasi(id: string, tipe: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN[tipe] ?? 'gudang.penerimaan.kelola')
  try {
    const operasi = await selesaikanOperasi(id, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'stock_operations', entitasId: id,
      aksi: 'posting', dataBaru: { nomor: operasi.nomor },
    })
    segarkan(tipe)
    return { berhasil: true, id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiBatalkanOperasi(id: string, tipe: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN[tipe] ?? 'gudang.penerimaan.kelola')
  try {
    await batalkanOperasi(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'stock_operations', entitasId: id,
      aksi: 'ubah', dataBaru: { status: 'dibatalkan' },
    })
    segarkan(tipe)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusOperasi(id: string, tipe: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN[tipe] ?? 'gudang.penerimaan.kelola')
  try {
    await hapusOperasi(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'stock_operations', entitasId: id, aksi: 'hapus',
    })
    segarkan(tipe)
  } catch (galat) {
    return keHasil(galat)
  }
  redirect(`/gudang/operasi/${TIPE_KE_SLUG[tipe] ?? tipe}`)
}
