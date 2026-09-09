import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  purchaseOrders, purchaseOrderLines, stockOperations, locations, products,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { buatOperasi, selesaikanOperasi } from '@/modules/gudang/layanan/operasi'
import { ambilPesanan, barisDenganSisa, perbaruiStatusPenyelesaian } from './pesanan'

export type MasukanPenerimaan = {
  poId: string
  tanggal: string
  baris: { poLineId: string; kuantitas: string }[]
}

/**
 * Menerima barang atas sebuah pesanan pembelian.
 *
 * Modul pembelian tidak menulis pergerakan stok sendiri melainkan memanggil
 * layanan gudang, sama seperti modul gudang tidak menulis jurnal sendiri
 * melainkan memanggil layanan akuntansi. Operasi yang dihasilkan menyimpan
 * asal-usulnya sehingga penerimaan selalu dapat ditelusuri balik ke pesanannya.
 */
export async function terimaDariPesanan(
  masukan: MasukanPenerimaan, olehPengguna: string,
): Promise<{ operasiId: string; nomor: string | null }> {
  const pesanan = await ambilPesanan(masukan.poId)
  if (!pesanan) throw new ValidasiError('Pesanan tidak ditemukan')
  if (pesanan.status !== 'dikonfirmasi') {
    throw new ValidasiError(
      'Hanya pesanan yang sudah dikonfirmasi yang dapat menerima barang.',
    )
  }

  const sisa = await barisDenganSisa(masukan.poId)
  const sisaLewatId = new Map(sisa.map((s) => [s.id, s]))

  const barisDipakai = masukan.baris.filter((b) => Number(b.kuantitas) > 0)
  if (barisDipakai.length === 0) {
    throw new ValidasiError('Tidak ada kuantitas yang diterima')
  }

  for (const b of barisDipakai) {
    const baris = sisaLewatId.get(b.poLineId)
    if (!baris) throw new ValidasiError('Baris pesanan tidak ditemukan')
    if (Number(b.kuantitas) > Number(baris.sisaDiterima)) {
      throw new ValidasiError(
        `Penerimaan ${baris.namaProduk} sebanyak ${Number(b.kuantitas)} melebihi sisa pesanan ` +
        `${Number(baris.sisaDiterima)} ${baris.namaUom}.`,
      )
    }
  }

  const [lokasiPemasok] = await db.select().from(locations)
    .where(and(eq(locations.tipe, 'pemasok'), eq(locations.isActive, true))).limit(1)
  if (!lokasiPemasok) {
    throw new ValidasiError('Lokasi virtual Pemasok belum tersedia. Jalankan seed data awal.')
  }

  const operasi = await buatOperasi({
    tipe: 'penerimaan',
    tanggal: masukan.tanggal,
    lokasiAsalId: lokasiPemasok.id,
    lokasiTujuanId: pesanan.lokasiTujuanId,
    partnerId: pesanan.partnerId,
    referensi: pesanan.nomor,
    catatan: `Penerimaan atas pesanan ${pesanan.nomor}`,
    baris: barisDipakai.map((b) => {
      const baris = sisaLewatId.get(b.poLineId)!
      return {
        produkId: baris.produkId,
        kuantitas: b.kuantitas,
        uomId: baris.uomId,
        // Harga dari pesanan memperbarui harga pokok rata-rata produk.
        hargaSatuan: baris.hargaSatuan,
        catatan: null,
      }
    }),
  }, olehPengguna)

  await db.update(stockOperations)
    .set({ sumberTipe: 'pembelian:pesanan', sumberId: masukan.poId })
    .where(eq(stockOperations.id, operasi.id))

  const selesai = await selesaikanOperasi(operasi.id, olehPengguna)

  for (const b of barisDipakai) {
    await db.update(purchaseOrderLines)
      .set({
        kuantitasDiterima: sql`${purchaseOrderLines.kuantitasDiterima} + ${b.kuantitas}`,
      })
      .where(eq(purchaseOrderLines.id, b.poLineId))
  }

  await perbaruiStatusPenyelesaian(masukan.poId)

  return { operasiId: selesai.id, nomor: selesai.nomor }
}

export type PenerimaanPesanan = {
  operasiId: string
  nomor: string | null
  tanggal: string
  status: string
}

/** Riwayat penerimaan yang merujuk sebuah pesanan. */
export async function penerimaanPesanan(poId: string): Promise<PenerimaanPesanan[]> {
  const daftar = await db
    .select({
      operasiId: stockOperations.id,
      nomor: stockOperations.nomor,
      tanggal: stockOperations.tanggal,
      status: stockOperations.status,
    })
    .from(stockOperations)
    .where(and(
      eq(stockOperations.sumberTipe, 'pembelian:pesanan'),
      eq(stockOperations.sumberId, poId),
    ))
    .orderBy(stockOperations.tanggal)

  return daftar
}

export { products, purchaseOrders }
