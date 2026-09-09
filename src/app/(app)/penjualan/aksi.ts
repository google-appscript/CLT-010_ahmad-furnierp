'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { wajibIzin } from '@/lib/sesi'
import {
  buatPesanan, ubahPesanan, konfirmasiPesanan, batalkanPesanan, hapusPenawaran,
} from '@/modules/penjualan/layanan/pesanan'
import { kirimDariPesanan } from '@/modules/penjualan/layanan/pengiriman'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanPesanan } from '@/modules/penjualan/validasi/pesanan'

export type HasilAksi = { berhasil: true; id?: string } | { berhasil: false; pesan: string }

const IZIN = 'penjualan.pesanan.lihat'

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

function segarkan() {
  revalidatePath('/penjualan/penawaran')
  revalidatePath('/penjualan/pesanan')
  revalidatePath('/penjualan/laporan')
  revalidatePath('/gudang/operasi/pengiriman')
  revalidatePath('/gudang/laporan/stok-tersedia')
}

export async function aksiSimpanPesanan(
  id: string | null, masukan: MasukanPesanan,
): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    const pesanan = id
      ? await ubahPesanan(id, masukan)
      : await buatPesanan(masukan, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'sales_orders', entitasId: pesanan.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { tanggal: masukan.tanggal },
    })
    segarkan()
    return { berhasil: true, id: pesanan.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiKonfirmasiPesanan(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    const pesanan = await konfirmasiPesanan(id, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'sales_orders', entitasId: id,
      aksi: 'posting', dataBaru: { nomor: pesanan.nomor },
    })
    segarkan()
    return { berhasil: true, id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiBatalkanPesanan(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    await batalkanPesanan(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'sales_orders', entitasId: id,
      aksi: 'ubah', dataBaru: { status: 'dibatalkan' },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusPenawaran(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    await hapusPenawaran(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'sales_orders', entitasId: id, aksi: 'hapus',
    })
    segarkan()
  } catch (galat) {
    return keHasil(galat)
  }
  redirect('/penjualan/penawaran')
}

export async function aksiKirimBarang(
  soId: string, tanggal: string, baris: { soLineId: string; kuantitas: string }[],
): Promise<HasilAksi> {
  const sesi = await wajibIzin('gudang.pengiriman.kelola')
  try {
    const hasil = await kirimDariPesanan({ soId, tanggal, baris }, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'stock_operations', entitasId: hasil.operasiId,
      aksi: 'posting', dataBaru: { nomor: hasil.nomor, soId },
    })
    segarkan()
    return { berhasil: true, id: hasil.operasiId }
  } catch (galat) {
    return keHasil(galat)
  }
}
