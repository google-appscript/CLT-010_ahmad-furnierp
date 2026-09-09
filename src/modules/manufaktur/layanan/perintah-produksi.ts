import { and, asc, desc, eq } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import {
  workOrders, workOrderLines, billOfMaterials, products, uoms, locations,
  stockOperations, companySettings, journals, accounts,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bagi, bulatkan, kurang, tambah, type Uang } from '@/lib/uang'
import { ambilNomorBerikut } from '@/modules/akuntansi/layanan/urutan'
import { postingJurnalDalamTx } from '@/modules/akuntansi/layanan/entri'
import {
  buatOperasiDalamTx, selesaikanOperasiDalamTx, nilaiOperasiDalamTx,
} from '@/modules/gudang/layanan/operasi'
import { konversiSatuan, DESIMAL_HARGA, DESIMAL_NILAI } from '@/modules/gudang/layanan/valuasi'
import { skemaPerintahProduksi, type MasukanPerintahProduksi } from '../validasi/produksi'

export type PerintahProduksi = typeof workOrders.$inferSelect
export type BarisPerintahProduksi = typeof workOrderLines.$inferSelect
export type PerintahProduksiLengkap = PerintahProduksi & { baris: BarisPerintahProduksi[] }

const KODE_URUTAN = 'manufaktur:perintah-produksi'
const KODE_JURNAL_BIAYA = 'JU'
/** Akun beban yang diserap ke harga pokok saat biaya konversi dibebankan. */
const AKUN_TENAGA_KERJA = '5102'
const AKUN_OVERHEAD = '5103'

