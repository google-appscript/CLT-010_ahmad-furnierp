import { and, asc, eq, inArray, lte } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import {
  depreciationLines, fixedAssets, assetCategories, journals,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, tambah, type Uang } from '@/lib/uang'
import { postingJurnalDalamTx } from '@/modules/akuntansi/layanan/entri'
import { DESIMAL } from './jadwal'

const KODE_JURNAL = 'JU'

export type BarisJadwalLengkap = {
  id: string
  asetId: string
  kodeAset: string
  namaAset: string
  urutan: number
  tanggal: string
  status: string
  nilai: Uang
  akumulasi: Uang
  nilaiBuku: Uang
  jurnalEntryId: string | null
}

/**
 * Seluruh baris jadwal lintas aset, dipakai halaman Jadwal Depresiasi untuk
 * memperlihatkan apa yang sudah dibebankan dan apa yang sudah jatuh tempo.
 */
export async function daftarJadwal(saring: {
  status?: 'draft' | 'diposting'
  sampaiTanggal?: string
} = {}): Promise<BarisJadwalLengkap[]> {
  const syarat = []
  if (saring.status) syarat.push(eq(depreciationLines.status, saring.status))
  if (saring.sampaiTanggal) syarat.push(lte(depreciationLines.tanggal, saring.sampaiTanggal))

  const baris = await db
    .select({
      id: depreciationLines.id,
      asetId: depreciationLines.asetId,
      kodeAset: fixedAssets.kode,
      namaAset: fixedAssets.nama,
      urutan: depreciationLines.urutan,
      tanggal: depreciationLines.tanggal,
      status: depreciationLines.status,
      nilai: depreciationLines.nilai,
      akumulasi: depreciationLines.akumulasi,
      nilaiBuku: depreciationLines.nilaiBuku,
      jurnalEntryId: depreciationLines.jurnalEntryId,
    })
    .from(depreciationLines)
    .innerJoin(fixedAssets, eq(fixedAssets.id, depreciationLines.asetId))
    .where(syarat.length > 0 ? and(...syarat) : undefined)
    .orderBy(asc(depreciationLines.tanggal), asc(fixedAssets.kode), asc(depreciationLines.urutan))

  return baris
}

/**
 * Memposting satu baris depresiasi: mendebit beban dan mengkredit akumulasi.
 *
 * Baris diposting menurut urutannya. Melompati bulan yang lebih awal akan
 * membuat akumulasi tercatat pada baris tidak lagi cocok dengan yang benar-
 * benar sudah dibebankan ke buku besar.
 */
