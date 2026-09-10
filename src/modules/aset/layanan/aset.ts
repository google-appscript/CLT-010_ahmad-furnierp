import {
  and, asc, desc, eq, ilike, inArray, or, sql,
} from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import {
  fixedAssets, assetCategories, depreciationLines, accounts,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import type { ParameterDaftar, HasilDaftar } from '@/lib/daftar'
import { bulatkan, kurang, tambah, type Uang } from '@/lib/uang'
import { postingJurnalDalamTx } from '@/modules/akuntansi/layanan/entri'
import {
  jurnalUntukDalamTx, akunOtomatisDalamTx, PEMETAAN_JURNAL,
} from '@/modules/akuntansi/layanan/pemetaan'
import { susunJadwal, DESIMAL } from './jadwal'
import {
  skemaAset, skemaPelepasan, type MasukanAset, type MasukanPelepasan,
} from '../validasi/aset'

export type Aset = typeof fixedAssets.$inferSelect
export type KategoriAset = typeof assetCategories.$inferSelect
export type BarisDepresiasi = typeof depreciationLines.$inferSelect
export type AsetLengkap = Aset & { baris: BarisDepresiasi[] }


function urai(masukan: MasukanAset) {
  const hasil = skemaAset.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

// ── Pembacaan ────────────────────────────────────────────────────────────────

export async function daftarKategoriAset(): Promise<KategoriAset[]> {
  return db.select().from(assetCategories).orderBy(asc(assetCategories.kode))
}

function kolomUrutAset(kolom?: string) {
  switch (kolom) {
    case 'kode': return fixedAssets.kode
    case 'status': return fixedAssets.status
    case 'tanggalPerolehan':
    default:
      return fixedAssets.tanggalPerolehan
  }
}

export async function daftarAset(
  param: ParameterDaftar & { status?: Aset['status']; kategoriId?: string } = { halaman: 1, ukuranHalaman: 20 },
): Promise<HasilDaftar<Aset>> {
  const halaman = param.halaman || 1
  const ukuranHalaman = param.ukuranHalaman || 20

  const kondisi = []
  if (param.cari) {
    kondisi.push(or(
      ilike(fixedAssets.kode, `%${param.cari}%`),
      ilike(fixedAssets.nama, `%${param.cari}%`),
    ))
  }
  if (param.kategoriId) kondisi.push(eq(fixedAssets.kategoriId, param.kategoriId))

  const statusDisaring = [
    ...(param.status ? [param.status] : []),
    ...(param.filter?.status ?? []),
  ] as Aset['status'][]
  if (statusDisaring.length > 0) {
    kondisi.push(inArray(fixedAssets.status, statusDisaring))
  }

  const where = kondisi.length > 0 ? and(...kondisi) : undefined
  const kolomUrut = kolomUrutAset(param.urutkan?.kolom)
  const arahUrut = param.urutkan?.arah === 'asc' ? asc : desc

  const [data, [{ jumlah }]] = await Promise.all([
    db.select().from(fixedAssets)
      .where(where)
      .orderBy(arahUrut(kolomUrut), asc(fixedAssets.kode))
      .limit(ukuranHalaman)
      .offset((halaman - 1) * ukuranHalaman),
    db.select({ jumlah: sql<number>`count(*)::int` }).from(fixedAssets).where(where),
  ])

  return { data, totalBaris: jumlah }
}

export async function ambilAset(id: string): Promise<AsetLengkap | null> {
  const [aset] = await db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).limit(1)
  if (!aset) return null
  const baris = await db.select().from(depreciationLines)
    .where(eq(depreciationLines.asetId, id))
    .orderBy(asc(depreciationLines.urutan))
  return { ...aset, baris }
}

export type RingkasanAset = AsetLengkap & {
  akumulasi: Uang
  nilaiBuku: Uang
  sudahDiposting: number
  totalBaris: number
}

/**
 * Akumulasi hanya menghitung baris yang sudah diposting. Baris draft adalah
 * rencana, bukan beban yang sudah terjadi, dan memasukkannya akan membuat
 * nilai buku menyimpang dari buku besar.
 */
export async function ringkasanAset(id: string): Promise<RingkasanAset | null> {
  const aset = await ambilAset(id)
  if (!aset) return null

  const terposting = aset.baris.filter((b) => b.status === 'diposting')
  const akumulasi = bulatkan(tambah(...terposting.map((b) => b.nilai)), DESIMAL)

  return {
    ...aset,
    akumulasi,
    nilaiBuku: bulatkan(kurang(aset.nilaiPerolehan, akumulasi), DESIMAL),
    sudahDiposting: terposting.length,
    totalBaris: aset.baris.length,
  }
}

// ── Penulisan ────────────────────────────────────────────────────────────────

async function wajibKategori(tx: Transaksi, kategoriId: string): Promise<KategoriAset> {
  const [kategori] = await tx.select().from(assetCategories)
    .where(eq(assetCategories.id, kategoriId)).limit(1)
  if (!kategori) throw new ValidasiError('Kategori aset tidak ditemukan')
  if (!kategori.isActive) throw new ValidasiError(`Kategori ${kategori.nama} sudah nonaktif`)
  return kategori
}

export async function buatAset(masukan: MasukanAset, dibuatOleh: string): Promise<AsetLengkap> {
  const data = urai(masukan)

  const id = await db.transaction(async (tx) => {
    await wajibKategori(tx, data.kategoriId)
    const [aset] = await tx.insert(fixedAssets).values({
      kode: data.kode,
      nama: data.nama,
      kategoriId: data.kategoriId,
      status: 'draft',
      tanggalPerolehan: data.tanggalPerolehan,
      tanggalMulaiDepresiasi: data.tanggalMulaiDepresiasi,
      nilaiPerolehan: data.nilaiPerolehan,
      nilaiResidu: data.nilaiResidu,
      masaManfaatBulan: data.masaManfaatBulan,
      metode: data.metode,
      partnerId: data.partnerId,
      referensi: data.referensi,
      catatan: data.catatan,
      dibuatOleh,
    }).returning({ id: fixedAssets.id })
    return aset.id
  })

  return (await ambilAset(id))!
}

export async function ubahAset(id: string, masukan: MasukanAset): Promise<AsetLengkap> {
  const data = urai(masukan)
  const lama = await ambilAset(id)
  if (!lama) throw new ValidasiError('Aset tidak ditemukan')
  if (lama.status !== 'draft') {
    throw new ValidasiError(
      'Aset yang sudah dijalankan tidak dapat diubah karena jadwal depresiasinya sudah tersusun.',
    )
  }

  await db.transaction(async (tx) => {
    await wajibKategori(tx, data.kategoriId)
    await tx.update(fixedAssets).set({
      kode: data.kode,
      nama: data.nama,
      kategoriId: data.kategoriId,
      tanggalPerolehan: data.tanggalPerolehan,
      tanggalMulaiDepresiasi: data.tanggalMulaiDepresiasi,
      nilaiPerolehan: data.nilaiPerolehan,
      nilaiResidu: data.nilaiResidu,
      masaManfaatBulan: data.masaManfaatBulan,
      metode: data.metode,
      partnerId: data.partnerId,
      referensi: data.referensi,
      catatan: data.catatan,
      diubahPada: new Date(),
    }).where(eq(fixedAssets.id, id))
  })

  return (await ambilAset(id))!
}

/**
 * Menjalankan aset: menyusun seluruh jadwal depresiasinya sekaligus sehingga
 * rencana penyusutan terlihat utuh sejak awal. Kategori yang tidak disusutkan
 * — tanah, misalnya — tetap dapat dijalankan; ia hanya tidak punya jadwal.
 */
export async function jalankanAset(id: string, olehPengguna: string): Promise<AsetLengkap> {
  await db.transaction(async (tx) => {
    const [aset] = await tx.select().from(fixedAssets)
      .where(eq(fixedAssets.id, id)).for('update').limit(1)

    if (!aset) throw new ValidasiError('Aset tidak ditemukan')
    if (aset.status === 'dilepas') {
      throw new ValidasiError('Aset yang sudah dilepas tidak dapat dijalankan')
    }
    if (aset.status !== 'draft') throw new ValidasiError('Aset ini sudah dijalankan')

    const kategori = await wajibKategori(tx, aset.kategoriId)

    if (kategori.dapatDidepresiasi) {
      const jadwal = susunJadwal({
        nilaiPerolehan: aset.nilaiPerolehan,
        nilaiResidu: aset.nilaiResidu,
        masaManfaatBulan: aset.masaManfaatBulan,
        metode: aset.metode,
        tanggalMulai: aset.tanggalMulaiDepresiasi,
      })

      await tx.insert(depreciationLines).values(
        jadwal.map((b) => ({
          asetId: id,
          urutan: b.urutan,
          tanggal: b.tanggal,
          status: 'draft' as const,
          nilai: b.nilai,
          akumulasi: b.akumulasi,
          nilaiBuku: b.nilaiBuku,
        })),
      )
    }

    await tx.update(fixedAssets).set({
      status: 'berjalan',
      dijalankanPada: new Date(),
      dijalankanOleh: olehPengguna,
      diubahPada: new Date(),
    }).where(eq(fixedAssets.id, id))
  })

  return (await ambilAset(id))!
}

export async function hapusAset(id: string): Promise<void> {
  const aset = await ambilAset(id)
  if (!aset) throw new ValidasiError('Aset tidak ditemukan')
  if (aset.status !== 'draft') {
    throw new ValidasiError(
      'Hanya aset berstatus draft yang dapat dihapus; aset yang sudah dijalankan dilepas, bukan dihapus.',
    )
  }
  await db.delete(fixedAssets).where(eq(fixedAssets.id, id))
}

/**
 * Melepas aset: mengeluarkan nilai perolehan dan akumulasinya dari neraca,
 * mencatat hasil penjualannya, dan membukukan selisihnya sebagai laba atau
 * rugi pelepasan.
 *
 * Baris depresiasi yang belum diposting dibuang karena aset tidak lagi
 * dimiliki; yang sudah diposting dibiarkan utuh sebagai riwayat.
 */
export async function lepaskanAset(
  id: string, masukan: MasukanPelepasan, olehPengguna: string,
): Promise<AsetLengkap> {
  const hasilUrai = skemaPelepasan.safeParse(masukan)
  if (!hasilUrai.success) throw new ValidasiError(hasilUrai.error.issues[0].message)
  const data = hasilUrai.data

  await db.transaction(async (tx) => {
    const [aset] = await tx.select().from(fixedAssets)
      .where(eq(fixedAssets.id, id)).for('update').limit(1)

    if (!aset) throw new ValidasiError('Aset tidak ditemukan')
    if (aset.status === 'dilepas') throw new ValidasiError('Aset ini sudah dilepas')
    if (aset.status === 'draft') {
      throw new ValidasiError('Aset yang belum dijalankan dihapus saja, tidak dilepas')
    }
    if (data.tanggal < aset.tanggalPerolehan) {
      throw new ValidasiError('Tanggal pelepasan tidak boleh mendahului tanggal perolehan')
    }

    const kategori = await wajibKategori(tx, aset.kategoriId)

    const baris = await tx.select().from(depreciationLines)
      .where(eq(depreciationLines.asetId, id))
    const terposting = baris.filter((b) => b.status === 'diposting')
    const akumulasi = bulatkan(tambah(...terposting.map((b) => b.nilai)), DESIMAL)
    const nilaiBuku = bulatkan(kurang(aset.nilaiPerolehan, akumulasi), DESIMAL)
    const selisih = bulatkan(kurang(data.nilaiPelepasan, nilaiBuku), DESIMAL)

    const journalId = await jurnalUntukDalamTx(tx, PEMETAAN_JURNAL.PELEPASAN_ASET)

    type ItemJurnal = {
      accountId: string; partnerId: string | null; label: string
      debit: string; kredit: string
      nilaiMataUang: null; taxId: null; projectId: null
    }
    const item: ItemJurnal[] = []
    const label = `Pelepasan aset ${aset.kode} — ${aset.nama}`

    if (Number(akumulasi) > 0) {
      item.push({
        accountId: kategori.akunAkumulasiId!, partnerId: null, label,
        debit: akumulasi, kredit: '0',
        nilaiMataUang: null, taxId: null, projectId: null,
      })
    }
    if (Number(data.nilaiPelepasan) > 0) {
      item.push({
        accountId: data.akunPenerimaanId!, partnerId: aset.partnerId, label,
        debit: bulatkan(data.nilaiPelepasan, DESIMAL), kredit: '0',
        nilaiMataUang: null, taxId: null, projectId: null,
      })
    }
    item.push({
      accountId: kategori.akunAsetId, partnerId: null, label,
      debit: '0', kredit: bulatkan(aset.nilaiPerolehan, DESIMAL),
      nilaiMataUang: null, taxId: null, projectId: null,
    })

    if (Number(selisih) !== 0) {
      const untung = Number(selisih) > 0
      const nilai = bulatkan(untung ? selisih : String(-Number(selisih)), DESIMAL)
      item.push({
        accountId: await akunOtomatisDalamTx(
          tx, untung ? 'akunLabaPelepasanAsetId' : 'akunRugiPelepasanAsetId',
        ),
        partnerId: null,
        label: untung ? `Laba pelepasan aset ${aset.kode}` : `Rugi pelepasan aset ${aset.kode}`,
        debit: untung ? '0' : nilai,
        kredit: untung ? nilai : '0',
        nilaiMataUang: null, taxId: null, projectId: null,
      })
    }

    const posting = await postingJurnalDalamTx(tx, {
      journalId,
      tanggal: data.tanggal,
      referensi: aset.kode,
      keterangan: label,
      mataUangId: 'IDR',
      partnerId: aset.partnerId,
      sumberTipe: 'aset:pelepasan',
      sumberId: id,
      item,
    }, olehPengguna)

    // Rencana penyusutan yang belum terjadi ikut gugur bersama asetnya.
    await tx.delete(depreciationLines).where(and(
      eq(depreciationLines.asetId, id),
      eq(depreciationLines.status, 'draft'),
    ))

    await tx.update(fixedAssets).set({
      status: 'dilepas',
      tanggalPelepasan: data.tanggal,
      nilaiPelepasan: bulatkan(data.nilaiPelepasan, DESIMAL),
      jurnalPelepasanId: posting.id,
      catatan: data.catatan ?? aset.catatan,
      diubahPada: new Date(),
    }).where(eq(fixedAssets.id, id))
  })

  return (await ambilAset(id))!
}

/** Dipakai halaman pelepasan untuk menawarkan akun kas dan bank. */
export async function akunKasDanBank() {
  return db.select().from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(asc(accounts.kode))
    .then((r) => r.filter((a) => a.tipeAkun === 'aset_kas' || a.tipeAkun === 'aset_bank'))
}

