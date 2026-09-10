import { and, asc, desc, eq, ne } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import {
  owners, ownershipPeriods, ownershipShares, profitPeriods, accounts,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, tambah, type Uang } from '@/lib/uang'
import {
  skemaPemilik, skemaSusunanKepemilikan,
  type MasukanPemilik, type MasukanSusunanKepemilikan,
} from '../validasi/kepemilikan'

const DESIMAL_PERSEN = 4

export type Pemilik = typeof owners.$inferSelect
export type SusunanKepemilikan = typeof ownershipPeriods.$inferSelect
export type PorsiKepemilikan = typeof ownershipShares.$inferSelect

// ── Pemilik ──────────────────────────────────────────────────────────────────

export async function daftarPemilik(
  saring: { hanyaAktif?: boolean } = {},
): Promise<Pemilik[]> {
  const kueri = db.select().from(owners).orderBy(asc(owners.kode))
  return saring.hanyaAktif ? kueri.where(eq(owners.isActive, true)) : kueri
}

/**
 * Akun modal tiap pemilik harus terpisah, karena di situlah hak masing-masing
 * terbaca dari neraca. Dua pemilik yang berbagi satu akun akan membuat porsi
 * keduanya tidak dapat dibedakan lagi setelah diposting.
 */
async function wajibAkunSah(data: MasukanPemilik, kecualiId?: string): Promise<void> {
  const [akunModal] = await db.select().from(accounts)
    .where(eq(accounts.id, data.akunModalId as string)).limit(1)
  if (!akunModal) throw new ValidasiError('Akun modal tidak ditemukan')
  if (akunModal.tipeAkun !== 'ekuitas') {
    throw new ValidasiError(
      `Akun modal harus bertipe Ekuitas; ${akunModal.kode} ${akunModal.nama} bertipe lain.`,
    )
  }

  if (data.akunPriveId) {
    const [akunPrive] = await db.select().from(accounts)
      .where(eq(accounts.id, data.akunPriveId)).limit(1)
    if (!akunPrive) throw new ValidasiError('Akun prive tidak ditemukan')
    if (akunPrive.tipeAkun !== 'ekuitas') {
      throw new ValidasiError('Akun prive harus bertipe Ekuitas')
    }
  }

  const lain = await db.select().from(owners)
  const bentrok = lain.find(
    (o) => o.id !== kecualiId && o.akunModalId === data.akunModalId,
  )
  if (bentrok) {
    throw new ValidasiError(
      `Akun modal itu sudah dipakai pemilik ${bentrok.nama}. ` +
      'Setiap pemilik memerlukan akun modalnya sendiri.',
    )
  }
}

export async function buatPemilik(masukan: MasukanPemilik): Promise<Pemilik> {
  const hasil = skemaPemilik.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  const [ada] = await db.select().from(owners).where(eq(owners.kode, data.kode)).limit(1)
  if (ada) throw new ValidasiError(`Kode pemilik ${data.kode} sudah dipakai`)
  await wajibAkunSah(data)

  const [pemilik] = await db.insert(owners).values(data).returning()
  return pemilik
}

export async function ubahPemilik(id: string, masukan: MasukanPemilik): Promise<Pemilik> {
  const hasil = skemaPemilik.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  const [ada] = await db.select().from(owners)
    .where(and(eq(owners.kode, data.kode), ne(owners.id, id))).limit(1)
  if (ada) throw new ValidasiError(`Kode pemilik ${data.kode} sudah dipakai`)
  await wajibAkunSah(data, id)

  const [pemilik] = await db.update(owners)
    .set({ ...data, diubahPada: new Date() })
    .where(eq(owners.id, id)).returning()
  if (!pemilik) throw new ValidasiError('Pemilik tidak ditemukan')
  return pemilik
}

/**
 * Pemilik dinonaktifkan, tidak dihapus — porsi yang pernah dibagikan
 * kepadanya beserta jurnalnya harus tetap dapat ditelusuri.
 */
export async function ubahStatusPemilik(id: string, isActive: boolean): Promise<void> {
  const [pemilik] = await db.select().from(owners).where(eq(owners.id, id)).limit(1)
  if (!pemilik) throw new ValidasiError('Pemilik tidak ditemukan')

  if (!isActive) {
    const [terpakai] = await db.select({ id: ownershipShares.id }).from(ownershipShares)
      .innerJoin(ownershipPeriods, eq(ownershipPeriods.id, ownershipShares.periodeId))
      .where(and(
        eq(ownershipShares.ownerId, id),
        eq(ownershipPeriods.tanggalSelesai, null as never),
      )).limit(1)
    if (terpakai) {
      throw new ValidasiError(
        `${pemilik.nama} masih tercantum pada susunan kepemilikan yang berlaku.`,
      )
    }
  }

  await db.update(owners)
    .set({ isActive, diubahPada: new Date() })
    .where(eq(owners.id, id))
}

// ── Susunan kepemilikan ─────────────────────────────────────────────────────

export type SusunanLengkap = SusunanKepemilikan & {
  porsi: (PorsiKepemilikan & { kodePemilik: string; namaPemilik: string })[]
  totalPersentase: Uang
}

