'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { wajibIzin } from '@/lib/sesi'
import {
  buatTagihan, ubahTagihan, postingTagihan, batalkanTagihan, hapusTagihan,
} from '@/modules/pembelian/layanan/tagihan'
import { buatPembayaran, postingPembayaran, hapusPembayaran } from '@/modules/pembelian/layanan/pembayaran'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanTagihan, MasukanPembayaran } from '@/modules/pembelian/validasi/pesanan'

export type HasilAksi = { berhasil: true; id?: string } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

function segarkan() {
  revalidatePath('/akuntansi/pemasok/tagihan')
  revalidatePath('/akuntansi/pemasok/nota-debit')
  revalidatePath('/akuntansi/pemasok/pembayaran')
  revalidatePath('/pembelian/pesanan')
  revalidatePath('/akuntansi/jurnal/entri')
}

export async function aksiSimpanTagihan(
  id: string | null, masukan: MasukanTagihan,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.tagihan.lihat')
  try {
    const tagihan = id
      ? await ubahTagihan(id, masukan)
      : await buatTagihan(masukan, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'vendor_bills', entitasId: tagihan.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { tipe: masukan.tipe, tanggal: masukan.tanggal },
    })
    segarkan()
    return { berhasil: true, id: tagihan.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiPostingTagihan(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.tagihan.lihat')
  try {
    const tagihan = await postingTagihan(id, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'vendor_bills', entitasId: id,
      aksi: 'posting', dataBaru: { nomor: tagihan.nomor },
    })
    segarkan()
    return { berhasil: true, id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiBatalkanTagihan(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.tagihan.lihat')
  try {
    await batalkanTagihan(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'vendor_bills', entitasId: id,
      aksi: 'ubah', dataBaru: { status: 'dibatalkan' },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusTagihan(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.tagihan.lihat')
  try {
    await hapusTagihan(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'vendor_bills', entitasId: id, aksi: 'hapus',
    })
    segarkan()
  } catch (galat) {
    return keHasil(galat)
  }
  redirect('/akuntansi/pemasok/tagihan')
}

export async function aksiBuatPembayaran(masukan: MasukanPembayaran): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.pembayaran-keluar.lihat')
  try {
    const pembayaran = await buatPembayaran(masukan, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'vendor_payments', entitasId: pembayaran.id,
      aksi: 'buat', dataBaru: { jumlah: masukan.jumlah, tanggal: masukan.tanggal },
    })
    segarkan()
    return { berhasil: true, id: pembayaran.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiPostingPembayaran(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.pembayaran-keluar.lihat')
  try {
    const pembayaran = await postingPembayaran(id, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'vendor_payments', entitasId: id,
      aksi: 'posting', dataBaru: { nomor: pembayaran.nomor },
    })
    segarkan()
    return { berhasil: true, id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusPembayaran(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.pembayaran-keluar.lihat')
  try {
    await hapusPembayaran(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'vendor_payments', entitasId: id, aksi: 'hapus',
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
