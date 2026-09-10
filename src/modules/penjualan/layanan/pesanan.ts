import {
  and, asc, desc, eq, ilike, inArray, or, sql,
} from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  salesOrders, salesOrderLines, taxes, products, uoms, locations, partners,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import type { ParameterDaftar, HasilDaftar } from '@/lib/daftar'
import { ambilNomorBerikut } from '@/modules/akuntansi/layanan/urutan'
import {
  hitungTotal, sisaKuantitas, type BarisHitung, type HasilTotal,
} from '@/modules/akuntansi/layanan/hitung-dokumen'
import { skemaPesanan, type MasukanPesanan } from '../validasi/pesanan'

export type Pesanan = typeof salesOrders.$inferSelect
export type BarisPesanan = typeof salesOrderLines.$inferSelect
export type PesananLengkap = Pesanan & { baris: BarisPesanan[] }

const KODE_URUTAN = 'penjualan:pesanan'

function urai(masukan: MasukanPesanan) {
  const hasil = skemaPesanan.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

// ── Pembacaan ────────────────────────────────────────────────────────────────

function kolomUrutPesanan(kolom?: string) {
  switch (kolom) {
    case 'nomor': return salesOrders.nomor
    case 'status': return salesOrders.status
    case 'dibuatPada': return salesOrders.dibuatPada
    case 'tanggal':
    default:
      return salesOrders.tanggal
  }
}

export async function daftarPesanan(
  param: ParameterDaftar & { status?: Pesanan['status'] },
): Promise<HasilDaftar<Pesanan>> {
  const halaman = param.halaman || 1
  const ukuranHalaman = param.ukuranHalaman || 20

  const kondisi = []
  if (param.cari) {
    kondisi.push(or(
      ilike(salesOrders.nomor, `%${param.cari}%`),
      ilike(partners.nama, `%${param.cari}%`),
    ))
  }

  const statusDisaring = [
    ...(param.status ? [param.status] : []),
    ...(param.filter?.status ?? []),
  ] as Pesanan['status'][]
  if (statusDisaring.length > 0) {
    kondisi.push(inArray(salesOrders.status, statusDisaring))
  }

  const where = kondisi.length > 0 ? and(...kondisi) : undefined
  const kolomUrut = kolomUrutPesanan(param.urutkan?.kolom)
  const arahUrut = param.urutkan?.arah === 'asc' ? asc : desc

  const baris = await db.select({ pesanan: salesOrders }).from(salesOrders)
    .innerJoin(partners, eq(partners.id, salesOrders.partnerId))
    .where(where)
    .orderBy(arahUrut(kolomUrut), desc(salesOrders.dibuatPada))
    .limit(ukuranHalaman)
    .offset((halaman - 1) * ukuranHalaman)

  const [{ jumlah }] = await db.select({ jumlah: sql<number>`count(*)::int` }).from(salesOrders)
    .innerJoin(partners, eq(partners.id, salesOrders.partnerId))
    .where(where)

  return { data: baris.map((b) => b.pesanan), totalBaris: jumlah }
}

export async function ambilPesanan(id: string): Promise<PesananLengkap | null> {
  const [pesanan] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1)
  if (!pesanan) return null
  const baris = await db.select().from(salesOrderLines)
    .where(eq(salesOrderLines.soId, id))
    .orderBy(asc(salesOrderLines.urutan))
  return { ...pesanan, baris }
}

export async function hitungTotalDariBaris(
  baris: { kuantitas: string; hargaSatuan: string; taxId: string | null }[],
): Promise<HasilTotal> {
  const daftarPajak = await db.select().from(taxes)
  const pajakLewatId = new Map(daftarPajak.map((p) => [p.id, p]))

  const masukan: BarisHitung[] = baris.map((b) => {
    const p = b.taxId ? pajakLewatId.get(b.taxId) : undefined
    return {
      kuantitas: b.kuantitas,
      hargaSatuan: b.hargaSatuan,
      pajak: p
        ? { tarif: p.tarif, hargaTermasukPajak: p.hargaTermasukPajak, isPemotongan: p.isPemotongan }
        : null,
    }
  })
  return hitungTotal(masukan)
}

