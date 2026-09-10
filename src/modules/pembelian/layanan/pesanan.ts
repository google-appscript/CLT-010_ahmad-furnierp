import {
  and, asc, desc, eq, ilike, inArray, or, sql,
} from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  purchaseOrders, purchaseOrderLines, taxes, products, uoms, locations, partners,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import type { ParameterDaftar, HasilDaftar } from '@/lib/daftar'
import { ambilNomorBerikut } from '@/modules/akuntansi/layanan/urutan'
import { skemaPesanan, type MasukanPesanan } from '../validasi/pesanan'
import { hitungTotal, sisaKuantitas, type BarisHitung, type HasilTotal } from '@/modules/akuntansi/layanan/hitung-dokumen'

export type Pesanan = typeof purchaseOrders.$inferSelect
export type BarisPesanan = typeof purchaseOrderLines.$inferSelect
export type PesananLengkap = Pesanan & { baris: BarisPesanan[] }

const KODE_URUTAN = 'pembelian:pesanan'

function urai(masukan: MasukanPesanan) {
  const hasil = skemaPesanan.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

// ── Pembacaan ────────────────────────────────────────────────────────────────

function kolomUrutPesanan(kolom?: string) {
  switch (kolom) {
    case 'nomor': return purchaseOrders.nomor
    case 'status': return purchaseOrders.status
    case 'dibuatPada': return purchaseOrders.dibuatPada
    case 'tanggal':
    default:
      return purchaseOrders.tanggal
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
      ilike(purchaseOrders.nomor, `%${param.cari}%`),
      ilike(partners.nama, `%${param.cari}%`),
    ))
  }

  const statusDisaring = [
    ...(param.status ? [param.status] : []),
    ...(param.filter?.status ?? []),
  ] as Pesanan['status'][]
  if (statusDisaring.length > 0) {
    kondisi.push(inArray(purchaseOrders.status, statusDisaring))
  }

  const where = kondisi.length > 0 ? and(...kondisi) : undefined
  const kolomUrut = kolomUrutPesanan(param.urutkan?.kolom)
  const arahUrut = param.urutkan?.arah === 'asc' ? asc : desc

  const baris = await db.select({ pesanan: purchaseOrders }).from(purchaseOrders)
    .innerJoin(partners, eq(partners.id, purchaseOrders.partnerId))
    .where(where)
    .orderBy(arahUrut(kolomUrut), desc(purchaseOrders.dibuatPada))
    .limit(ukuranHalaman)
    .offset((halaman - 1) * ukuranHalaman)

  const [{ jumlah }] = await db.select({ jumlah: sql<number>`count(*)::int` }).from(purchaseOrders)
    .innerJoin(partners, eq(partners.id, purchaseOrders.partnerId))
    .where(where)

  return { data: baris.map((b) => b.pesanan), totalBaris: jumlah }
}

export async function ambilPesanan(id: string): Promise<PesananLengkap | null> {
  const [pesanan] = await db.select().from(purchaseOrders)
    .where(eq(purchaseOrders.id, id)).limit(1)
  if (!pesanan) return null
  const baris = await db.select().from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.poId, id))
    .orderBy(asc(purchaseOrderLines.urutan))
  return { ...pesanan, baris }
}

/** Menghitung total pesanan berikut pajaknya dari baris yang tersimpan. */
export async function totalPesanan(id: string): Promise<HasilTotal> {
  const pesanan = await ambilPesanan(id)
  if (!pesanan) throw new ValidasiError('Pesanan tidak ditemukan')
  return hitungTotalDariBaris(pesanan.baris)
}