function urai(masukan: MasukanPerintahProduksi) {
  const hasil = skemaPerintahProduksi.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

// ── Pembacaan ────────────────────────────────────────────────────────────────

export async function daftarPerintahProduksi(
  saring: { status?: PerintahProduksi['status'] } = {},
): Promise<PerintahProduksi[]> {
  const kueri = db.select().from(workOrders)
    .orderBy(desc(workOrders.tanggal), desc(workOrders.dibuatPada))
  return saring.status ? kueri.where(eq(workOrders.status, saring.status)) : kueri
}

export async function ambilPerintahProduksi(id: string): Promise<PerintahProduksiLengkap | null> {
  const [perintah] = await db.select().from(workOrders)
    .where(eq(workOrders.id, id)).limit(1)
  if (!perintah) return null
  const baris = await db.select().from(workOrderLines)
    .where(eq(workOrderLines.woId, id))
    .orderBy(asc(workOrderLines.urutan))
  return { ...perintah, baris }
}

export type BiayaProduksi = {
  bahan: Uang
  tenagaKerja: Uang
  overhead: Uang
  total: Uang
  hargaPokokSatuan: Uang | null
}

/**
 * Rincian biaya sebuah perintah produksi. Nilai bahan baru terisi setelah
 * konsumsi dibukukan, karena harga pokok rata-rata baru diketahui saat
 * bahannya benar-benar keluar gudang.
 */
export async function biayaProduksi(id: string): Promise<BiayaProduksi> {
  const perintah = await ambilPerintahProduksi(id)
  if (!perintah) throw new ValidasiError('Perintah produksi tidak ditemukan')

  const bahan = perintah.operasiKonsumsiId
    ? await db.transaction((tx) => nilaiOperasiDalamTx(tx, perintah.operasiKonsumsiId!))
    : '0.00'

  const total = bulatkan(
    tambah(bahan, perintah.biayaTenagaKerja, perintah.biayaOverhead), DESIMAL_NILAI,
  )

  return {
    bahan: bulatkan(bahan, DESIMAL_NILAI),
    tenagaKerja: bulatkan(perintah.biayaTenagaKerja, DESIMAL_NILAI),
    overhead: bulatkan(perintah.biayaOverhead, DESIMAL_NILAI),
    total,
    hargaPokokSatuan: perintah.hargaPokokSatuan,
  }
}

// ── Penulisan ────────────────────────────────────────────────────────────────

async function wajibLokasiInternal(
  tx: Transaksi, lokasiId: string, label: string,
): Promise<void> {
  const [lokasi] = await tx.select().from(locations).where(eq(locations.id, lokasiId)).limit(1)
  if (!lokasi) throw new ValidasiError(`${label} tidak ditemukan`)
  if (lokasi.tipe !== 'internal') {
    throw new ValidasiError(`${label} harus lokasi internal`)
  }
}

async function wajibProdukDisimpan(tx: Transaksi, produkId: string): Promise<void> {
  const [produk] = await tx.select().from(products)
    .where(eq(products.id, produkId)).limit(1)
  if (!produk) throw new ValidasiError('Produk tidak ditemukan')
  if (produk.tipe !== 'disimpan') {
    throw new ValidasiError(
      `${produk.nama} bertipe ${produk.tipe} sehingga tidak dapat diproduksi maupun dikonsumsi`,
    )
  }
}

export async function buatPerintahProduksi(
  masukan: MasukanPerintahProduksi, dibuatOleh: string,
): Promise<PerintahProduksiLengkap> {
  const data = urai(masukan)

  const id = await db.transaction(async (tx) => {
    await wajibLokasiInternal(tx, data.lokasiSumberId, 'Gudang bahan')
    await wajibLokasiInternal(tx, data.lokasiTujuanId, 'Gudang barang jadi')
    await wajibProdukDisimpan(tx, data.produkId)

    if (data.baris.some((b) => b.produkId === data.produkId)) {
      throw new ValidasiError('Produk yang diproduksi tidak boleh menjadi bahannya sendiri')
    }
    for (const b of data.baris) await wajibProdukDisimpan(tx, b.produkId)

    if (data.bomId) {
      const [bom] = await tx.select().from(billOfMaterials)
        .where(eq(billOfMaterials.id, data.bomId)).limit(1)
      if (!bom) throw new ValidasiError('Resep tidak ditemukan')
      if (bom.produkId !== data.produkId) {
        throw new ValidasiError('Resep yang dipilih bukan resep untuk produk ini')
      }
    }

    const [perintah] = await tx.insert(workOrders).values({
      status: 'draft',
      produkId: data.produkId,
      bomId: data.bomId,
      kuantitas: data.kuantitas,
      uomId: data.uomId,
      tanggal: data.tanggal,
      tanggalTarget: data.tanggalTarget,
      lokasiSumberId: data.lokasiSumberId,
      lokasiTujuanId: data.lokasiTujuanId,
      biayaTenagaKerja: data.biayaTenagaKerja,
      biayaOverhead: data.biayaOverhead,
      referensi: data.referensi,
      catatan: data.catatan,
      dibuatOleh,
    }).returning({ id: workOrders.id })

    await tx.insert(workOrderLines).values(
      data.baris.map((b, i) => ({
        woId: perintah.id,
        urutan: i + 1,
        produkId: b.produkId,
        kuantitas: b.kuantitas,
        uomId: b.uomId,
        catatan: b.catatan,
      })),
    )

    return perintah.id
  })

  return (await ambilPerintahProduksi(id))!
}

export async function ubahPerintahProduksi(
  id: string, masukan: MasukanPerintahProduksi,
): Promise<PerintahProduksiLengkap> {
  const data = urai(masukan)
  const lama = await ambilPerintahProduksi(id)
  if (!lama) throw new ValidasiError('Perintah produksi tidak ditemukan')
  if (lama.status !== 'draft') {
    throw new ValidasiError(
      'Perintah produksi yang sudah dikonfirmasi tidak dapat diubah. Batalkan terlebih dahulu bila perlu.',
    )
  }

  await db.transaction(async (tx) => {
    await wajibLokasiInternal(tx, data.lokasiSumberId, 'Gudang bahan')
    await wajibLokasiInternal(tx, data.lokasiTujuanId, 'Gudang barang jadi')
    await wajibProdukDisimpan(tx, data.produkId)

    if (data.baris.some((b) => b.produkId === data.produkId)) {
      throw new ValidasiError('Produk yang diproduksi tidak boleh menjadi bahannya sendiri')
    }
    for (const b of data.baris) await wajibProdukDisimpan(tx, b.produkId)

    await tx.update(workOrders).set({
      produkId: data.produkId,
      bomId: data.bomId,
      kuantitas: data.kuantitas,
      uomId: data.uomId,
      tanggal: data.tanggal,
      tanggalTarget: data.tanggalTarget,
      lokasiSumberId: data.lokasiSumberId,
      lokasiTujuanId: data.lokasiTujuanId,
      biayaTenagaKerja: data.biayaTenagaKerja,
      biayaOverhead: data.biayaOverhead,
      referensi: data.referensi,
      catatan: data.catatan,
      diubahPada: new Date(),
    }).where(eq(workOrders.id, id))

    await tx.delete(workOrderLines).where(eq(workOrderLines.woId, id))
    await tx.insert(workOrderLines).values(
      data.baris.map((b, i) => ({
        woId: id,
        urutan: i + 1,
        produkId: b.produkId,
        kuantitas: b.kuantitas,
        uomId: b.uomId,
        catatan: b.catatan,
      })),
    )
  })

  return (await ambilPerintahProduksi(id))!
}

/**
 * Mengonfirmasi perintah produksi: memberi nomor dan mengunci kebutuhan bahan.
 * Stok belum tersentuh — itu terjadi saat perintahnya diselesaikan.
 */
export async function konfirmasiPerintahProduksi(
  id: string, olehPengguna: string,
): Promise<PerintahProduksiLengkap> {
  await db.transaction(async (tx) => {
    const [perintah] = await tx.select().from(workOrders)
      .where(eq(workOrders.id, id)).for('update').limit(1)

    if (!perintah) throw new ValidasiError('Perintah produksi tidak ditemukan')
    if (perintah.status === 'dikonfirmasi' || perintah.status === 'selesai') {
      throw new ValidasiError('Perintah produksi ini sudah dikonfirmasi')
    }
    if (perintah.status === 'dibatalkan') {
      throw new ValidasiError('Perintah produksi yang dibatalkan tidak dapat dikonfirmasi')
    }

    const baris = await tx.select().from(workOrderLines).where(eq(workOrderLines.woId, id))
    if (baris.length === 0) {
      throw new ValidasiError('Perintah produksi memerlukan minimal satu bahan')
    }

    const nomor = await ambilNomorBerikut(
      tx, KODE_URUTAN, new Date(`${perintah.tanggal}T00:00:00Z`),
    )

    await tx.update(workOrders).set({
      nomor,
      status: 'dikonfirmasi',
      dikonfirmasiPada: new Date(),
      dikonfirmasiOleh: olehPengguna,
      diubahPada: new Date(),
    }).where(eq(workOrders.id, id))
  })

  return (await ambilPerintahProduksi(id))!
}

async function akunLewatKode(tx: Transaksi, kode: string): Promise<string> {
  const [akun] = await tx.select().from(accounts).where(eq(accounts.kode, kode)).limit(1)
  if (!akun) {
    throw new ValidasiError(`Akun ${kode} tidak ditemukan. Jalankan seed data awal.`)
  }
  return akun.id
}

/**
 * Menyelesaikan perintah produksi dalam satu transaksi:
 *
 *   1. bahan keluar gudang menuju lokasi virtual Produksi — mendebit Barang
 *      Dalam Proses sebesar harga pokok rata-rata bahannya;
 *   2. biaya tenaga kerja dan overhead diserap — mendebit Barang Dalam Proses
 *      dan mengkredit akun bebannya, sehingga biaya yang sudah dicatat saat
 *      terjadi tidak dihitung dua kali ketika barangnya nanti terjual;
 *   3. barang jadi masuk gudang dari lokasi virtual Produksi senilai seluruh
 *      biaya itu, mengosongkan kembali Barang Dalam Proses.
 *
 * Ketiganya harus segabung: konsumsi tanpa hasilnya akan meninggalkan saldo
 * Barang Dalam Proses yang tidak pernah tertutup, dan hasil tanpa konsumsinya
 * akan menciptakan persediaan dari ketiadaan.
 */
export async function selesaikanPerintahProduksi(
  id: string, olehPengguna: string,
): Promise<PerintahProduksiLengkap> {
  await db.transaction(async (tx) => {
    const [perintah] = await tx.select().from(workOrders)
      .where(eq(workOrders.id, id)).for('update').limit(1)

    if (!perintah) throw new ValidasiError('Perintah produksi tidak ditemukan')
    if (perintah.status === 'selesai') {
      throw new ValidasiError('Perintah produksi ini sudah selesai')
    }
    if (perintah.status !== 'dikonfirmasi') {
      throw new ValidasiError(
        'Hanya perintah produksi yang sudah dikonfirmasi yang dapat diselesaikan',
      )
    }

    const baris = await tx.select().from(workOrderLines)
      .where(eq(workOrderLines.woId, id))
      .orderBy(asc(workOrderLines.urutan))
    if (baris.length === 0) {
      throw new ValidasiError('Perintah produksi memerlukan minimal satu bahan')
    }

    const [lokasiProduksi] = await tx.select().from(locations)
      .where(and(eq(locations.tipe, 'produksi'), eq(locations.isActive, true))).limit(1)
    if (!lokasiProduksi) {
      throw new ValidasiError('Lokasi virtual Produksi belum tersedia. Jalankan seed data awal.')
    }

    // 1. Konsumsi bahan.
    const konsumsiId = await buatOperasiDalamTx(tx, {
      tipe: 'konsumsi_produksi',
      tanggal: perintah.tanggal,
      lokasiAsalId: perintah.lokasiSumberId,
      lokasiTujuanId: lokasiProduksi.id,
      partnerId: null,
      referensi: perintah.nomor,
      catatan: `Konsumsi bahan perintah produksi ${perintah.nomor}`,
      baris: baris.map((b) => ({
        produkId: b.produkId,
        kuantitas: b.kuantitas,
        uomId: b.uomId,
        hargaSatuan: null,
        catatan: null,
      })),
    }, olehPengguna)

    await tx.update(stockOperations)
      .set({ sumberTipe: 'manufaktur:perintah-produksi', sumberId: id })
      .where(eq(stockOperations.id, konsumsiId))

    await selesaikanOperasiDalamTx(tx, konsumsiId, olehPengguna)
    const nilaiBahan = await nilaiOperasiDalamTx(tx, konsumsiId)

    // 2. Penyerapan biaya konversi.
    const [pengaturan] = await tx.select().from(companySettings).limit(1)
    if (!pengaturan?.akunBarangDalamProsesId) {
      throw new ValidasiError('Akun Barang Dalam Proses belum diatur pada Profil Perusahaan')
    }
    const akunBdp = pengaturan.akunBarangDalamProsesId

    const biayaKonversi = bulatkan(
      tambah(perintah.biayaTenagaKerja, perintah.biayaOverhead), DESIMAL_NILAI,
    )
    let jurnalBiayaId: string | null = null

    if (Number(biayaKonversi) > 0) {
      const [jurnal] = await tx.select().from(journals)
        .where(eq(journals.kode, KODE_JURNAL_BIAYA)).limit(1)
      if (!jurnal) {
        throw new ValidasiError(
          `Jurnal ${KODE_JURNAL_BIAYA} tidak ditemukan. Jalankan seed data awal.`,
        )
      }

      const item = [
        {
          accountId: akunBdp, partnerId: null,
          label: `Penyerapan biaya konversi ${perintah.nomor}`,
          debit: biayaKonversi, kredit: '0',
          nilaiMataUang: null, taxId: null, projectId: null,
        },
      ]
      if (Number(perintah.biayaTenagaKerja) > 0) {
        item.push({
          accountId: await akunLewatKode(tx, AKUN_TENAGA_KERJA), partnerId: null,
          label: `Tenaga kerja langsung ${perintah.nomor}`,
          debit: '0', kredit: bulatkan(perintah.biayaTenagaKerja, DESIMAL_NILAI),
          nilaiMataUang: null, taxId: null, projectId: null,
        })
      }
      if (Number(perintah.biayaOverhead) > 0) {
        item.push({
          accountId: await akunLewatKode(tx, AKUN_OVERHEAD), partnerId: null,
          label: `Overhead pabrik ${perintah.nomor}`,
          debit: '0', kredit: bulatkan(perintah.biayaOverhead, DESIMAL_NILAI),
          nilaiMataUang: null, taxId: null, projectId: null,
        })
      }

      const hasil = await postingJurnalDalamTx(tx, {
        journalId: jurnal.id,
        tanggal: perintah.tanggal,
        referensi: perintah.nomor,
        keterangan: `Biaya konversi perintah produksi ${perintah.nomor}`,
        mataUangId: 'IDR',
        partnerId: null,
        sumberTipe: 'manufaktur:perintah-produksi',
        sumberId: id,
        item,
      }, olehPengguna)
      jurnalBiayaId = hasil.id
    }

    // 3. Hasil produksi, dinilai sebesar seluruh biaya yang terserap.
    const totalBiaya = bulatkan(tambah(nilaiBahan, biayaKonversi), DESIMAL_NILAI)

    const [produk] = await tx.select().from(products)
      .where(eq(products.id, perintah.produkId)).limit(1)
    const [satuanPerintah] = await tx.select().from(uoms)
      .where(eq(uoms.id, perintah.uomId)).limit(1)
    const [satuanProduk] = await tx.select().from(uoms)
      .where(eq(uoms.id, produk!.uomId)).limit(1)
    if (!satuanPerintah || !satuanProduk) throw new ValidasiError('Satuan tidak ditemukan')

    const kuantitasDasar = konversiSatuan(
      perintah.kuantitas, satuanPerintah.faktor, satuanProduk.faktor,
    )
    const hargaPokokSatuan = bulatkan(bagi(totalBiaya, kuantitasDasar), DESIMAL_HARGA)

    const hasilId = await buatOperasiDalamTx(tx, {
      tipe: 'hasil_produksi',
      tanggal: perintah.tanggal,
      lokasiAsalId: lokasiProduksi.id,
      lokasiTujuanId: perintah.lokasiTujuanId,
      partnerId: null,
      referensi: perintah.nomor,
      catatan: `Hasil produksi perintah produksi ${perintah.nomor}`,
      baris: [{
        produkId: perintah.produkId,
        kuantitas: perintah.kuantitas,
        uomId: perintah.uomId,
        hargaSatuan: hargaPokokSatuan,
        catatan: null,
      }],
    }, olehPengguna)

    await tx.update(stockOperations)
      .set({ sumberTipe: 'manufaktur:perintah-produksi', sumberId: id })
      .where(eq(stockOperations.id, hasilId))

    await selesaikanOperasiDalamTx(tx, hasilId, olehPengguna)
    const nilaiHasil = await nilaiOperasiDalamTx(tx, hasilId)

    // Harga pokok satuan dibulatkan ke enam desimal, sehingga nilai hasil
    // dapat meleset beberapa sen dari total biaya. Sisa itu ditutup agar
    // Barang Dalam Proses benar-benar kembali nol.
    const selisih = bulatkan(kurang(totalBiaya, nilaiHasil), DESIMAL_NILAI)
    if (Number(selisih) !== 0) {
      if (!pengaturan.akunPembulatanId) {
        throw new ValidasiError('Akun Selisih Pembulatan belum diatur pada Profil Perusahaan')
      }
      const [jurnal] = await tx.select().from(journals)
        .where(eq(journals.kode, KODE_JURNAL_BIAYA)).limit(1)
      const positif = Number(selisih) > 0
      const nilai = bulatkan(positif ? selisih : String(-Number(selisih)), DESIMAL_NILAI)

      await postingJurnalDalamTx(tx, {
        journalId: jurnal!.id,
        tanggal: perintah.tanggal,
        referensi: perintah.nomor,
        keterangan: `Pembulatan harga pokok produksi ${perintah.nomor}`,
        mataUangId: 'IDR',
        partnerId: null,
        sumberTipe: 'manufaktur:perintah-produksi',
        sumberId: id,
        item: [
          {
            accountId: akunBdp, partnerId: null,
            label: 'Pembulatan harga pokok produksi',
            debit: positif ? '0' : nilai, kredit: positif ? nilai : '0',
            nilaiMataUang: null, taxId: null, projectId: null,
          },
          {
            accountId: pengaturan.akunPembulatanId, partnerId: null,
            label: 'Pembulatan harga pokok produksi',
            debit: positif ? nilai : '0', kredit: positif ? '0' : nilai,
            nilaiMataUang: null, taxId: null, projectId: null,
          },
        ],
      }, olehPengguna)
    }

    for (const b of baris) {
      await tx.update(workOrderLines)
        .set({ kuantitasDikonsumsi: b.kuantitas })
        .where(eq(workOrderLines.id, b.id))
    }

    await tx.update(workOrders).set({
      status: 'selesai',
      operasiKonsumsiId: konsumsiId,
      operasiHasilId: hasilId,
      jurnalBiayaId,
      hargaPokokSatuan,
      diselesaikanPada: new Date(),
      diselesaikanOleh: olehPengguna,
      diubahPada: new Date(),
    }).where(eq(workOrders.id, id))
  })

  return (await ambilPerintahProduksi(id))!
}

export async function batalkanPerintahProduksi(id: string): Promise<void> {
  const perintah = await ambilPerintahProduksi(id)
  if (!perintah) throw new ValidasiError('Perintah produksi tidak ditemukan')
  if (perintah.status === 'selesai') {
    throw new ValidasiError(
      'Perintah produksi yang sudah selesai tidak dapat dibatalkan karena stok dan jurnalnya sudah tercatat.',
    )
  }
  await db.update(workOrders)
    .set({ status: 'dibatalkan', diubahPada: new Date() })
    .where(eq(workOrders.id, id))
}

export async function hapusPerintahProduksi(id: string): Promise<void> {
  const perintah = await ambilPerintahProduksi(id)
  if (!perintah) throw new ValidasiError('Perintah produksi tidak ditemukan')
  if (perintah.status === 'dikonfirmasi' || perintah.status === 'selesai') {
    throw new ValidasiError(
      'Perintah produksi yang sudah dikonfirmasi tidak dapat dihapus karena sudah bernomor.',
    )
  }
  await db.delete(workOrders).where(eq(workOrders.id, id))
}

export type OperasiPerintahProduksi = {
  operasiId: string
  nomor: string | null
  tipe: string
  tanggal: string
}

export async function operasiPerintahProduksi(id: string): Promise<OperasiPerintahProduksi[]> {
  return db
    .select({
      operasiId: stockOperations.id,
      nomor: stockOperations.nomor,
      tipe: stockOperations.tipe,
      tanggal: stockOperations.tanggal,
    })
    .from(stockOperations)
    .where(and(
      eq(stockOperations.sumberTipe, 'manufaktur:perintah-produksi'),
      eq(stockOperations.sumberId, id),
    ))
    .orderBy(asc(stockOperations.dibuatPada))
}
