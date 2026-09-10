import { and, asc, eq, gte, inArray, lte, ne } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import {
  costCenters, journalItemCostAllocations, locationCostCenters,
  journalItems, journalEntries, accounts, locations,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bagi, bulatkan, kali, kurang, tambah, type Uang } from '@/lib/uang'
import {
  skemaPosBiaya, skemaAlokasiBiaya,
  type MasukanPosBiaya, type MasukanAlokasiBiaya,
} from '../validasi/pos-biaya'

const DESIMAL = 2
const DESIMAL_PERSEN = 4

export type PosBiaya = typeof costCenters.$inferSelect

// ── Master pos biaya ─────────────────────────────────────────────────────────

export async function daftarPosBiaya(
  saring: { hanyaAktif?: boolean } = {},
): Promise<PosBiaya[]> {
  const kueri = db.select().from(costCenters).orderBy(asc(costCenters.kode))
  return saring.hanyaAktif ? kueri.where(eq(costCenters.isActive, true)) : kueri
}

export async function buatPosBiaya(masukan: MasukanPosBiaya): Promise<PosBiaya> {
  const hasil = skemaPosBiaya.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  const [ada] = await db.select().from(costCenters)
    .where(eq(costCenters.kode, data.kode)).limit(1)
  if (ada) throw new ValidasiError(`Kode pos biaya ${data.kode} sudah dipakai`)

  const [pos] = await db.insert(costCenters).values(data).returning()
  return pos
}

export async function ubahPosBiaya(
  id: string, masukan: MasukanPosBiaya,
): Promise<PosBiaya> {
  const hasil = skemaPosBiaya.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  const [ada] = await db.select().from(costCenters)
    .where(and(eq(costCenters.kode, data.kode), ne(costCenters.id, id))).limit(1)
  if (ada) throw new ValidasiError(`Kode pos biaya ${data.kode} sudah dipakai`)

  const [pos] = await db.update(costCenters)
    .set({ ...data, diubahPada: new Date() })
    .where(eq(costCenters.id, id)).returning()
  if (!pos) throw new ValidasiError('Pos biaya tidak ditemukan')
  return pos
}

/**
 * Pos biaya dinonaktifkan, tidak dihapus — beban yang sudah dialokasikan
 * kepadanya harus tetap dapat ditelusuri di laporan periode lampau.
 */
export async function ubahStatusPosBiaya(id: string, isActive: boolean): Promise<void> {
  const [pos] = await db.select().from(costCenters).where(eq(costCenters.id, id)).limit(1)
  if (!pos) throw new ValidasiError('Pos biaya tidak ditemukan')
  await db.update(costCenters)
    .set({ isActive, diubahPada: new Date() })
    .where(eq(costCenters.id, id))
}

// ── Alokasi pada item jurnal ────────────────────────────────────────────────

export type AlokasiTerhitung = {
  costCenterId: string
  persentase: Uang
  nilai: Uang
}

/**
 * Membagi nilai sebuah item jurnal menurut persentase yang diminta.
 *
 * Baris terakhir menyerap sisa pembulatan supaya jumlah seluruh bagian persis
 * sama dengan nilai itemnya. Tanpa itu, laporan per pos biaya tidak akan
 * pernah menjumlah tepat ke laba rugi keseluruhan.
 */
export function hitungAlokasi(
  nilaiItem: Uang, alokasi: { costCenterId: string; persentase: Uang }[],
): AlokasiTerhitung[] {
  if (alokasi.length === 0) return []

  const total = bulatkan(tambah(...alokasi.map((a) => a.persentase)), DESIMAL_PERSEN)
  if (Number(total) !== 100) {
    throw new ValidasiError(
      `Alokasi pos biaya harus berjumlah tepat 100%, saat ini ${Number(total)}%.`,
    )
  }

  const unik = new Set(alokasi.map((a) => a.costCenterId))
  if (unik.size !== alokasi.length) {
    throw new ValidasiError('Satu pos biaya hanya boleh muncul sekali dalam satu baris')
  }

  const hasil: AlokasiTerhitung[] = []
  let terpakai = '0'

  alokasi.forEach((a, i) => {
    const terakhir = i === alokasi.length - 1
    const nilai = terakhir
      ? bulatkan(kurang(nilaiItem, terpakai), DESIMAL)
      : bulatkan(kali(nilaiItem, bagi(a.persentase, '100')), DESIMAL)
    terpakai = bulatkan(tambah(terpakai, nilai), DESIMAL)
    hasil.push({
      costCenterId: a.costCenterId,
      persentase: bulatkan(a.persentase, DESIMAL_PERSEN),
      nilai,
    })
  })

  return hasil
}

/** Nilai rupiah sebuah item jurnal, tanpa memandang sisi debit atau kredit. */
function nilaiItem(item: { debit: string; kredit: string }): Uang {
  return bulatkan(
    Number(item.debit) > 0 ? item.debit : item.kredit, DESIMAL,
  )
}

