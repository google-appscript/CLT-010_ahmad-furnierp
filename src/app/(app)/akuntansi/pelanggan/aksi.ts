'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { wajibIzin } from '@/lib/sesi'
import {
  buatFaktur, ubahFaktur, postingFaktur, batalkanFaktur, hapusFaktur,
} from '@/modules/penjualan/layanan/faktur'
import {
  buatPembayaran, postingPembayaran, hapusPembayaran,
} from '@/modules/penjualan/layanan/pembayaran'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanFaktur, MasukanPembayaran } from '@/modules/penjualan/validasi/pesanan'

export type HasilAksi = { berhasil: true; id?: string } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return {
    berhasil: false,
    pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga',
  }
}

function segarkan() {
  revalidatePath('/akuntansi/pelanggan/faktur')
  revalidatePath('/akuntansi/pelanggan/nota-kredit')
  revalidatePath('/akuntansi/pelanggan/pembayaran')
  revalidatePath('/akuntansi/jurnal/rekonsiliasi')
  revalidatePath('/penjualan/pesanan')
  revalidatePath('/akuntansi/jurnal/entri')
}

export async function aksiSimpanFaktur(
  id: string | null, masukan: MasukanFaktur,
): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.faktur.lihat')
  try {
    const faktur = id
      ? await ubahFaktur(id, masukan)
      : await buatFaktur(masukan, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'customer_invoices', entitasId: faktur.id,
      aksi: id ? 'ubah' : 'buat', dataBaru: { tipe: masukan.tipe, tanggal: masukan.tanggal },
    })
    segarkan()
    return { berhasil: true, id: faktur.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiPostingFaktur(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.faktur.lihat')
  try {
    const faktur = await postingFaktur(id, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'customer_invoices', entitasId: id,
      aksi: 'posting', dataBaru: { nomor: faktur.nomor },
    })
    segarkan()
    return { berhasil: true, id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiBatalkanFaktur(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.faktur.lihat')
  try {
    await batalkanFaktur(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'customer_invoices', entitasId: id,
      aksi: 'ubah', dataBaru: { status: 'dibatalkan' },
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusFaktur(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.faktur.lihat')
  try {
    await hapusFaktur(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'customer_invoices', entitasId: id, aksi: 'hapus',
    })
    segarkan()
  } catch (galat) {
    return keHasil(galat)
  }
  redirect('/akuntansi/pelanggan/faktur')
}

export async function aksiBuatPembayaran(masukan: MasukanPembayaran): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.pembayaran-masuk.lihat')
  try {
    const pembayaran = await buatPembayaran(masukan, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'customer_payments', entitasId: pembayaran.id,
      aksi: 'buat', dataBaru: { jumlah: masukan.jumlah, tanggal: masukan.tanggal },
    })
    segarkan()
    return { berhasil: true, id: pembayaran.id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiPostingPembayaran(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.pembayaran-masuk.lihat')
  try {
    const pembayaran = await postingPembayaran(id, sesi.penggunaId)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'customer_payments', entitasId: id,
      aksi: 'posting', dataBaru: { nomor: pembayaran.nomor },
    })
    segarkan()
    return { berhasil: true, id }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiHapusPembayaran(id: string): Promise<HasilAksi> {
  const sesi = await wajibIzin('akuntansi.pembayaran-masuk.lihat')
  try {
    await hapusPembayaran(id)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'customer_payments', entitasId: id, aksi: 'hapus',
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