export async function postingBarisDalamTx(
  tx: Transaksi, barisId: string, olehPengguna: string,
): Promise<string> {
  const [baris] = await tx.select().from(depreciationLines)
    .where(eq(depreciationLines.id, barisId)).for('update').limit(1)
  if (!baris) throw new ValidasiError('Baris depresiasi tidak ditemukan')
  if (baris.status === 'diposting') {
    throw new ValidasiError('Baris depresiasi ini sudah diposting')
  }

  const [aset] = await tx.select().from(fixedAssets)
    .where(eq(fixedAssets.id, baris.asetId)).limit(1)
  if (!aset) throw new ValidasiError('Aset tidak ditemukan')
  if (aset.status === 'dilepas') {
    throw new ValidasiError(
      `Aset ${aset.kode} sudah dilepas sehingga tidak disusutkan lagi`,
    )
  }
  if (aset.status === 'draft') {
    throw new ValidasiError(`Aset ${aset.kode} belum dijalankan`)
  }

  const belumDiposting = await tx.select({ urutan: depreciationLines.urutan })
    .from(depreciationLines)
    .where(and(
      eq(depreciationLines.asetId, baris.asetId),
      eq(depreciationLines.status, 'draft'),
    ))
    .orderBy(asc(depreciationLines.urutan))
    .limit(1)
  if (belumDiposting[0] && belumDiposting[0].urutan < baris.urutan) {
    throw new ValidasiError(
      `Depresiasi ${aset.kode} bulan ke-${belumDiposting[0].urutan} belum diposting; ` +
      'jadwal harus diposting berurutan.',
    )
  }

  const [kategori] = await tx.select().from(assetCategories)
    .where(eq(assetCategories.id, aset.kategoriId)).limit(1)
  if (!kategori?.akunBebanId || !kategori.akunAkumulasiId) {
    throw new ValidasiError(
      `Kategori ${kategori?.nama ?? 'aset'} belum memiliki akun beban dan akumulasi depresiasi`,
    )
  }

  const [jurnal] = await tx.select().from(journals)
    .where(eq(journals.kode, KODE_JURNAL)).limit(1)
  if (!jurnal) {
    throw new ValidasiError(`Jurnal ${KODE_JURNAL} tidak ditemukan. Jalankan seed data awal.`)
  }

  const label = `Depresiasi ${aset.kode} — ${aset.nama} bulan ke-${baris.urutan}`
  const nilai = bulatkan(baris.nilai, DESIMAL)

  const posting = await postingJurnalDalamTx(tx, {
    journalId: jurnal.id,
    tanggal: baris.tanggal,
    referensi: aset.kode,
    keterangan: label,
    mataUangId: 'IDR',
    partnerId: null,
    sumberTipe: 'aset:depresiasi',
    sumberId: aset.id,
    item: [
      {
        accountId: kategori.akunBebanId, partnerId: null, label,
        debit: nilai, kredit: '0',
        nilaiMataUang: null, taxId: null, projectId: null,
      },
      {
        accountId: kategori.akunAkumulasiId, partnerId: null, label,
        debit: '0', kredit: nilai,
        nilaiMataUang: null, taxId: null, projectId: null,
      },
    ],
  }, olehPengguna)

  await tx.update(depreciationLines).set({
    status: 'diposting',
    jurnalEntryId: posting.id,
    dipostingPada: new Date(),
    dipostingOleh: olehPengguna,
  }).where(eq(depreciationLines.id, barisId))

  // Aset yang seluruh jadwalnya sudah dibebankan berhenti muncul sebagai
  // pekerjaan yang tersisa.
  const sisa = await tx.select({ id: depreciationLines.id }).from(depreciationLines)
    .where(and(
      eq(depreciationLines.asetId, baris.asetId),
      eq(depreciationLines.status, 'draft'),
    )).limit(1)
  if (sisa.length === 0) {
    await tx.update(fixedAssets)
      .set({ status: 'selesai', diubahPada: new Date() })
      .where(eq(fixedAssets.id, baris.asetId))
  }

  return posting.id
}

export async function postingBaris(barisId: string, olehPengguna: string): Promise<string> {
  return db.transaction((tx) => postingBarisDalamTx(tx, barisId, olehPengguna))
}

export type HasilPostingBerkala = {
  jumlahBaris: number
  jumlahAset: number
  total: Uang
}

/**
 * Memposting seluruh depresiasi yang sudah jatuh tempo sampai tanggal
 * tertentu. Ini yang dijalankan setiap akhir bulan: satu tindakan untuk
 * seluruh aset, bukan satu per satu.
 *
 * Semuanya dalam satu transaksi — bila satu aset bermasalah, tidak ada
 * separuh bulan yang terlanjur terbukukan.
 */
export async function postingDepresiasiSampai(
  sampaiTanggal: string, olehPengguna: string,
): Promise<HasilPostingBerkala> {
  return db.transaction(async (tx) => {
    const jatuhTempo = await tx
      .select({
        id: depreciationLines.id,
        asetId: depreciationLines.asetId,
        nilai: depreciationLines.nilai,
      })
      .from(depreciationLines)
      .innerJoin(fixedAssets, eq(fixedAssets.id, depreciationLines.asetId))
      .where(and(
        eq(depreciationLines.status, 'draft'),
        lte(depreciationLines.tanggal, sampaiTanggal),
        inArray(fixedAssets.status, ['berjalan']),
      ))
      .orderBy(asc(depreciationLines.tanggal), asc(depreciationLines.urutan))

    if (jatuhTempo.length === 0) {
      throw new ValidasiError(
        `Tidak ada depresiasi yang jatuh tempo sampai ${sampaiTanggal}.`,
      )
    }

    for (const b of jatuhTempo) {
      await postingBarisDalamTx(tx, b.id, olehPengguna)
    }

    return {
      jumlahBaris: jatuhTempo.length,
      jumlahAset: new Set(jatuhTempo.map((b) => b.asetId)).size,
      total: bulatkan(tambah(...jatuhTempo.map((b) => b.nilai)), DESIMAL),
    }
  })
}
