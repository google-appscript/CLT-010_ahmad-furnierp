'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { buatBom, ubahBom, ubahStatusBom, kebutuhanBahan } from '@/modules/manufaktur/layanan/bom'
import {
  buatPerintahProduksi, ubahPerintahProduksi, konfirmasiPerintahProduksi,
  selesaikanPerintahProduksi, batalkanPerintahProduksi, hapusPerintahProduksi,
} from '@/modules/manufaktur/layanan/perintah-produksi'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanBom, MasukanPerintahProduksi } from '@/modules/manufaktur/validasi/produksi'

export type HasilAksi = { berhasil: true; id?: string } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

function segarkan() {
  revalidatePath('/manufaktur/bom')
  revalidatePath('/manufaktur/perintah-produksi')
  revalidatePath('/manufaktur/laporan/hpp')
  revalidatePath('/gudang/laporan/stok-tersedia')
  revalidatePath('/gudang/laporan/valuasi')
  revalidatePath('/gudang/laporan/kartu-stok')
  revalidatePath('/akuntansi/jurnal/entri')
}

// ── Resep ────────────────────────────────────────────────────────────────────

export async function aksiSimpanBom(
  id: string | null, masukan: MasukanBom,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('manufaktur.bom.lihat')
  try {
    const bom = id ? await ubahBom(id, masukan) : await buatBom(masukan, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'bill_of_materials', entitasId: bom.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { kode: masukan.kode },
    })
    segarkan()
    return { berhasil: true, id: bom.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusBom(id: string, isActive: boolean): Promise<HasilAksi> {
  const sesi = await wajibIzin('manufaktur.bom.lihat')
  try {
    await ubahStatusBom(id, isActive)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'bill_of_materials', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

/** Dipanggil formulir perintah produksi saat resep dipilih. */
export async function aksiKebutuhanBahan(bomId: string, kuantitas: string) {
  await wajibIzin('manufaktur.mo.lihat')
  try {
    return { berhasil: true as const, baris: await kebutuhanBahan(bomId, kuantitas) }
  } catch (galat) {
    return {
      berhasil: false as const,
      pesan: galat instanceof Error ? galat.message : 'Gagal membaca resep',
    }
  }
}

// ── Perintah produksi ────────────────────────────────────────────────────────

export async function aksiSimpanPerintah(
  id: string | null, masukan: MasukanPerintahProduksi,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('manufaktur.mo.lihat')
  try {
    const perintah = id
      ? await ubahPerintahProduksi(id, masukan)
      : await buatPerintahProduksi(masukan, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'work_orders', entitasId: perintah.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { tanggal: masukan.tanggal },
    })
    segarkan()
    return { berhasil: true, id: perintah.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiKonfirmasiPerintah(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('manufaktur.mo.lihat')
  try {
    const perintah = await konfirmasiPerintahProduksi(id, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'work_orders', entitasId: id,
      aksi: 'posting', dataBaru: { nomor: perintah.nomor },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiSelesaikanPerintah(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('manufaktur.mo.lihat')
  try {
    const perintah = await selesaikanPerintahProduksi(id, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'work_orders', entitasId: id,
      aksi: 'posting', dataBaru: { hargaPokokSatuan: perintah.hargaPokokSatuan },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiBatalkanPerintah(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('manufaktur.mo.lihat')
  try {
    await batalkanPerintahProduksi(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'work_orders', entitasId: id, aksi: 'ubah',
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusPerintah(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('manufaktur.mo.lihat')
  try {
    await hapusPerintahProduksi(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'work_orders', entitasId: id, aksi: 'hapus',
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