/**
 * Menyimpan alokasi pos biaya untuk sekumpulan item jurnal yang baru ditulis.
 *
 * Hanya akun laba rugi yang boleh dialokasikan; membebankan kas atau utang ke
 * sebuah unit kerja tidak punya arti dan hanya akan mengotori laporannya.
 */
export async function simpanAlokasiDalamTx(
  tx: Transaksi,
  baris: {
    itemId: string
    accountId: string
    debit: string
    kredit: string
    alokasiBiaya?: MasukanAlokasiBiaya[] | null
  }[],
): Promise<void> {
  const berisi = baris.filter((b) => (b.alokasiBiaya?.length ?? 0) > 0)
  if (berisi.length === 0) return

  const idAkun = [...new Set(berisi.map((b) => b.accountId))]
  const daftarAkun = await tx.select().from(accounts).where(inArray(accounts.id, idAkun))
  const akunLewatId = new Map(daftarAkun.map((a) => [a.id, a]))

  const idPos = [...new Set(
    berisi.flatMap((b) => b.alokasiBiaya!.map((a) => a.costCenterId)),
  )]
  const daftarPos = await tx.select().from(costCenters)
    .where(inArray(costCenters.id, idPos))
  const posLewatId = new Map(daftarPos.map((p) => [p.id, p]))

  const nilaiSisip: (typeof journalItemCostAllocations.$inferInsert)[] = []

  for (const b of berisi) {
    const akun = akunLewatId.get(b.accountId)
    if (!akun) throw new ValidasiError('Akun pada baris jurnal tidak ditemukan')
    const laporanLabaRugi = akun.tipeAkun.startsWith('beban_')
      || akun.tipeAkun.startsWith('pendapatan')
    if (!laporanLabaRugi) {
      throw new ValidasiError(
        `Pos biaya hanya dapat dibebankan pada akun laba rugi; ` +
        `${akun.kode} ${akun.nama} bukan akun laba rugi.`,
      )
    }

    for (const a of b.alokasiBiaya!) {
      const hasil = skemaAlokasiBiaya.safeParse(a)
      if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
      const pos = posLewatId.get(a.costCenterId)
      if (!pos) throw new ValidasiError('Pos biaya tidak ditemukan')
      if (!pos.isActive) {
        throw new ValidasiError(`Pos biaya ${pos.nama} sudah nonaktif`)
      }
    }

    const terhitung = hitungAlokasi(nilaiItem(b), b.alokasiBiaya!)
    for (const t of terhitung) {
      nilaiSisip.push({
        itemId: b.itemId,
        costCenterId: t.costCenterId,
        persentase: t.persentase,
        nilai: t.nilai,
      })
    }
  }

  if (nilaiSisip.length > 0) {
    await tx.insert(journalItemCostAllocations).values(nilaiSisip)
  }
}

/** Membuang alokasi lama sebuah entri, dipakai saat draft diubah. */
export async function hapusAlokasiEntriDalamTx(tx: Transaksi, entryId: string): Promise<void> {
  const item = await tx.select({ id: journalItems.id }).from(journalItems)
    .where(eq(journalItems.entryId, entryId))
  if (item.length === 0) return
  await tx.delete(journalItemCostAllocations)
    .where(inArray(journalItemCostAllocations.itemId, item.map((i) => i.id)))
}

export async function alokasiEntri(entryId: string) {
  return db
    .select({
      itemId: journalItemCostAllocations.itemId,
      costCenterId: journalItemCostAllocations.costCenterId,
      kodePos: costCenters.kode,
      namaPos: costCenters.nama,
      persentase: journalItemCostAllocations.persentase,
      nilai: journalItemCostAllocations.nilai,
    })
    .from(journalItemCostAllocations)
    .innerJoin(journalItems, eq(journalItems.id, journalItemCostAllocations.itemId))
    .innerJoin(costCenters, eq(costCenters.id, journalItemCostAllocations.costCenterId))
    .where(eq(journalItems.entryId, entryId))
}

// ── Pos biaya bawaan per lokasi ─────────────────────────────────────────────

export async function daftarPosBawaanLokasi() {
  return db
    .select({
      lokasiId: locationCostCenters.lokasiId,
      kodeLokasi: locations.kode,
      namaLokasi: locations.nama,
      costCenterId: locationCostCenters.costCenterId,
      kodePos: costCenters.kode,
      namaPos: costCenters.nama,
    })
    .from(locationCostCenters)
    .innerJoin(locations, eq(locations.id, locationCostCenters.lokasiId))
    .innerJoin(costCenters, eq(costCenters.id, locationCostCenters.costCenterId))
    .orderBy(asc(locations.kode))
}

export async function aturPosBawaanLokasi(
  lokasiId: string, costCenterId: string | null,
): Promise<void> {
  await db.delete(locationCostCenters).where(eq(locationCostCenters.lokasiId, lokasiId))
  if (costCenterId) {
    await db.insert(locationCostCenters).values({ lokasiId, costCenterId })
  }
}

