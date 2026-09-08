import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import { accounts, journalEntries, journalItems, partners } from '@/db/schema'
import type { Uang } from '@/lib/uang'

export type TipeAkun = typeof accounts.$inferSelect['tipeAkun']

export type SaldoAkun = {
  akunId: string
  kode: string
  nama: string
  tipeAkun: TipeAkun
  debit: Uang
  kredit: Uang
  /** debit − kredit; positif berarti bersaldo debit. */
  saldo: Uang
}

/**
 * Hanya entri berstatus 'diposting' yang masuk laporan. Seluruh agregasi
 * dilakukan di SQL, bukan dengan iterasi di aplikasi, dan nilai numeric
 * dikembalikan sebagai string agar presisi tidak hilang.
 */
const HANYA_DIPOSTING = eq(journalEntries.status, 'diposting')

function rentang(dariIso?: string, sampaiIso?: string) {
  const syarat = [HANYA_DIPOSTING]
  if (dariIso) syarat.push(gte(journalEntries.tanggal, dariIso))
  if (sampaiIso) syarat.push(lte(journalEntries.tanggal, sampaiIso))
  return and(...syarat)
}

/** Mutasi per akun dalam rentang tanggal. */
export async function mutasiPerAkun(dariIso?: string, sampaiIso?: string): Promise<SaldoAkun[]> {
  const baris = await db
    .select({
      akunId: accounts.id,
      kode: accounts.kode,
      nama: accounts.nama,
      tipeAkun: accounts.tipeAkun,
      debit: sql<string>`COALESCE(SUM(${journalItems.debit}), 0)::text`,
      kredit: sql<string>`COALESCE(SUM(${journalItems.kredit}), 0)::text`,
    })
    .from(accounts)
    .leftJoin(journalItems, eq(journalItems.accountId, accounts.id))
    .leftJoin(
      journalEntries,
      and(eq(journalEntries.id, journalItems.entryId), rentang(dariIso, sampaiIso)),
    )
    .where(sql`${journalEntries.id} IS NOT NULL OR ${journalItems.id} IS NULL`)
    .groupBy(accounts.id, accounts.kode, accounts.nama, accounts.tipeAkun)
    .orderBy(asc(accounts.kode))

  return baris.map((b) => ({
    ...b,
    saldo: (Number(b.debit) - Number(b.kredit)).toFixed(2),
    debit: Number(b.debit).toFixed(2),
    kredit: Number(b.kredit).toFixed(2),
  }))
}

/** Saldo kumulatif per akun sampai tanggal tertentu. */
export async function saldoPerAkun(sampaiIso: string): Promise<SaldoAkun[]> {
  return mutasiPerAkun(undefined, sampaiIso)
}

export type BarisBukuBesar = {
  entryId: string
  nomor: string | null
  tanggal: string
  jurnalKode: string
  label: string
  namaPartner: string | null
  debit: Uang
  kredit: Uang
}

export async function itemPerAkun(
  akunId: string, dariIso?: string, sampaiIso?: string,
): Promise<BarisBukuBesar[]> {
  const baris = await db
    .select({
      entryId: journalEntries.id,
      nomor: journalEntries.nomor,
      tanggal: journalEntries.tanggal,
      jurnalKode: sql<string>`(SELECT kode FROM journals WHERE id = ${journalEntries.journalId})`,
      label: journalItems.label,
      namaPartner: partners.nama,
      debit: sql<string>`${journalItems.debit}::text`,
      kredit: sql<string>`${journalItems.kredit}::text`,
    })
    .from(journalItems)
    .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
    .leftJoin(partners, eq(partners.id, journalItems.partnerId))
    .where(and(eq(journalItems.accountId, akunId), rentang(dariIso, sampaiIso)))
    .orderBy(asc(journalEntries.tanggal), asc(journalEntries.nomor), asc(journalItems.urutan))

  return baris.map((b) => ({
    ...b,
    debit: Number(b.debit).toFixed(2),
    kredit: Number(b.kredit).toFixed(2),
  }))
}

export type SaldoPartner = {
  partnerId: string
  kode: string
  nama: string
  debit: Uang
  kredit: Uang
  saldo: Uang
}

