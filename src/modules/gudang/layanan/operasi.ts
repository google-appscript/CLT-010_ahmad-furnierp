import { asc, desc, eq } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import {
  stockOperations, stockOperationLines, stockMoves,
  products, productCategories, locations, uoms, journals, companySettings,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, kurang, tambah, type Uang } from '@/lib/uang'
import { ambilNomorBerikut } from '@/modules/akuntansi/layanan/urutan'
import { postingJurnalDalamTx } from '@/modules/akuntansi/layanan/entri'
import { stokDiLokasi } from '../repositori/stok'
import {
  hitungDampakValuasi, konversiSatuan, DESIMAL_KUANTITAS, DESIMAL_NILAI,
} from './valuasi'
import { skemaOperasi, labelTipeOperasi, type MasukanOperasi } from '../validasi/operasi'

export type Operasi = typeof stockOperations.$inferSelect
export type BarisOperasi = typeof stockOperationLines.$inferSelect
export type OperasiLengkap = Operasi & { baris: BarisOperasi[] }
export type TipeOperasi = Operasi['tipe']

/** Jurnal yang dipakai seluruh pergerakan stok. */
const KODE_JURNAL_STOK = 'JPS'
/** Urutan penomoran dokumen per tipe operasi. */
const KODE_URUTAN: Record<TipeOperasi, string> = {
  penerimaan: 'gudang:penerimaan',
  pengiriman: 'gudang:pengiriman',
  transfer: 'gudang:transfer',
  barang_rusak: 'gudang:barang-rusak',
  opname: 'gudang:opname',
}

type ArahPergerakan = 'masuk' | 'keluar' | 'internal'

/**
 * Arah sebuah pergerakan ditentukan sepenuhnya oleh tipe kedua lokasinya.
 * Inilah yang membuat penerimaan, pengiriman, barang rusak, dan stock opname
 * memakai satu mekanisme yang sama: yang membedakan hanya lokasi virtual
 * mana yang berada di seberang lokasi internal.
 */
function tentukanArah(tipeAsal: string, tipeTujuan: string): ArahPergerakan {
  const asalInternal = tipeAsal === 'internal'
  const tujuanInternal = tipeTujuan === 'internal'
  if (asalInternal && tujuanInternal) return 'internal'
  if (tujuanInternal) return 'masuk'
  if (asalInternal) return 'keluar'
  throw new ValidasiError(
    'Pergerakan antar dua lokasi non-internal tidak mengubah stok perusahaan dan tidak diizinkan',
  )
}

