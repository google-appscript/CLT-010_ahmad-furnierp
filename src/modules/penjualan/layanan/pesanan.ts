import {
  and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql,
} from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  salesOrders, salesOrderLines, taxes, products, uoms, partners,
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
  param: ParameterDaftar & {
    status?: Pesanan['status']
    /**
     * Cakupan status yang boleh muncul di layar ini — dipakai memisahkan
     * daftar Penawaran dari daftar Pesanan Penjualan. Berbeda dari
     * `filter.status` yang dipilih pengguna, cakupan ini selalu berlaku dan
     * mempersempit hasilnya, bukan menambah.
     */
    statusTermasuk?: Pesanan['status'][]
    /**
     * Memisahkan penawaran dari pesanan secara struktural: nomor baru terbit
     * saat dikonfirmasi, jadi dokumen tanpa nomor selalu penawaran. Ini yang
     * membedakan penawaran ditolak dari pesanan dibatalkan — keduanya
     * berstatus `dibatalkan`, tetapi hanya pesanan yang pernah bernomor.
     */
    bernomor?: boolean
    /**
     * Menyaring dokumen yang pernah menjadi penawaran. Dipakai daftar Penawaran
     * supaya penawaran yang sudah dikonfirmasi tetap tercatat di sana — riwayat
     * penawarannya hilang bila dokumennya pindah daftar begitu berlanjut.
     */
    lewatPenawaran?: boolean
  },
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

  if (param.statusTermasuk && param.statusTermasuk.length > 0) {
    kondisi.push(inArray(salesOrders.status, param.statusTermasuk))
  }

  if (param.bernomor !== undefined) {
    kondisi.push(param.bernomor ? isNotNull(salesOrders.nomor) : isNull(salesOrders.nomor))
  }

  if (param.lewatPenawaran !== undefined) {
    kondisi.push(eq(salesOrders.lewatPenawaran, param.lewatPenawaran))
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

/**
 * Membuat penawaran. Penawaran dan pesanan penjualan adalah dokumen yang sama
 * pada tahap berbeda; mengonfirmasinya yang memberi nomor dan menjadikannya
 * komitmen kepada pelanggan.
 */
export async function buatPesanan(
  masukan: MasukanPesanan, dibuatOleh: string,
): Promise<PesananLengkap> {
  const data = urai(masukan)

  const id = await db.transaction(async (tx) => {
    const [pesanan] = await tx.insert(salesOrders).values({
      status: 'penawaran',
      partnerId: data.partnerId,
      tanggal: data.tanggal,
      tanggalPengiriman: data.tanggalPengiriman,
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

/**
 * Membuat pesanan penjualan tanpa melewati tahap penawaran, untuk pesanan yang
 * memang sudah pasti sejak awal. Pembuatan dan konfirmasinya terjadi dalam satu
 * transaksi supaya tidak pernah ada pesanan tanpa nomor bila salah satu gagal —
 * nomornya tetap diambil lewat `ambilNomorBerikut()` seperti jalur penawaran.
 */
export async function buatPesananLangsung(
  masukan: MasukanPesanan, dibuatOleh: string,
): Promise<PesananLengkap> {
  const data = urai(masukan)

  const id = await db.transaction(async (tx) => {
    const nomor = await ambilNomorBerikut(
      tx, KODE_URUTAN, new Date(`${data.tanggal}T00:00:00Z`),
    )

    const [pesanan] = await tx.insert(salesOrders).values({
      nomor,
      status: 'dikonfirmasi',
      lewatPenawaran: false,
      partnerId: data.partnerId,
      tanggal: data.tanggal,
      tanggalPengiriman: data.tanggalPengiriman,
      syaratPembayaranId: data.syaratPembayaranId,
      mataUangId: data.mataUangId,
      referensi: data.referensi,
      catatan: data.catatan,
      dikonfirmasiPada: new Date(),
      dikonfirmasiOleh: dibuatOleh,
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

  await db.transaction(async (tx) => {
    await tx.update(salesOrders).set({
      partnerId: data.partnerId,
      tanggal: data.tanggal,
      tanggalPengiriman: data.tanggalPengiriman,
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
    // Yang boleh difakturkan adalah seluruh isi pesanan, bukan hanya yang
    // sudah keluar gudang. Pekerjaan pesanan berjalan berbulan-bulan dan uang
    // mukanya ditagih di awal; menunggu pengiriman berarti tidak pernah bisa
    // menerbitkan tagihan yang menjadi dasar pembayaran pertama.
    sisaDifakturkan: sisaKuantitas(b.baris.kuantitas, b.baris.kuantitasDifakturkan),
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

/**
 * Menggandakan dokumen menjadi penawaran baru. Hasilnya selalu penawaran tanpa
 * nomor, apa pun status asalnya — menggandakan pesanan yang sudah dikirim tidak
 * boleh ikut menyalin pengiriman maupun fakturnya, karena yang digandakan
 * adalah maksud pesanannya, bukan riwayat pelaksanaannya.
 */
export async function duplikatPesanan(
  id: string, dibuatOleh: string, tanggal: string,
): Promise<PesananLengkap> {
  const lama = await ambilPesanan(id)
  if (!lama) throw new ValidasiError('Pesanan tidak ditemukan')

  return buatPesanan({
    partnerId: lama.partnerId,
    tanggal,
    tanggalPengiriman: null,
    syaratPembayaranId: lama.syaratPembayaranId,
    mataUangId: lama.mataUangId,
    referensi: lama.referensi,
    catatan: lama.catatan,
    baris: lama.baris.map((b) => ({
      produkId: b.produkId,
      deskripsi: b.deskripsi,
      kuantitas: String(Number(b.kuantitas)),
      uomId: b.uomId,
      hargaSatuan: String(Number(b.hargaSatuan)),
      taxId: b.taxId,
    })),
  }, dibuatOleh)
}