/** Pos biaya bawaan sebuah lokasi, dipakai posting otomatis modul gudang. */
export async function posBawaanLokasiDalamTx(
  tx: Transaksi, lokasiId: string,
): Promise<string | null> {
  const [baris] = await tx.select().from(locationCostCenters)
    .where(eq(locationCostCenters.lokasiId, lokasiId)).limit(1)
  if (!baris) return null

  const [pos] = await tx.select().from(costCenters)
    .where(eq(costCenters.id, baris.costCenterId)).limit(1)
  return pos?.isActive ? pos.id : null
}

// ── Laporan ─────────────────────────────────────────────────────────────────

export type BarisLabaRugiPos = {
  costCenterId: string | null
  kode: string
  nama: string
  pendapatan: Uang
  beban: Uang
  laba: Uang
}

/**
 * Laba rugi per pos biaya untuk sebuah periode.
 *
 * Baris terakhir memuat yang belum dialokasikan. Membiarkannya terlihat lebih
 * jujur daripada membaginya rata: angka itu adalah pekerjaan yang belum
 * dilakukan, bukan biaya yang benar-benar tersebar.
 */
export async function labaRugiPerPos(
  dari: string, sampai: string,
): Promise<BarisLabaRugiPos[]> {
  const item = await db
    .select({
      itemId: journalItems.id,
      debit: journalItems.debit,
      kredit: journalItems.kredit,
      tipeAkun: accounts.tipeAkun,
    })
    .from(journalItems)
    .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
    .innerJoin(accounts, eq(accounts.id, journalItems.accountId))
    .where(and(
      eq(journalEntries.status, 'diposting'),
      gte(journalEntries.tanggal, dari),
      lte(journalEntries.tanggal, sampai),
      // Hanya akun laba rugi yang punya arti bagi pos biaya.
      inArray(accounts.tipeAkun, [
        'pendapatan', 'pendapatan_lain',
        'beban_hpp', 'beban_operasional', 'beban_depresiasi',
        'beban_lain', 'beban_pajak',
      ]),
    ))

  const idItem = item.map((i) => i.itemId)
  const alokasi = idItem.length > 0
    ? await db
        .select({
          itemId: journalItemCostAllocations.itemId,
          costCenterId: journalItemCostAllocations.costCenterId,
          nilai: journalItemCostAllocations.nilai,
        })
        .from(journalItemCostAllocations)
        .where(inArray(journalItemCostAllocations.itemId, idItem))
    : []

  const pos = await daftarPosBiaya()
  const ember = new Map<string | null, { pendapatan: string; beban: string }>()
  for (const p of pos) ember.set(p.id, { pendapatan: '0', beban: '0' })
  ember.set(null, { pendapatan: '0', beban: '0' })

  const alokasiLewatItem = new Map<string, typeof alokasi>()
  for (const a of alokasi) {
    alokasiLewatItem.set(a.itemId, [...(alokasiLewatItem.get(a.itemId) ?? []), a])
  }

  for (const i of item) {
    const pendapatanAkun = i.tipeAkun.startsWith('pendapatan')
    // Pendapatan bersaldo kredit, beban bersaldo debit.
    const nilai = pendapatanAkun
      ? kurang(i.kredit, i.debit)
      : kurang(i.debit, i.kredit)

    const bagian = alokasiLewatItem.get(i.itemId)
    if (!bagian || bagian.length === 0) {
      const e = ember.get(null)!
      if (pendapatanAkun) e.pendapatan = tambah(e.pendapatan, nilai)
      else e.beban = tambah(e.beban, nilai)
      continue
    }

    // Nilai alokasi selalu positif; tandanya mengikuti arah item aslinya.
    const arahNegatif = Number(nilai) < 0
    for (const b of bagian) {
      const e = ember.get(b.costCenterId) ?? { pendapatan: '0', beban: '0' }
      const n = arahNegatif ? kali(b.nilai, '-1') : b.nilai
      if (pendapatanAkun) e.pendapatan = tambah(e.pendapatan, n)
      else e.beban = tambah(e.beban, n)
      ember.set(b.costCenterId, e)
    }
  }

  const namaPos = new Map(pos.map((p) => [p.id, p]))
  const hasil: BarisLabaRugiPos[] = []

  for (const [id, nilai] of ember) {
    const pendapatan = bulatkan(nilai.pendapatan, DESIMAL)
    const beban = bulatkan(nilai.beban, DESIMAL)
    if (id === null && Number(pendapatan) === 0 && Number(beban) === 0) continue

    hasil.push({
      costCenterId: id,
      kode: id ? namaPos.get(id)?.kode ?? '—' : '—',
      nama: id ? namaPos.get(id)?.nama ?? '—' : 'Belum dialokasikan',
      pendapatan,
      beban,
      laba: bulatkan(kurang(pendapatan, beban), DESIMAL),
    })
  }

  return hasil.sort((a, b) => {
    if (a.costCenterId === null) return 1
    if (b.costCenterId === null) return -1
    return a.kode.localeCompare(b.kode)
  })
}
