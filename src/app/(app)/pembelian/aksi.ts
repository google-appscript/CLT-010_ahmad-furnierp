'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { wajibIzin } from '@/lib/sesi'
import {
  buatPesanan, ubahPesanan, konfirmasiPesanan, batalkanPesanan, hapusPermintaan,
} from '@/modules/pembelian/layanan/pesanan'
import { terimaDariPesanan } from '@/modules/pembelian/layanan/penerimaan'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanPesanan } from '@/modules/pembelian/validasi/pesanan'

export type HasilAksi = { berhasil: true; id?: string } | { berhasil: false; pesan: string }

const IZIN_LIHAT = 'pembelian.pesanan.lihat'

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

function segarkan() {
  revalidatePath('/pembelian/permintaan')
  revalidatePath('/pembelian/pesanan')
  revalidatePath('/pembelian/laporan')
  revalidatePath('/gudang/operasi/penerimaan')
  revalidatePath('/gudang/laporan/stok-tersedia')
}

export async function aksiSimpanPesanan(
  id: string | null, masukan: MasukanPesanan,
): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN_LIHAT)
  try {
    const pesanan = id
      ? await ubahPesanan(id, masukan)
      : await buatPesanan(masukan, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'purchase_orders', entitasId: pesanan.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { tanggal: masukan.tanggal },
    })
    segarkan()
    return { berhasil: true, id: pesanan.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiKonfirmasiPesanan(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN_LIHAT)
  try {
    const pesanan = await konfirmasiPesanan(id, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'purchase_orders', entitasId: id,
      aksi: 'posting', dataBaru: { nomor: pesanan.nomor },
    })
    segarkan()
    return { berhasil: true, id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiBatalkanPesanan(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN_LIHAT)
  try {
    await batalkanPesanan(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'purchase_orders', entitasId: id,
      aksi: 'ubah', dataBaru: { status: 'dibatalkan' },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusPermintaan(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN_LIHAT)
  try {
    await hapusPermintaan(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'purchase_orders', entitasId: id, aksi: 'hapus',
    })
    segarkan()
  } catch (galat) {
    return keHasil(galat)
  }
  redirect('/pembelian/permintaan')
}

export async function aksiTerimaBarang(
  poId: string, tanggal: string, baris: { poLineId: string; kuantitas: string }[],
): Promise<HasilAksi> {
  const sesi = await wajibIzin('gudang.penerimaan.kelola')
  try {
    const hasil = await terimaDariPesanan({ poId, tanggal, baris }, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'stock_operations', entitasId: hasil.operasiId,
      aksi: 'posting', dataBaru: { nomor: hasil.nomor, poId },
    })
    segarkan()
    return { berhasil: true, id: hasil.operasiId }
  } catch (galat) {
    return keHasil(galat)
  }
}