export async function totalPesanan(id: string): Promise<HasilTotal> {
  const pesanan = await ambilPesanan(id)
  if (!pesanan) throw new ValidasiError('Pesanan tidak ditemukan')
  return hitungTotalDariBaris(pesanan.baris)
}

// ── Penulisan ────────────────────────────────────────────────────────────────

async function wajibLokasiInternal(lokasiId: string): Promise<void> {
  const [lokasi] = await db.select().from(locations).where(eq(locations.id, lokasiId)).limit(1)
  if (!lokasi) throw new ValidasiError('Gudang asal tidak ditemukan')
  if (lokasi.tipe !== 'internal') {
    throw new ValidasiError('Gudang asal pengiriman harus lokasi internal')
  }
}

/**
 * Membuat penawaran. Penawaran dan pesanan penjualan adalah dokumen yang sama
 * pada tahap berbeda; mengonfirmasinya yang memberi nomor dan menjadikannya
 * komitmen kepada pelanggan.
 */
export async function buatPesanan(
  masukan: MasukanPesanan, dibuatOleh: string,
): Promise<PesananLengkap> {
  const data = urai(masukan)
  await wajibLokasiInternal(data.lokasiAsalId)

  const id = await db.transaction(async (tx) => {
    const [pesanan] = await tx.insert(salesOrders).values({
      status: 'penawaran',
      partnerId: data.partnerId,
      tanggal: data.tanggal,
      tanggalPengiriman: data.tanggalPengiriman,
      lokasiAsalId: data.lokasiAsalId,
      syaratPembayaranId: data.syaratPembayaranId,
      mataUangId: data.mataUangId,
      referensi: data.referensi,
      catatan: data.catatan,
      dibuatOleh,
    }).returning({ id: salesOrders.id })

    await tx.insert(salesOrderLines).values(
      data.baris.map((b, i) => ({
        soId: pesanan.id,
        urutan: i + 1,
        produkId: b.produkId,
        deskripsi: b.deskripsi,
        kuantitas: b.kuantitas,
        uomId: b.uomId,
        hargaSatuan: b.hargaSatuan,
        taxId: b.taxId,
      })),
    )

    return pesanan.id
  })

  return (await ambilPesanan(id))!
}

export async function ubahPesanan(id: string, masukan: MasukanPesanan): Promise<PesananLengkap> {
  const data = urai(masukan)
  const lama = await ambilPesanan(id)
  if (!lama) throw new ValidasiError('Pesanan tidak ditemukan')
  if (lama.status !== 'penawaran') {
    throw new ValidasiError(
      'Pesanan yang sudah dikonfirmasi tidak dapat diubah. Batalkan terlebih dahulu bila perlu.',
    )
  }
  await wajibLokasiInternal(data.lokasiAsalId)

  await db.transaction(async (tx) => {
    await tx.update(salesOrders).set({
      partnerId: data.partnerId,
      tanggal: data.tanggal,
      tanggalPengiriman: data.tanggalPengiriman,
      lokasiAsalId: data.lokasiAsalId,
      syaratPembayaranId: data.syaratPembayaranId,
      mataUangId: data.mataUangId,
      referensi: data.referensi,
      catatan: data.catatan,
      diubahPada: new Date(),
    }).where(eq(salesOrders.id, id))

    await tx.delete(salesOrderLines).where(eq(salesOrderLines.soId, id))
    await tx.insert(salesOrderLines).values(
      data.baris.map((b, i) => ({
        soId: id,
        urutan: i + 1,
        produkId: b.produkId,
        deskripsi: b.deskripsi,
        kuantitas: b.kuantitas,
        uomId: b.uomId,
        hargaSatuan: b.hargaSatuan,
        taxId: b.taxId,
      })),
    )
  })

  return (await ambilPesanan(id))!
}

