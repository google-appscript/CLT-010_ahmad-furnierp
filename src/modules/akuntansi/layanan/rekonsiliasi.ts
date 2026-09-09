import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import {
  reconciliations, journalItems, journalEntries, accounts, partners,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, kurang, tambah, type Uang } from '@/lib/uang'

const DESIMAL = 2

export type ItemTerbuka = {
  itemId: string
  entryId: string
  nomor: string | null
  tanggal: string
  akunKode: string
  akunNama: string
  partnerId: string | null
  namaPartner: string | null
  label: string
  debit: Uang
  kredit: Uang
}

/**
 * Item jurnal pada akun yang dapat direkonsiliasi dan belum ditandai selesai.
 * Hanya entri terposting yang muncul; draft belum menjadi kewajiban maupun hak.
 */
export async function itemTerbuka(saring: {
  akunId?: string
  partnerId?: string
} = {}): Promise<ItemTerbuka[]> {
  const syarat = [
    eq(journalEntries.status, 'diposting'),
    eq(accounts.dapatDirekonsiliasi, true),
    isNull(journalItems.rekonsiliasiId),
  ]
  if (saring.akunId) syarat.push(eq(journalItems.accountId, saring.akunId))
  if (saring.partnerId) syarat.push(eq(journalItems.partnerId, saring.partnerId))

  const baris = await db
    .select({
      itemId: journalItems.id,
      entryId: journalEntries.id,
      nomor: journalEntries.nomor,
      tanggal: journalEntries.tanggal,
      akunKode: accounts.kode,
      akunNama: accounts.nama,
      partnerId: journalItems.partnerId,
      namaPartner: partners.nama,
      label: journalItems.label,
      debit: journalItems.debit,
      kredit: journalItems.kredit,
    })
    .from(journalItems)
    .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
    .innerJoin(accounts, eq(accounts.id, journalItems.accountId))
    .leftJoin(partners, eq(partners.id, journalItems.partnerId))
    .where(and(...syarat))
    .orderBy(asc(journalEntries.tanggal), asc(journalEntries.nomor))

  return baris.map((b) => ({
    ...b,
    debit: Number(b.debit).toFixed(DESIMAL),
    kredit: Number(b.kredit).toFixed(DESIMAL),
  }))
}

/** Akun yang ditandai dapat direkonsiliasi pada bagan akun. */
export async function akunDapatDirekonsiliasi() {
  return db.select().from(accounts)
    .where(and(eq(accounts.dapatDirekonsiliasi, true), eq(accounts.isActive, true)))
    .orderBy(asc(accounts.kode))
}

/**
 * Menandai sekelompok item jurnal sebagai saling menutup.
 *
 * Kelompok hanya sah bila total debit sama dengan total kredit dan seluruh
 * itemnya berada pada akun yang sama — merekonsiliasi lintas akun akan
 * menyembunyikan saldo yang sebenarnya masih terbuka.
 */
export async function rekonsiliasiDalamTx(
  tx: Transaksi,
  itemIds: string[],
  tanggal: string,
  olehPengguna: string,
  asal: 'manual' | 'otomatis' = 'manual',
): Promise<string> {
  if (itemIds.length < 2) {
    throw new ValidasiError('Rekonsiliasi memerlukan minimal dua item jurnal')
  }

  const item = await tx.select().from(journalItems)
    .where(inArray(journalItems.id, itemIds))

  if (item.length !== itemIds.length) {
    throw new ValidasiError('Sebagian item jurnal tidak ditemukan')
  }

  const sudahDirekonsiliasi = item.find((b) => b.rekonsiliasiId !== null)
  if (sudahDirekonsiliasi) {
    throw new ValidasiError('Sebagian item sudah direkonsiliasi sebelumnya')
  }

  const akunUnik = new Set(item.map((b) => b.accountId))
  if (akunUnik.size > 1) {
    throw new ValidasiError(
      'Seluruh item dalam satu rekonsiliasi harus berada pada akun yang sama.',
    )
  }

  const totalDebit = bulatkan(tambah(...item.map((b) => b.debit)), DESIMAL)
  const totalKredit = bulatkan(tambah(...item.map((b) => b.kredit)), DESIMAL)
  if (Number(kurang(totalDebit, totalKredit)) !== 0) {
    throw new ValidasiError(
      `Rekonsiliasi tidak seimbang: debit ${totalDebit} tidak sama dengan kredit ${totalKredit}.`,
    )
  }

  const [rekonsiliasi] = await tx.insert(reconciliations).values({
    tanggal, asal, dibuatOleh: olehPengguna,
  }).returning({ id: reconciliations.id })

  await tx.update(journalItems)
    .set({ rekonsiliasiId: rekonsiliasi.id })
    .where(inArray(journalItems.id, itemIds))

  return rekonsiliasi.id
}