function urai(masukan: MasukanOperasi) {
  const hasil = skemaOperasi.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

// ── Pembacaan ────────────────────────────────────────────────────────────────

export async function daftarOperasi(
  saring: { tipe?: TipeOperasi; status?: Operasi['status'] } = {},
): Promise<Operasi[]> {
  const kueri = db.select().from(stockOperations)
    .orderBy(desc(stockOperations.tanggal), desc(stockOperations.dibuatPada))
  if (saring.tipe && saring.status) {
    return kueri.where(eq(stockOperations.tipe, saring.tipe))
      .then((r) => r.filter((o) => o.status === saring.status))
  }
  if (saring.tipe) return kueri.where(eq(stockOperations.tipe, saring.tipe))
  if (saring.status) return kueri.where(eq(stockOperations.status, saring.status))
  return kueri
}

export async function ambilOperasi(id: string): Promise<OperasiLengkap | null> {
  const [operasi] = await db.select().from(stockOperations)
    .where(eq(stockOperations.id, id)).limit(1)
  if (!operasi) return null
  const baris = await db.select().from(stockOperationLines)
    .where(eq(stockOperationLines.operasiId, id))
    .orderBy(asc(stockOperationLines.urutan))
  return { ...operasi, baris }
}

// ── Penulisan ────────────────────────────────────────────────────────────────

async function wajibLokasiSah(
  tx: Transaksi, tipe: TipeOperasi, asalId: string, tujuanId: string,
): Promise<{ tipeAsal: string; tipeTujuan: string }> {
  const [asal] = await tx.select().from(locations).where(eq(locations.id, asalId)).limit(1)
  const [tujuan] = await tx.select().from(locations).where(eq(locations.id, tujuanId)).limit(1)
  if (!asal || !tujuan) throw new ValidasiError('Lokasi tidak ditemukan')

  // Arah dihitung agar kombinasi lokasi yang mustahil ditolak sedini mungkin.
  const arah = tentukanArah(asal.tipe, tujuan.tipe)

  if (tipe === 'transfer' && arah !== 'internal') {
    throw new ValidasiError('Transfer internal harus antara dua lokasi internal')
  }
  if (tipe === 'penerimaan' && arah !== 'masuk') {
    throw new ValidasiError('Penerimaan barang harus berakhir di lokasi internal')
  }
  if ((tipe === 'pengiriman' || tipe === 'barang_rusak') && arah !== 'keluar') {
    throw new ValidasiError(`${labelTipeOperasi(tipe)} harus berasal dari lokasi internal`)
  }

  return { tipeAsal: asal.tipe, tipeTujuan: tujuan.tipe }
}

export async function buatOperasi(
  masukan: MasukanOperasi, dibuatOleh: string,
): Promise<OperasiLengkap> {
  const data = urai(masukan)

  const id = await db.transaction(async (tx) => {
    await wajibLokasiSah(tx, data.tipe, data.lokasiAsalId, data.lokasiTujuanId)

    const [operasi] = await tx.insert(stockOperations).values({
      tipe: data.tipe,
      tanggal: data.tanggal,
      status: 'draft',
      lokasiAsalId: data.lokasiAsalId,
      lokasiTujuanId: data.lokasiTujuanId,
      partnerId: data.partnerId,
      referensi: data.referensi,
      catatan: data.catatan,
      dibuatOleh,
    }).returning({ id: stockOperations.id })

    await tx.insert(stockOperationLines).values(
      data.baris.map((b, i) => ({
        operasiId: operasi.id,
        urutan: i + 1,
        produkId: b.produkId,
        kuantitas: b.kuantitas,
        uomId: b.uomId,
        hargaSatuan: b.hargaSatuan,
        catatan: b.catatan,
      })),
    )

    return operasi.id
  })

  return (await ambilOperasi(id))!
}

export async function ubahOperasi(
  id: string, masukan: MasukanOperasi,
): Promise<OperasiLengkap> {
  const data = urai(masukan)
  const lama = await ambilOperasi(id)
  if (!lama) throw new ValidasiError('Operasi tidak ditemukan')
  if (lama.status !== 'draft') {
    throw new ValidasiError(
      'Operasi yang sudah diselesaikan tidak dapat diubah. Buat operasi baru untuk mengoreksinya.',
    )
  }

  await db.transaction(async (tx) => {
    await wajibLokasiSah(tx, data.tipe, data.lokasiAsalId, data.lokasiTujuanId)

    await tx.update(stockOperations).set({
      tipe: data.tipe,
      tanggal: data.tanggal,
      lokasiAsalId: data.lokasiAsalId,
      lokasiTujuanId: data.lokasiTujuanId,
      partnerId: data.partnerId,
      referensi: data.referensi,
      catatan: data.catatan,
      diubahPada: new Date(),
    }).where(eq(stockOperations.id, id))

    await tx.delete(stockOperationLines).where(eq(stockOperationLines.operasiId, id))
    await tx.insert(stockOperationLines).values(
      data.baris.map((b, i) => ({
        operasiId: id,
        urutan: i + 1,
        produkId: b.produkId,
        kuantitas: b.kuantitas,
        uomId: b.uomId,
        hargaSatuan: b.hargaSatuan,
        catatan: b.catatan,
      })),
    )
  })

  return (await ambilOperasi(id))!
}

type PergerakanTerhitung = {
  produkId: string
  namaProduk: string
  lokasiAsalId: string
  lokasiTujuanId: string
  arah: ArahPergerakan
  kuantitas: Uang
  hargaPokokSatuan: Uang
  nilaiTotal: Uang
  rataRataBaru: Uang
  akunPersediaanId: string
  akunLawanId: string
}

/**
 * Akun lawan persediaan ditentukan oleh tipe operasi, bukan oleh arah
 * pergerakan. Penerimaan berpasangan dengan penampung tagihan pemasok,
 * pengiriman dengan harga pokok penjualan, barang rusak dengan kerugiannya
 * sendiri, dan stock opname dengan selisih persediaan.
 */
async function akunLawan(
  tx: Transaksi,
  tipe: TipeOperasi,
  kategori: typeof productCategories.$inferSelect,
): Promise<string> {
  if (tipe === 'pengiriman') return kategori.akunHppId
  if (tipe === 'barang_rusak') return kategori.akunBarangRusakId
  if (tipe === 'opname') return kategori.akunSelisihId

  const [pengaturan] = await tx.select().from(companySettings).limit(1)
  if (!pengaturan?.akunPenerimaanBelumDitagihId) {
    throw new ValidasiError(
      'Akun Penerimaan Barang Belum Ditagih belum diatur pada Profil Perusahaan',
    )
  }
  return pengaturan.akunPenerimaanBelumDitagihId
}

/**
 * Menyelesaikan operasi: mencatat pergerakan stok, memperbarui harga pokok
 * rata-rata, dan memposting jurnal — seluruhnya dalam satu transaksi. Stok
 * yang tercatat tanpa jurnalnya, atau sebaliknya, akan membuat persediaan
 * menyimpang dari buku besar.
 */
export async function selesaikanOperasi(
  id: string, olehPengguna: string,
): Promise<OperasiLengkap> {
  await db.transaction(async (tx) => {
    const [operasi] = await tx.select().from(stockOperations)
      .where(eq(stockOperations.id, id)).for('update').limit(1)

    if (!operasi) throw new ValidasiError('Operasi tidak ditemukan')
    if (operasi.status === 'selesai') throw new ValidasiError('Operasi ini sudah diselesaikan')
    if (operasi.status === 'dibatalkan') {
      throw new ValidasiError('Operasi yang dibatalkan tidak dapat diselesaikan')
    }

    const { tipeAsal, tipeTujuan } = await wajibLokasiSah(
      tx, operasi.tipe, operasi.lokasiAsalId, operasi.lokasiTujuanId,
    )

    const baris = await tx.select().from(stockOperationLines)
      .where(eq(stockOperationLines.operasiId, id))
      .orderBy(asc(stockOperationLines.urutan))
    if (baris.length === 0) {
      throw new ValidasiError('Operasi memerlukan minimal satu baris produk')
    }

    const pergerakan: PergerakanTerhitung[] = []

    for (const b of baris) {
      const [produk] = await tx.select().from(products)
        .where(eq(products.id, b.produkId)).for('update').limit(1)
      if (!produk) throw new ValidasiError('Produk tidak ditemukan')
      if (produk.tipe !== 'disimpan') {
        throw new ValidasiError(
          `Produk ${produk.nama} bertipe ${produk.tipe} sehingga tidak memiliki stok`,
        )
      }

      const [satuanBaris] = await tx.select().from(uoms).where(eq(uoms.id, b.uomId)).limit(1)
      const [satuanProduk] = await tx.select().from(uoms)
        .where(eq(uoms.id, produk.uomId)).limit(1)
      if (!satuanBaris || !satuanProduk) throw new ValidasiError('Satuan tidak ditemukan')
      if (satuanBaris.kategori !== satuanProduk.kategori) {
        throw new ValidasiError(
          `Satuan ${satuanBaris.nama} tidak sekategori dengan satuan produk ${produk.nama}`,
        )
      }

      const [kategori] = await tx.select().from(productCategories)
        .where(eq(productCategories.id, produk.kategoriId)).limit(1)
      if (!kategori) throw new ValidasiError('Kategori produk tidak ditemukan')

      const kuantitasDasar = konversiSatuan(b.kuantitas, satuanBaris.faktor, satuanProduk.faktor)

      // Stock opname mencatat hasil hitung fisik; yang dibukukan adalah
      // selisihnya terhadap stok tercatat, dan arahnya mengikuti tanda selisih.
      let arah: ArahPergerakan = tentukanArah(tipeAsal, tipeTujuan)
      let kuantitasGerak = kuantitasDasar
      let lokasiAsalGerak = operasi.lokasiAsalId
      let lokasiTujuanGerak = operasi.lokasiTujuanId

      if (operasi.tipe === 'opname') {
        const tercatat = await stokDiLokasi(tx, produk.id, operasi.lokasiTujuanId)
        const selisih = kurang(kuantitasDasar, tercatat)
        if (Number(selisih) === 0) continue
        if (Number(selisih) > 0) {
          arah = 'masuk'
          kuantitasGerak = bulatkan(selisih, DESIMAL_KUANTITAS)
        } else {
          arah = 'keluar'
          kuantitasGerak = bulatkan(String(-Number(selisih)), DESIMAL_KUANTITAS)
          lokasiAsalGerak = operasi.lokasiTujuanId
          lokasiTujuanGerak = operasi.lokasiAsalId
        }
      }

      if (arah === 'keluar' || arah === 'internal') {
        const tersedia = await stokDiLokasi(tx, produk.id, lokasiAsalGerak)
        if (Number(tersedia) < Number(kuantitasGerak)) {
          const [lokasi] = await tx.select().from(locations)
            .where(eq(locations.id, lokasiAsalGerak)).limit(1)
          throw new ValidasiError(
            `Stok ${produk.nama} di ${lokasi?.nama ?? 'lokasi asal'} hanya ${Number(tersedia)} ` +
            `${satuanProduk.nama}, tidak mencukupi untuk mengeluarkan ${Number(kuantitasGerak)}.`,
          )
        }
      }

      // Transfer antar lokasi internal tidak mengubah nilai persediaan
      // perusahaan, jadi harga pokok rata-rata tidak disentuh.
      if (arah === 'internal') {
        pergerakan.push({
          produkId: produk.id, namaProduk: produk.nama,
          lokasiAsalId: lokasiAsalGerak, lokasiTujuanId: lokasiTujuanGerak,
          arah, kuantitas: kuantitasGerak,
          hargaPokokSatuan: produk.hargaPokokRataRata,
          nilaiTotal: '0.00', rataRataBaru: produk.hargaPokokRataRata,
          akunPersediaanId: kategori.akunPersediaanId, akunLawanId: kategori.akunPersediaanId,
        })
        continue
      }

      const stokPerusahaan = await stokDiLokasi(tx, produk.id, lokasiAsalGerak)
      const kuantitasSaatIni = arah === 'masuk'
        ? await stokDiLokasi(tx, produk.id, lokasiTujuanGerak)
        : stokPerusahaan

      const dampak = hitungDampakValuasi({
        arah,
        kuantitas: kuantitasGerak,
        kuantitasSaatIni,
        rataRataSaatIni: produk.hargaPokokRataRata,
        hargaMasuk: arah === 'masuk' && b.hargaSatuan
          ? b.hargaSatuan
          : produk.hargaPokokRataRata,
      })

      await tx.update(products)
        .set({ hargaPokokRataRata: dampak.rataRataBaru, diubahPada: new Date() })
        .where(eq(products.id, produk.id))

      pergerakan.push({
        produkId: produk.id, namaProduk: produk.nama,
        lokasiAsalId: lokasiAsalGerak, lokasiTujuanId: lokasiTujuanGerak,
        arah, kuantitas: kuantitasGerak,
        hargaPokokSatuan: dampak.hargaPokokSatuan,
        nilaiTotal: dampak.nilaiTotal,
        rataRataBaru: dampak.rataRataBaru,
        akunPersediaanId: kategori.akunPersediaanId,
        akunLawanId: await akunLawan(tx, operasi.tipe, kategori),
      })
    }

    if (pergerakan.length === 0) {
      throw new ValidasiError(
        'Tidak ada selisih yang perlu dibukukan; hasil hitung fisik sama dengan stok tercatat.',
      )
    }

    await tx.insert(stockMoves).values(
      pergerakan.map((p) => ({
        operasiId: id,
        produkId: p.produkId,
        lokasiAsalId: p.lokasiAsalId,
        lokasiTujuanId: p.lokasiTujuanId,
        tanggal: operasi.tanggal,
        kuantitas: p.kuantitas,
        hargaPokokSatuan: p.hargaPokokSatuan,
        nilaiTotal: p.nilaiTotal,
      })),
    )

    const nomor = await ambilNomorBerikut(
      tx, KODE_URUTAN[operasi.tipe], new Date(`${operasi.tanggal}T00:00:00Z`),
    )

    // Transfer internal tidak menghasilkan jurnal karena nilai persediaan
    // perusahaan tidak berubah.
    const berdampakNilai = pergerakan.filter((p) => p.arah !== 'internal')
    let jurnalEntryId: string | null = null

    if (berdampakNilai.length > 0) {
      const [jurnal] = await tx.select().from(journals)
        .where(eq(journals.kode, KODE_JURNAL_STOK)).limit(1)
      if (!jurnal) {
        throw new ValidasiError(
          `Jurnal ${KODE_JURNAL_STOK} tidak ditemukan. Jalankan seed data awal terlebih dahulu.`,
        )
      }

      const item = berdampakNilai.flatMap((p) => {
        const persediaanDebit = p.arah === 'masuk'
        return [
          {
            accountId: p.akunPersediaanId,
            partnerId: operasi.partnerId,
            label: `${labelTipeOperasi(operasi.tipe)} — ${p.namaProduk}`,
            debit: persediaanDebit ? p.nilaiTotal : '0',
            kredit: persediaanDebit ? '0' : p.nilaiTotal,
            nilaiMataUang: null, taxId: null, projectId: null,
          },
          {
            accountId: p.akunLawanId,
            partnerId: operasi.partnerId,
            label: `${labelTipeOperasi(operasi.tipe)} — ${p.namaProduk}`,
            debit: persediaanDebit ? '0' : p.nilaiTotal,
            kredit: persediaanDebit ? p.nilaiTotal : '0',
            nilaiMataUang: null, taxId: null, projectId: null,
          },
        ]
      }).filter((b) => Number(b.debit) > 0 || Number(b.kredit) > 0)

      if (item.length > 0) {
        const hasil = await postingJurnalDalamTx(tx, {
          journalId: jurnal.id,
          tanggal: operasi.tanggal,
          referensi: nomor,
          keterangan: `${labelTipeOperasi(operasi.tipe)} ${nomor}`,
          mataUangId: 'IDR',
          partnerId: operasi.partnerId,
          sumberTipe: `gudang:${operasi.tipe}`,
          sumberId: id,
          item,
        }, olehPengguna)
        jurnalEntryId = hasil.id
      }
    }

    await tx.update(stockOperations).set({
      nomor,
      status: 'selesai',
      jurnalEntryId,
      diselesaikanPada: new Date(),
      diselesaikanOleh: olehPengguna,
      diubahPada: new Date(),
    }).where(eq(stockOperations.id, id))
  })

  return (await ambilOperasi(id))!
}

export async function batalkanOperasi(id: string): Promise<void> {
  const operasi = await ambilOperasi(id)
  if (!operasi) throw new ValidasiError('Operasi tidak ditemukan')
  if (operasi.status !== 'draft') {
    throw new ValidasiError('Hanya operasi berstatus draft yang dapat dibatalkan')
  }
  await db.update(stockOperations)
    .set({ status: 'dibatalkan', diubahPada: new Date() })
    .where(eq(stockOperations.id, id))
}

export async function hapusOperasi(id: string): Promise<void> {
  const operasi = await ambilOperasi(id)
  if (!operasi) throw new ValidasiError('Operasi tidak ditemukan')
  if (operasi.status === 'selesai') {
    throw new ValidasiError(
      'Operasi yang sudah diselesaikan tidak dapat dihapus karena stok dan jurnalnya sudah tercatat.',
    )
  }
  await db.delete(stockOperations).where(eq(stockOperations.id, id))
}

/** Total nilai rupiah sebuah operasi yang sudah selesai. */
export async function nilaiOperasi(id: string): Promise<Uang> {
  const gerak = await db.select({ nilai: stockMoves.nilaiTotal }).from(stockMoves)
    .where(eq(stockMoves.operasiId, id))
  return bulatkan(tambah(...gerak.map((g) => g.nilai)), DESIMAL_NILAI)
}