export async function konfirmasiPesanan(
  id: string, olehPengguna: string,
): Promise<PesananLengkap> {
  await db.transaction(async (tx) => {
    const [pesanan] = await tx.select().from(salesOrders)
      .where(eq(salesOrders.id, id)).for('update').limit(1)

    if (!pesanan) throw new ValidasiError('Pesanan tidak ditemukan')
    if (pesanan.status === 'dikonfirmasi' || pesanan.status === 'selesai') {
      throw new ValidasiError('Pesanan ini sudah dikonfirmasi')
    }
    if (pesanan.status === 'dibatalkan') {
      throw new ValidasiError('Pesanan yang dibatalkan tidak dapat dikonfirmasi')
    }

    const baris = await tx.select().from(salesOrderLines).where(eq(salesOrderLines.soId, id))
    if (baris.length === 0) {
      throw new ValidasiError('Pesanan memerlukan minimal satu baris produk')
    }

    const nomor = await ambilNomorBerikut(
      tx, KODE_URUTAN, new Date(`${pesanan.tanggal}T00:00:00Z`),
    )

    await tx.update(salesOrders).set({
      nomor,
      status: 'dikonfirmasi',
      dikonfirmasiPada: new Date(),
      dikonfirmasiOleh: olehPengguna,
      diubahPada: new Date(),
    }).where(eq(salesOrders.id, id))
  })

  return (await ambilPesanan(id))!
}

export async function batalkanPesanan(id: string): Promise<void> {
  const pesanan = await ambilPesanan(id)
  if (!pesanan) throw new ValidasiError('Pesanan tidak ditemukan')
  if (pesanan.status === 'selesai') {
    throw new ValidasiError('Pesanan yang sudah selesai tidak dapat dibatalkan')
  }
  if (pesanan.baris.some((b) => Number(b.kuantitasDikirim) > 0)) {
    throw new ValidasiError(
      'Pesanan sudah memiliki pengiriman sehingga tidak dapat dibatalkan.',
    )
  }
  await db.update(salesOrders)
    .set({ status: 'dibatalkan', diubahPada: new Date() })
    .where(eq(salesOrders.id, id))
}

export async function hapusPenawaran(id: string): Promise<void> {
  const pesanan = await ambilPesanan(id)
  if (!pesanan) throw new ValidasiError('Pesanan tidak ditemukan')
  if (pesanan.status === 'dikonfirmasi' || pesanan.status === 'selesai') {
    throw new ValidasiError(
      'Pesanan yang sudah dikonfirmasi tidak dapat dihapus karena sudah menjadi komitmen kepada pelanggan.',
    )
  }
  await db.delete(salesOrders).where(eq(salesOrders.id, id))
}

export type SisaBaris = BarisPesanan & {
  sisaDikirim: string
  sisaDifakturkan: string
  namaProduk: string
  namaUom: string
}

/** Baris pesanan beserta sisa yang belum dikirim dan belum difakturkan. */
export async function barisDenganSisa(soId: string): Promise<SisaBaris[]> {
  const baris = await db
    .select({ baris: salesOrderLines, namaProduk: products.nama, namaUom: uoms.nama })
    .from(salesOrderLines)
    .innerJoin(products, eq(products.id, salesOrderLines.produkId))
    .innerJoin(uoms, eq(uoms.id, salesOrderLines.uomId))
    .where(eq(salesOrderLines.soId, soId))
    .orderBy(asc(salesOrderLines.urutan))

  return baris.map((b) => ({
    ...b.baris,
    namaProduk: b.namaProduk,
    namaUom: b.namaUom,
    sisaDikirim: sisaKuantitas(b.baris.kuantitas, b.baris.kuantitasDikirim),
    // Yang boleh difakturkan adalah yang sudah dikirim; menagih barang yang
    // belum keluar gudang akan mencatat pendapatan sebelum ada penyerahan.
    sisaDifakturkan: sisaKuantitas(b.baris.kuantitasDikirim, b.baris.kuantitasDifakturkan),
  }))
}

export async function perbaruiStatusPenyelesaian(soId: string): Promise<void> {
  const baris = await db.select().from(salesOrderLines).where(eq(salesOrderLines.soId, soId))
  if (baris.length === 0) return

  const tuntas = baris.every((b) =>
    Number(b.kuantitasDikirim) >= Number(b.kuantitas) &&
    Number(b.kuantitasDifakturkan) >= Number(b.kuantitas),
  )

  if (tuntas) {
    await db.update(salesOrders)
      .set({ status: 'selesai', diubahPada: new Date() })
      .where(and(eq(salesOrders.id, soId), eq(salesOrders.status, 'dikonfirmasi')))
  }
}