export async function rekonsiliasi(
  itemIds: string[], tanggal: string, olehPengguna: string,
): Promise<string> {
  return db.transaction((tx) => rekonsiliasiDalamTx(tx, itemIds, tanggal, olehPengguna))
}

export async function batalkanRekonsiliasi(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(journalItems)
      .set({ rekonsiliasiId: null })
      .where(eq(journalItems.rekonsiliasiId, id))
    await tx.delete(reconciliations).where(eq(reconciliations.id, id))
  })
}

/**
 * Merekonsiliasi otomatis item pada satu akun untuk satu mitra bila totalnya
 * sudah saling menutup. Dipanggil setelah pembayaran diposting: bila seluruh
 * tagihan mitra itu lunas, itemnya ditandai selesai sekaligus.
 */
export async function rekonsiliasiOtomatisDalamTx(
  tx: Transaksi,
  akunId: string,
  partnerId: string,
  tanggal: string,
  olehPengguna: string,
): Promise<string | null> {
  const hasil = await tx.execute<{ id: string; debit: string; kredit: string }>(sql`
    SELECT i.id, i.debit::text, i.kredit::text
    FROM journal_items i
    JOIN journal_entries e ON e.id = i.entry_id
    WHERE i.account_id = ${akunId}
      AND i.partner_id = ${partnerId}
      AND i.rekonsiliasi_id IS NULL
      AND e.status = 'diposting'
  `)

  const item = hasil as unknown as { id: string; debit: string; kredit: string }[]
  if (item.length < 2) return null

  const totalDebit = item.reduce((t, b) => t + Number(b.debit), 0)
  const totalKredit = item.reduce((t, b) => t + Number(b.kredit), 0)

  // Hanya menutup bila benar-benar sudah nol; pelunasan sebagian tetap
  // dibiarkan terbuka agar sisanya terlihat.
  if (Math.abs(totalDebit - totalKredit) >= 0.005) return null

  return rekonsiliasiDalamTx(
    tx, item.map((b) => b.id), tanggal, olehPengguna, 'otomatis',
  )
}

export type KelompokRekonsiliasi = {
  id: string
  tanggal: string
  asal: string
  jumlahItem: number
  nilai: Uang
}

export async function daftarRekonsiliasi(): Promise<KelompokRekonsiliasi[]> {
  const hasil = await db.execute<KelompokRekonsiliasi>(sql`
    SELECT r.id, r.tanggal::text AS tanggal, r.asal,
           COUNT(i.id)::int AS "jumlahItem",
           COALESCE(SUM(i.debit), 0)::text AS nilai
    FROM reconciliations r
    LEFT JOIN journal_items i ON i.rekonsiliasi_id = r.id
    GROUP BY r.id, r.tanggal, r.asal
    ORDER BY r.tanggal DESC, r.dibuat_pada DESC
  `)
  return (hasil as unknown as KelompokRekonsiliasi[]).map((b) => ({
    ...b, nilai: Number(b.nilai).toFixed(DESIMAL),
  }))
}