export async function daftarSusunan(): Promise<SusunanLengkap[]> {
  const susunan = await db.select().from(ownershipPeriods)
    .orderBy(desc(ownershipPeriods.tanggalMulai))
  if (susunan.length === 0) return []

  const porsi = await db
    .select({
      porsi: ownershipShares,
      kodePemilik: owners.kode,
      namaPemilik: owners.nama,
    })
    .from(ownershipShares)
    .innerJoin(owners, eq(owners.id, ownershipShares.ownerId))
    .orderBy(asc(owners.kode))

  return susunan.map((s) => {
    const miliknya = porsi
      .filter((p) => p.porsi.periodeId === s.id)
      .map((p) => ({ ...p.porsi, kodePemilik: p.kodePemilik, namaPemilik: p.namaPemilik }))
    return {
      ...s,
      porsi: miliknya,
      totalPersentase: bulatkan(
        tambah(...(miliknya.length > 0 ? miliknya.map((p) => p.persentase) : ['0'])),
        DESIMAL_PERSEN,
      ),
    }
  })
}

/**
 * Susunan kepemilikan yang berlaku pada sebuah tanggal.
 *
 * Yang dipakai adalah susunan dengan tanggal mulai terbaru yang belum
 * melewati tanggal itu; susunan berikutnya menggantikannya dengan sendirinya
 * tanpa perlu menutup yang lama.
 */
export async function susunanBerlakuDalamTx(
  tx: Transaksi, tanggal: string,
): Promise<{ periodeId: string; porsi: { ownerId: string; persentase: Uang }[] } | null> {
  const kandidat = await tx.select().from(ownershipPeriods)
    .orderBy(desc(ownershipPeriods.tanggalMulai))

  const berlaku = kandidat.find(
    (s) => s.tanggalMulai <= tanggal
      && (s.tanggalSelesai === null || s.tanggalSelesai >= tanggal),
  )
  if (!berlaku) return null

  const porsi = await tx.select().from(ownershipShares)
    .where(eq(ownershipShares.periodeId, berlaku.id))

  return {
    periodeId: berlaku.id,
    porsi: porsi.map((p) => ({ ownerId: p.ownerId, persentase: p.persentase })),
  }
}

function uraiSusunan(masukan: MasukanSusunanKepemilikan) {
  const hasil = skemaSusunanKepemilikan.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

/**
 * Total persentase wajib tepat seratus. Susunan yang berjumlah kurang atau
 * lebih akan membagi laba yang bukan seratus persen laba periode itu, dan
 * selisihnya tidak akan pernah punya pemilik.
 */
function wajibSeratusPersen(porsi: { ownerId: string; persentase: string }[]): void {
  const total = bulatkan(tambah(...porsi.map((p) => p.persentase)), DESIMAL_PERSEN)
  if (Number(total) !== 100) {
    throw new ValidasiError(
      `Susunan kepemilikan harus berjumlah tepat 100%, saat ini ${Number(total)}%.`,
    )
  }
  if (new Set(porsi.map((p) => p.ownerId)).size !== porsi.length) {
    throw new ValidasiError('Satu pemilik hanya boleh muncul sekali dalam satu susunan')
  }
}

/**
 * Susunan yang sudah dipakai membagi laba tidak boleh berubah maupun dihapus:
 * angkanya sudah terposting ke akun modal masing-masing pemilik, dan mengubah
 * persentasenya akan membuat catatan pembagian tidak lagi cocok dengan
 * jurnalnya.
 */
async function wajibBelumDipakaiBagiHasil(susunanId: string): Promise<void> {
  const [terpakai] = await db.select({ kode: profitPeriods.kode }).from(profitPeriods)
    .where(eq(profitPeriods.ownershipPeriodId, susunanId)).limit(1)
  if (terpakai) {
    throw new ValidasiError(
      `Susunan ini sudah dipakai membagi laba periode ${terpakai.kode}. ` +
      'Buka kunci periode itu terlebih dahulu bila susunannya memang keliru.',
    )
  }
}

export async function buatSusunan(
  masukan: MasukanSusunanKepemilikan,
): Promise<SusunanKepemilikan> {
  const data = uraiSusunan(masukan)
  wajibSeratusPersen(data.porsi)

  return db.transaction(async (tx) => {
    const [susunan] = await tx.insert(ownershipPeriods).values({
      nama: data.nama,
      tanggalMulai: data.tanggalMulai,
      tanggalSelesai: data.tanggalSelesai,
      catatan: data.catatan,
    }).returning()

    await tx.insert(ownershipShares).values(
      data.porsi.map((p) => ({
        periodeId: susunan.id,
        ownerId: p.ownerId,
        persentase: p.persentase,
      })),
    )

    return susunan
  })
}

export async function ubahSusunan(
  id: string, masukan: MasukanSusunanKepemilikan,
): Promise<SusunanKepemilikan> {
  const data = uraiSusunan(masukan)
  wajibSeratusPersen(data.porsi)

  await wajibBelumDipakaiBagiHasil(id)

  return db.transaction(async (tx) => {
    const [susunan] = await tx.update(ownershipPeriods).set({
      nama: data.nama,
      tanggalMulai: data.tanggalMulai,
      tanggalSelesai: data.tanggalSelesai,
      catatan: data.catatan,
    }).where(eq(ownershipPeriods.id, id)).returning()
    if (!susunan) throw new ValidasiError('Susunan kepemilikan tidak ditemukan')

    await tx.delete(ownershipShares).where(eq(ownershipShares.periodeId, id))
    await tx.insert(ownershipShares).values(
      data.porsi.map((p) => ({
        periodeId: id,
        ownerId: p.ownerId,
        persentase: p.persentase,
      })),
    )

    return susunan
  })
}

export async function hapusSusunan(id: string): Promise<void> {
  const [susunan] = await db.select().from(ownershipPeriods)
    .where(eq(ownershipPeriods.id, id)).limit(1)
  if (!susunan) throw new ValidasiError('Susunan kepemilikan tidak ditemukan')
  await wajibBelumDipakaiBagiHasil(id)
  await db.delete(ownershipPeriods).where(eq(ownershipPeriods.id, id))
}