/** Saldo per mitra usaha untuk tipe akun tertentu (piutang atau utang). */
export async function saldoPerPartner(
  tipeAkun: TipeAkun[], sampaiIso: string,
): Promise<SaldoPartner[]> {
  const baris = await db
    .select({
      partnerId: partners.id,
      kode: partners.kode,
      nama: partners.nama,
      debit: sql<string>`COALESCE(SUM(${journalItems.debit}), 0)::text`,
      kredit: sql<string>`COALESCE(SUM(${journalItems.kredit}), 0)::text`,
    })
    .from(journalItems)
    .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
    .innerJoin(accounts, eq(accounts.id, journalItems.accountId))
    .innerJoin(partners, eq(partners.id, journalItems.partnerId))
    .where(and(
      rentang(undefined, sampaiIso),
      sql`${accounts.tipeAkun} IN ${tipeAkun}`,
    ))
    .groupBy(partners.id, partners.kode, partners.nama)
    .orderBy(asc(partners.nama))

  return baris
    .map((b) => ({
      ...b,
      debit: Number(b.debit).toFixed(2),
      kredit: Number(b.kredit).toFixed(2),
      saldo: (Number(b.debit) - Number(b.kredit)).toFixed(2),
    }))
    .filter((b) => Number(b.saldo) !== 0)
}

export type BarisUmur = SaldoPartner & {
  ember: { '0-30': Uang; '31-60': Uang; '61-90': Uang; '90+': Uang }
}

/** Pengelompokan saldo mitra per rentang umur dihitung dari tanggal entri. */
export async function umurPerPartner(
  tipeAkun: TipeAkun[], sampaiIso: string,
): Promise<BarisUmur[]> {
  const baris = await db
    .select({
      partnerId: partners.id,
      kode: partners.kode,
      nama: partners.nama,
      umurHari: sql<number>`(${sampaiIso}::date - ${journalEntries.tanggal})::int`,
      nilai: sql<string>`(${journalItems.debit} - ${journalItems.kredit})::text`,
    })
    .from(journalItems)
    .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
    .innerJoin(accounts, eq(accounts.id, journalItems.accountId))
    .innerJoin(partners, eq(partners.id, journalItems.partnerId))
    .where(and(
      rentang(undefined, sampaiIso),
      sql`${accounts.tipeAkun} IN ${tipeAkun}`,
    ))

  const terkumpul = new Map<string, BarisUmur>()

  for (const b of baris) {
    const sudahAda = terkumpul.get(b.partnerId) ?? {
      partnerId: b.partnerId, kode: b.kode, nama: b.nama,
      debit: '0.00', kredit: '0.00', saldo: '0.00',
      ember: { '0-30': '0.00', '31-60': '0.00', '61-90': '0.00', '90+': '0.00' },
    }

    const nilai = Number(b.nilai)
    const kunci = b.umurHari <= 30 ? '0-30'
      : b.umurHari <= 60 ? '31-60'
      : b.umurHari <= 90 ? '61-90'
      : '90+'

    sudahAda.ember[kunci] = (Number(sudahAda.ember[kunci]) + nilai).toFixed(2)
    sudahAda.saldo = (Number(sudahAda.saldo) + nilai).toFixed(2)
    terkumpul.set(b.partnerId, sudahAda)
  }

  return [...terkumpul.values()]
    .filter((b) => Number(b.saldo) !== 0)
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}

export type BarisPajak = {
  kodePajak: string
  namaPajak: string
  ruangLingkup: 'penjualan' | 'pembelian'
  dasar: Uang
  pajak: Uang
}

export async function rekapPajak(dariIso: string, sampaiIso: string): Promise<BarisPajak[]> {
  const baris = await db
    .select({
      kodePajak: sql<string>`(SELECT kode FROM taxes WHERE id = ${journalItems.taxId})`,
      namaPajak: sql<string>`(SELECT nama FROM taxes WHERE id = ${journalItems.taxId})`,
      ruangLingkup: sql<'penjualan' | 'pembelian'>`(SELECT ruang_lingkup FROM taxes WHERE id = ${journalItems.taxId})`,
      pajak: sql<string>`COALESCE(SUM(ABS(${journalItems.debit} - ${journalItems.kredit})), 0)::text`,
    })
    .from(journalItems)
    .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
    .where(and(rentang(dariIso, sampaiIso), sql`${journalItems.taxId} IS NOT NULL`))
    .groupBy(journalItems.taxId)

  return baris.map((b) => ({
    ...b,
    pajak: Number(b.pajak).toFixed(2),
    // Dasar pengenaan tidak tersimpan di item jurnal pada Fase 1B; ia baru
    // tersedia saat faktur dan tagihan dibangun pada Fase 3 dan 4.
    dasar: '0.00',
  }))
}