export async function hitungTotalDariBaris(
  baris: { kuantitas: string; hargaSatuan: string; taxId: string | null }[],
): Promise<HasilTotal> {
  const idPajak = [...new Set(baris.map((b) => b.taxId).filter((t): t is string => Boolean(t)))]
  const daftarPajak = idPajak.length > 0
    ? await db.select().from(taxes)
    : []
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

// ── Penulisan ────────────────────────────────────────────────────────────────

async function wajibLokasiInternal(lokasiId: string): Promise<void> {
  const [lokasi] = await db.select().from(locations).where(eq(locations.id, lokasiId)).limit(1)
  if (!lokasi) throw new ValidasiError('Lokasi tujuan tidak ditemukan')
  if (lokasi.tipe !== 'internal') {
    throw new ValidasiError('Lokasi tujuan penerimaan harus lokasi internal')
  }
}

/**
 * Membuat permintaan penawaran. Dokumen ini dan pesanan pembelian adalah
 * dokumen yang sama pada tahap berbeda; mengonfirmasinya yang mengubah
 * statusnya dan memberinya nomor.
 */
export async function buatPesanan(
  masukan: MasukanPesanan, dibuatOleh: string,
): Promise<PesananLengkap> {
  const data = urai(masukan)
  await wajibLokasiInternal(data.lokasiTujuanId)

  const id = await db.transaction(async (tx) => {
    const [pesanan] = await tx.insert(purchaseOrders).values({
      status: 'permintaan',
      partnerId: data.partnerId,
      tanggal: data.tanggal,
      tanggalDiharapkan: data.tanggalDiharapkan,
      lokasiTujuanId: data.lokasiTujuanId,
      syaratPembayaranId: data.syaratPembayaranId,
      mataUangId: data.mataUangId,
      referensi: data.referensi,
      catatan: data.catatan,
      dibuatOleh,
    }).returning({ id: purchaseOrders.id })

    await tx.insert(purchaseOrderLines).values(
      data.baris.map((b, i) => ({
        poId: pesanan.id,
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

export async function ubahPesanan(
  id: string, masukan: MasukanPesanan,
): Promise<PesananLengkap> {
  const data = urai(masukan)
  const lama = await ambilPesanan(id)
  if (!lama) throw new ValidasiError('Pesanan tidak ditemukan')
  if (lama.status !== 'permintaan') {
    throw new ValidasiError(
      'Pesanan yang sudah dikonfirmasi tidak dapat diubah. Batalkan terlebih dahulu bila perlu.',
    )
  }
  await wajibLokasiInternal(data.lokasiTujuanId)

  await db.transaction(async (tx) => {
    await tx.update(purchaseOrders).set({
      partnerId: data.partnerId,
      tanggal: data.tanggal,
      tanggalDiharapkan: data.tanggalDiharapkan,
      lokasiTujuanId: data.lokasiTujuanId,
      syaratPembayaranId: data.syaratPembayaranId,
      mataUangId: data.mataUangId,
      referensi: data.referensi,
      catatan: data.catatan,
      diubahPada: new Date(),
    }).where(eq(purchaseOrders.id, id))

    await tx.delete(purchaseOrderLines).where(eq(purchaseOrderLines.poId, id))
    await tx.insert(purchaseOrderLines).values(
      data.baris.map((b, i) => ({
        poId: id,
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

/**
 * Mengonfirmasi permintaan menjadi pesanan pembelian. Nomor diberikan di sini,
 * bukan saat permintaan dibuat, sehingga permintaan yang tidak jadi dipesan
 * tidak meninggalkan lubang nomor.
 */
export async function konfirmasiPesanan(
  id: string, olehPengguna: string,
): Promise<PesananLengkap> {
  await db.transaction(async (tx) => {
    const [pesanan] = await tx.select().from(purchaseOrders)
      .where(eq(purchaseOrders.id, id)).for('update').limit(1)

    if (!pesanan) throw new ValidasiError('Pesanan tidak ditemukan')
    if (pesanan.status === 'dikonfirmasi' || pesanan.status === 'selesai') {
      throw new ValidasiError('Pesanan ini sudah dikonfirmasi')
    }
    if (pesanan.status === 'dibatalkan') {
      throw new ValidasiError('Pesanan yang dibatalkan tidak dapat dikonfirmasi')
    }

    const baris = await tx.select().from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.poId, id))
    if (baris.length === 0) {
      throw new ValidasiError('Pesanan memerlukan minimal satu baris produk')
    }

    const nomor = await ambilNomorBerikut(
      tx, KODE_URUTAN, new Date(`${pesanan.tanggal}T00:00:00Z`),
    )

    await tx.update(purchaseOrders).set({
      nomor,
      status: 'dikonfirmasi',
      dikonfirmasiPada: new Date(),
      dikonfirmasiOleh: olehPengguna,
      diubahPada: new Date(),
    }).where(eq(purchaseOrders.id, id))
  })

  return (await ambilPesanan(id))!
}

export async function batalkanPesanan(id: string): Promise<void> {
  const pesanan = await ambilPesanan(id)
  if (!pesanan) throw new ValidasiError('Pesanan tidak ditemukan')
  if (pesanan.status === 'selesai') {
    throw new ValidasiError('Pesanan yang sudah selesai tidak dapat dibatalkan')
  }
  const sudahDiterima = pesanan.baris.some((b) => Number(b.kuantitasDiterima) > 0)
  if (sudahDiterima) {
    throw new ValidasiError(
      'Pesanan sudah memiliki penerimaan barang sehingga tidak dapat dibatalkan.',
    )
  }
  await db.update(purchaseOrders)
    .set({ status: 'dibatalkan', diubahPada: new Date() })
    .where(eq(purchaseOrders.id, id))
}

export async function hapusPermintaan(id: string): Promise<void> {
  const pesanan = await ambilPesanan(id)
  if (!pesanan) throw new ValidasiError('Pesanan tidak ditemukan')
  if (pesanan.status === 'dikonfirmasi' || pesanan.status === 'selesai') {
    throw new ValidasiError(
      'Pesanan yang sudah dikonfirmasi tidak dapat dihapus karena sudah menjadi komitmen kepada pemasok.',
    )
  }
  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id))
}

export type SisaBaris = BarisPesanan & {
  sisaDiterima: string
  sisaDitagih: string
  namaProduk: string
  namaUom: string
}

/** Baris pesanan beserta sisa yang belum diterima dan belum ditagih. */
export async function barisDenganSisa(poId: string): Promise<SisaBaris[]> {
  const baris = await db
    .select({
      baris: purchaseOrderLines,
      namaProduk: products.nama,
      namaUom: uoms.nama,
    })
    .from(purchaseOrderLines)
    .innerJoin(products, eq(products.id, purchaseOrderLines.produkId))
    .innerJoin(uoms, eq(uoms.id, purchaseOrderLines.uomId))
    .where(eq(purchaseOrderLines.poId, poId))
    .orderBy(asc(purchaseOrderLines.urutan))

  return baris.map((b) => ({
    ...b.baris,
    namaProduk: b.namaProduk,
    namaUom: b.namaUom,
    sisaDiterima: sisaKuantitas(b.baris.kuantitas, b.baris.kuantitasDiterima),
    sisaDitagih: sisaKuantitas(b.baris.kuantitasDiterima, b.baris.kuantitasDitagih),
  }))
}

/**
 * Menandai pesanan selesai bila seluruh barisnya sudah diterima dan ditagih
 * sepenuhnya. Dipanggil setelah penerimaan atau tagihan diselesaikan.
 */
export async function perbaruiStatusPenyelesaian(poId: string): Promise<void> {
  const baris = await db.select().from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.poId, poId))
  if (baris.length === 0) return

  const tuntas = baris.every((b) =>
    Number(b.kuantitasDiterima) >= Number(b.kuantitas) &&
    Number(b.kuantitasDitagih) >= Number(b.kuantitas),
  )

  if (tuntas) {
    await db.update(purchaseOrders)
      .set({ status: 'selesai', diubahPada: new Date() })
      .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.status, 'dikonfirmasi')))
  }
}

export { hitungTotal, sisaKuantitas }
