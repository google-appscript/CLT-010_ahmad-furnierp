import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import { salesOrderLines, stockOperations, locations } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { buatOperasi, selesaikanOperasi } from '@/modules/gudang/layanan/operasi'
import { ambilPesanan, barisDenganSisa, perbaruiStatusPenyelesaian } from './pesanan'

export type MasukanPengiriman = {
  soId: string
  tanggal: string
  baris: { soLineId: string; kuantitas: string }[]
}

/**
 * Mengirim barang atas sebuah pesanan penjualan.
 *
 * Modul penjualan tidak menulis pergerakan stok sendiri melainkan memanggil
 * layanan gudang, yang membebankan harga pokok rata-rata dan memposting
 * jurnal Harga Pokok Penjualan lawan Persediaan. Pendapatan baru dicatat saat
 * faktur diposting, sehingga beban dan pendapatan tidak bercampur di satu
 * dokumen.
 */
export async function kirimDariPesanan(
  masukan: MasukanPengiriman, olehPengguna: string,
): Promise<{ operasiId: string; nomor: string | null }> {
  const pesanan = await ambilPesanan(masukan.soId)
  if (!pesanan) throw new ValidasiError('Pesanan tidak ditemukan')
  if (pesanan.status !== 'dikonfirmasi') {
    throw new ValidasiError('Hanya pesanan yang sudah dikonfirmasi yang dapat dikirim.')
  }

  const sisa = await barisDenganSisa(masukan.soId)
  const sisaLewatId = new Map(sisa.map((s) => [s.id, s]))

  const barisDipakai = masukan.baris.filter((b) => Number(b.kuantitas) > 0)
  if (barisDipakai.length === 0) throw new ValidasiError('Tidak ada kuantitas yang dikirim')

  for (const b of barisDipakai) {
    const baris = sisaLewatId.get(b.soLineId)
    if (!baris) throw new ValidasiError('Baris pesanan tidak ditemukan')
    if (Number(b.kuantitas) > Number(baris.sisaDikirim)) {
      throw new ValidasiError(
        `Pengiriman ${baris.namaProduk} sebanyak ${Number(b.kuantitas)} melebihi sisa pesanan ` +
        `${Number(baris.sisaDikirim)} ${baris.namaUom}.`,
      )
    }
  }

  const [lokasiPelanggan] = await db.select().from(locations)
    .where(and(eq(locations.tipe, 'pelanggan'), eq(locations.isActive, true))).limit(1)
  if (!lokasiPelanggan) {
    throw new ValidasiError('Lokasi virtual Pelanggan belum tersedia. Jalankan seed data awal.')
  }

  const operasi = await buatOperasi({
    tipe: 'pengiriman',
    tanggal: masukan.tanggal,
    lokasiAsalId: pesanan.lokasiAsalId,
    lokasiTujuanId: lokasiPelanggan.id,
    partnerId: pesanan.partnerId,
    referensi: pesanan.nomor,
    catatan: `Pengiriman atas pesanan ${pesanan.nomor}`,
    baris: barisDipakai.map((b) => {
      const baris = sisaLewatId.get(b.soLineId)!
      return {
        produkId: baris.produkId,
        kuantitas: b.kuantitas,
        uomId: baris.uomId,
        // Pengeluaran memakai harga pokok rata-rata, bukan harga jual.
        hargaSatuan: null,
        catatan: null,
      }
    }),
  }, olehPengguna)

  await db.update(stockOperations)
    .set({ sumberTipe: 'penjualan:pesanan', sumberId: masukan.soId })
    .where(eq(stockOperations.id, operasi.id))

  const selesai = await selesaikanOperasi(operasi.id, olehPengguna)

  for (const b of barisDipakai) {
    await db.update(salesOrderLines)
      .set({ kuantitasDikirim: sql`${salesOrderLines.kuantitasDikirim} + ${b.kuantitas}` })
      .where(eq(salesOrderLines.id, b.soLineId))
  }

  await perbaruiStatusPenyelesaian(masukan.soId)

  return { operasiId: selesai.id, nomor: selesai.nomor }
}

export type PengirimanPesanan = {
  operasiId: string
  nomor: string | null
  tanggal: string
  status: string
}

export async function pengirimanPesanan(soId: string): Promise<PengirimanPesanan[]> {
  return db
    .select({
      operasiId: stockOperations.id,
      nomor: stockOperations.nomor,
      tanggal: stockOperations.tanggal,
      status: stockOperations.status,
    })
    .from(stockOperations)
    .where(and(
      eq(stockOperations.sumberTipe, 'penjualan:pesanan'),
      eq(stockOperations.sumberId, soId),
    ))
    .orderBy(stockOperations.tanggal)
}
