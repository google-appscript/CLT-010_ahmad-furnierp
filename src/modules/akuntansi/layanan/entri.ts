import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import {
  journalEntries, journalItems, journals, companySettings, projects,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, kurang, samaDengan, tambah, type Uang } from '@/lib/uang'
import { skemaEntri, type MasukanEntri } from '../validasi/entri'
import { ambilNomorBerikut } from './urutan'
import { PeriodeTerkunciError, formatTanggalIndonesia } from './penguncian'
import { ambilKurs, MATA_UANG_FUNGSIONAL } from './kurs'
import { kodeUrutanJurnal } from './jurnal'
import { simpanAlokasiDalamTx, hapusAlokasiEntriDalamTx } from './pos-biaya'

export type Entri = typeof journalEntries.$inferSelect
export type ItemEntri = typeof journalItems.$inferSelect
export type EntriLengkap = Entri & { item: ItemEntri[] }

const DESIMAL_IDR = 2

// ── Pembantu ─────────────────────────────────────────────────────────────────

function keTanggal(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function keHariUtc(tanggal: Date): number {
  return Date.UTC(tanggal.getUTCFullYear(), tanggal.getUTCMonth(), tanggal.getUTCDate())
}

/**
 * Memeriksa penguncian periode di dalam transaksi yang sedang berjalan,
 * bukan lewat koneksi terpisah, agar pemeriksaan dan penulisan melihat
 * keadaan yang sama.
 */
async function wajibPeriodeTerbukaDalamTx(tx: Transaksi, tanggalIso: string): Promise<void> {
  const [pengaturan] = await tx.select().from(companySettings).limit(1)
  if (!pengaturan?.tanggalKunciBuku) return
  const kunci = keTanggal(pengaturan.tanggalKunciBuku)
  if (keHariUtc(keTanggal(tanggalIso)) <= keHariUtc(kunci)) {
    throw new PeriodeTerkunciError(kunci)
  }
}

function jumlahkan(item: { debit: string; kredit: string }[]): { debit: Uang; kredit: Uang } {
  return {
    debit: bulatkan(tambah(...item.map((b) => b.debit)), DESIMAL_IDR),
    kredit: bulatkan(tambah(...item.map((b) => b.kredit)), DESIMAL_IDR),
  }
}

/**
 * Menolak penanda proyek yang job costing-nya sudah dikunci.
 *
 * Proyek dikunci setelah pekerjaannya selesai dan fakturnya lunas, dan
 * angkanya dibekukan saat itu. Membiarkan biaya baru masuk sesudahnya akan
 * membuat buku besar dan laporan proyek bercerita berbeda — laporan memakai
 * snapshot, sedangkan jurnal terus bertambah.
 */
async function wajibProyekTerbukaDalamTx(
  tx: Transaksi, item: { projectId?: string | null }[],
): Promise<void> {
  const idProyek = [...new Set(
    item.map((b) => b.projectId).filter((x): x is string => Boolean(x)),
  )]
  if (idProyek.length === 0) return

  const terkunci = await tx.select({ kode: projects.kode }).from(projects)
    .where(and(inArray(projects.id, idProyek), eq(projects.status, 'terkunci')))

  if (terkunci.length > 0) {
    throw new ValidasiError(
      `Proyek ${terkunci.map((p) => p.kode).join(', ')} sudah dikunci sehingga tidak dapat ` +
      'lagi dibebani biaya baru. Buka kuncinya terlebih dahulu bila koreksi memang perlu.',
    )
  }
}

/**
 * Menyimpan alokasi pos biaya setelah item jurnalnya tertulis.
 *
 * Item dicocokkan lewat urutan, bukan dicari ulang, karena nomor urutnya
 * memang ditetapkan dari posisi baris masukan.
 */
async function simpanAlokasiTerhadapItem(
  tx: Transaksi,
  entryId: string,
  masukan: {
    accountId: string
    debit: string
    kredit: string
    alokasiBiaya?: { costCenterId: string; persentase: string }[]
  }[],
): Promise<void> {
  if (!masukan.some((b) => (b.alokasiBiaya?.length ?? 0) > 0)) return

  const tertulis = await tx.select({ id: journalItems.id, urutan: journalItems.urutan })
    .from(journalItems).where(eq(journalItems.entryId, entryId))
  const lewatUrutan = new Map(tertulis.map((i) => [i.urutan, i.id]))

  await simpanAlokasiDalamTx(tx, masukan.map((b, i) => ({
    itemId: lewatUrutan.get(i + 1)!,
    accountId: b.accountId,
    debit: b.debit,
    kredit: b.kredit,
    alokasiBiaya: b.alokasiBiaya,
  })))
}

function wajibSeimbang(item: { debit: string; kredit: string }[]): void {
  const { debit, kredit } = jumlahkan(item)
  if (!samaDengan(debit, kredit)) {
    throw new ValidasiError(
      `Entri tidak seimbang: total debit ${debit} tidak sama dengan total kredit ${kredit} ` +
      `(selisih ${kurang(debit, kredit)}).`,
    )
  }
}

function urai(masukan: MasukanEntri) {
  const hasil = skemaEntri.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

// ── Pembacaan ────────────────────────────────────────────────────────────────

export async function daftarEntri(saring: { status?: Entri['status'] } = {}): Promise<Entri[]> {
  const kueri = db.select().from(journalEntries)
    .orderBy(desc(journalEntries.tanggal), desc(journalEntries.dibuatPada))
  return saring.status ? kueri.where(eq(journalEntries.status, saring.status)) : kueri
}

export async function ambilEntri(id: string): Promise<EntriLengkap | null> {
  const [entri] = await db.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1)
  if (!entri) return null
  const item = await db.select().from(journalItems)
    .where(eq(journalItems.entryId, id))
    .orderBy(asc(journalItems.urutan))
  return { ...entri, item }
}

// ── Penulisan ────────────────────────────────────────────────────────────────

/**
 * Membuat entri berstatus draft. Draft belum bernomor dan belum masuk laporan,
 * tetapi keseimbangan tetap diperiksa agar kesalahan ketahuan sedini mungkin.
 */
export async function buatEntri(masukan: MasukanEntri, dibuatOleh: string): Promise<EntriLengkap> {
  const data = urai(masukan)
  wajibSeimbang(data.item)

  const [jurnal] = await db.select().from(journals).where(eq(journals.id, data.journalId)).limit(1)
  if (!jurnal) throw new ValidasiError('Jurnal tidak ditemukan')
  if (!jurnal.isActive) throw new ValidasiError(`Jurnal ${jurnal.nama} sudah nonaktif`)

  const kurs = await ambilKurs(data.mataUangId, keTanggal(data.tanggal))

  const id = await db.transaction(async (tx) => {
    await wajibPeriodeTerbukaDalamTx(tx, data.tanggal)

    const [entri] = await tx.insert(journalEntries).values({
      journalId: data.journalId,
      tanggal: data.tanggal,
      referensi: data.referensi,
      keterangan: data.keterangan,
      status: 'draft',
      mataUangId: data.mataUangId,
      kurs,
      partnerId: data.partnerId,
      dibuatOleh,
    }).returning({ id: journalEntries.id })

    await tx.insert(journalItems).values(
      data.item.map((b, i) => ({
        entryId: entri.id,
        urutan: i + 1,
        accountId: b.accountId,
        partnerId: b.partnerId,
        label: b.label,
        debit: bulatkan(b.debit, DESIMAL_IDR),
        kredit: bulatkan(b.kredit, DESIMAL_IDR),
        nilaiMataUang: b.nilaiMataUang,
        mataUangId: data.mataUangId === MATA_UANG_FUNGSIONAL ? null : data.mataUangId,
        taxId: b.taxId,
        projectId: b.projectId,
      })),
    )

    await simpanAlokasiTerhadapItem(tx, entri.id, data.item)

    return entri.id
  })

  return (await ambilEntri(id))!
}

export async function ubahEntri(
  id: string, masukan: MasukanEntri,
): Promise<EntriLengkap> {
  const data = urai(masukan)
  wajibSeimbang(data.item)

  const lama = await ambilEntri(id)
  if (!lama) throw new ValidasiError('Entri jurnal tidak ditemukan')
  if (lama.status !== 'draft') {
    throw new ValidasiError(
      'Entri yang sudah diposting tidak dapat diubah. Buat entri pembalik untuk mengoreksinya.',
    )
  }

  const kurs = await ambilKurs(data.mataUangId, keTanggal(data.tanggal))

  await db.transaction(async (tx) => {
    await wajibPeriodeTerbukaDalamTx(tx, data.tanggal)
    await wajibPeriodeTerbukaDalamTx(tx, lama.tanggal)

    await tx.update(journalEntries).set({
      journalId: data.journalId,
      tanggal: data.tanggal,
      referensi: data.referensi,
      keterangan: data.keterangan,
      mataUangId: data.mataUangId,
      kurs,
      partnerId: data.partnerId,
      diubahPada: new Date(),
    }).where(eq(journalEntries.id, id))

    await hapusAlokasiEntriDalamTx(tx, id)
    await tx.delete(journalItems).where(eq(journalItems.entryId, id))
    await tx.insert(journalItems).values(
      data.item.map((b, i) => ({
        entryId: id,
        urutan: i + 1,
        accountId: b.accountId,
        partnerId: b.partnerId,
        label: b.label,
        debit: bulatkan(b.debit, DESIMAL_IDR),
        kredit: bulatkan(b.kredit, DESIMAL_IDR),
        nilaiMataUang: b.nilaiMataUang,
        mataUangId: data.mataUangId === MATA_UANG_FUNGSIONAL ? null : data.mataUangId,
        taxId: b.taxId,
        projectId: b.projectId,
      })),
    )

    await simpanAlokasiTerhadapItem(tx, id, data.item)
  })

  return (await ambilEntri(id))!
}

/**
 * Memposting entri: memberi nomor, mengunci isinya, dan memasukkannya ke
 * laporan. Seluruh pemeriksaan dan penulisan terjadi dalam satu transaksi,
 * dan pengambilan nomor mengunci baris urutan sehingga posting serempak
 * tidak menghasilkan nomor kembar.
 */
export async function postingEntri(id: string, dipostingOleh: string): Promise<EntriLengkap> {
  await db.transaction(async (tx) => {
    const [entri] = await tx.select().from(journalEntries)
      .where(eq(journalEntries.id, id))
      .for('update')
      .limit(1)

    if (!entri) throw new ValidasiError('Entri jurnal tidak ditemukan')
    if (entri.status === 'diposting') throw new ValidasiError('Entri ini sudah diposting')
    if (entri.status === 'dibatalkan') {
      throw new ValidasiError('Entri yang dibatalkan tidak dapat diposting')
    }

    await wajibPeriodeTerbukaDalamTx(tx, entri.tanggal)

    const item = await tx.select().from(journalItems).where(eq(journalItems.entryId, id))
    if (item.length < 2) throw new ValidasiError('Entri jurnal memerlukan minimal dua baris')
    wajibSeimbang(item)
    await wajibProyekTerbukaDalamTx(tx, item)

    const [jurnal] = await tx.select().from(journals)
      .where(eq(journals.id, entri.journalId)).limit(1)

    const nomor = await ambilNomorBerikut(
      tx, kodeUrutanJurnal(jurnal.kode), keTanggal(entri.tanggal),
    )

    await tx.update(journalEntries).set({
      nomor,
      status: 'diposting',
      dipostingPada: new Date(),
      dipostingOleh,
      diubahPada: new Date(),
    }).where(eq(journalEntries.id, id))
  })

  return (await ambilEntri(id))!
}

export async function batalkanDraft(id: string): Promise<void> {
  const entri = await ambilEntri(id)
  if (!entri) throw new ValidasiError('Entri jurnal tidak ditemukan')
  if (entri.status !== 'draft') {
    throw new ValidasiError('Hanya entri berstatus draft yang dapat dibatalkan')
  }
  await db.update(journalEntries)
    .set({ status: 'dibatalkan', diubahPada: new Date() })
    .where(eq(journalEntries.id, id))
}

export async function hapusDraft(id: string): Promise<void> {
  const entri = await ambilEntri(id)
  if (!entri) throw new ValidasiError('Entri jurnal tidak ditemukan')
  if (entri.status === 'diposting') {
    throw new ValidasiError(
      'Entri yang sudah diposting tidak dapat dihapus. Buat entri pembalik untuk mengoreksinya.',
    )
  }
  await db.delete(journalEntries).where(eq(journalEntries.id, id))
}

/**
 * Membalik entri terposting. Entri asal tidak pernah diubah maupun dihapus;
 * yang dibuat adalah entri baru dengan posisi debit dan kredit tertukar,
 * langsung berstatus diposting dan bernomor sendiri.
 */
export async function balikEntri(
  id: string, tanggalPembalikan: string, dipostingOleh: string,
): Promise<EntriLengkap> {
  const asal = await ambilEntri(id)
  if (!asal) throw new ValidasiError('Entri jurnal tidak ditemukan')
  if (asal.status !== 'diposting') {
    throw new ValidasiError('Hanya entri yang sudah diposting yang dapat dibalik')
  }

  const [sudahDibalik] = await db.select({ id: journalEntries.id }).from(journalEntries)
    .where(eq(journalEntries.membalikEntryId, id)).limit(1)
  if (sudahDibalik) throw new ValidasiError('Entri ini sudah pernah dibalik')

  const idBaru = await db.transaction(async (tx) => {
    await wajibPeriodeTerbukaDalamTx(tx, tanggalPembalikan)

    const [jurnal] = await tx.select().from(journals)
      .where(eq(journals.id, asal.journalId)).limit(1)

    const nomor = await ambilNomorBerikut(
      tx, kodeUrutanJurnal(jurnal.kode), keTanggal(tanggalPembalikan),
    )

    const [baru] = await tx.insert(journalEntries).values({
      nomor,
      journalId: asal.journalId,
      tanggal: tanggalPembalikan,
      referensi: asal.nomor,
      keterangan: `Pembalikan atas ${asal.nomor}${asal.keterangan ? ` — ${asal.keterangan}` : ''}`,
      status: 'diposting',
      mataUangId: asal.mataUangId,
      // Kurs asal dipertahankan agar pembalikan menghasilkan saldo nol tepat,
      // bukan menimbulkan selisih kurs baru.
      kurs: asal.kurs,
      partnerId: asal.partnerId,
      membalikEntryId: asal.id,
      dipostingPada: new Date(),
      dipostingOleh,
      dibuatOleh: dipostingOleh,
    }).returning({ id: journalEntries.id })

    await tx.insert(journalItems).values(
      asal.item.map((b, i) => ({
        entryId: baru.id,
        urutan: i + 1,
        accountId: b.accountId,
        partnerId: b.partnerId,
        label: `Pembalikan — ${b.label}`,
        debit: b.kredit,
        kredit: b.debit,
        nilaiMataUang: b.nilaiMataUang === null
          ? null
          : String(-Number(b.nilaiMataUang)),
        mataUangId: b.mataUangId,
        taxId: b.taxId,
        projectId: b.projectId,
      })),
    )

    return baru.id
  })

  return (await ambilEntri(idBaru))!
}

/** Entri terposting yang sudah punya entri pembalik. */
export async function daftarIdSudahDibalik(): Promise<Set<string>> {
  const baris = await db
    .select({ id: journalEntries.membalikEntryId })
    .from(journalEntries)
    .where(sql`${journalEntries.membalikEntryId} IS NOT NULL`)
  return new Set(baris.map((b) => b.id!).filter(Boolean))
}

export type MasukanPostingModul = MasukanEntri & { sumberTipe: string; sumberId: string }

/**
 * Memposting jurnal di dalam transaksi yang sedang berjalan.
 *
 * Modul lain memerlukan ini agar perubahan datanya sendiri dan jurnal yang
 * menyertainya tergabung dalam satu transaksi — pergerakan stok yang tercatat
 * tanpa jurnalnya, atau sebaliknya, akan membuat persediaan menyimpang dari
 * buku besar. Memanggil `postingJurnal()` dari dalam transaksi lain tidak bisa
 * dipakai untuk itu karena ia membuka transaksi baru sendiri.
 */
export async function postingJurnalDalamTx(
  tx: Transaksi,
  masukan: MasukanPostingModul,
  olehPengguna: string,
): Promise<{ id: string; nomor: string }> {
  const data = urai(masukan)
  wajibSeimbang(data.item)
  await wajibPeriodeTerbukaDalamTx(tx, data.tanggal)
  await wajibProyekTerbukaDalamTx(tx, data.item)

  const [jurnal] = await tx.select().from(journals)
    .where(eq(journals.id, data.journalId)).limit(1)
  if (!jurnal) throw new ValidasiError('Jurnal tidak ditemukan')
  if (!jurnal.isActive) throw new ValidasiError(`Jurnal ${jurnal.nama} sudah nonaktif`)

  const nomor = await ambilNomorBerikut(
    tx, kodeUrutanJurnal(jurnal.kode), keTanggal(data.tanggal),
  )

  const [entri] = await tx.insert(journalEntries).values({
    nomor,
    journalId: data.journalId,
    tanggal: data.tanggal,
    referensi: data.referensi,
    keterangan: data.keterangan,
    status: 'diposting',
    mataUangId: data.mataUangId,
    kurs: '1',
    partnerId: data.partnerId,
    sumberTipe: masukan.sumberTipe,
    sumberId: masukan.sumberId,
    dipostingPada: new Date(),
    dipostingOleh: olehPengguna,
    dibuatOleh: olehPengguna,
  }).returning({ id: journalEntries.id })

  await tx.insert(journalItems).values(
    data.item.map((b, i) => ({
      entryId: entri.id,
      urutan: i + 1,
      accountId: b.accountId,
      partnerId: b.partnerId,
      label: b.label,
      debit: bulatkan(b.debit, DESIMAL_IDR),
      kredit: bulatkan(b.kredit, DESIMAL_IDR),
      taxId: b.taxId,
      projectId: b.projectId,
    })),
  )

  await simpanAlokasiTerhadapItem(tx, entri.id, data.item)

  return { id: entri.id, nomor }
}

/**
 * Kanal tunggal bagi modul lain untuk memposting jurnal. Modul penjualan,
 * pembelian, gudang, dan aset memanggil ini dengan menyebutkan dokumen
 * asalnya; tidak ada modul yang menulis ke tabel jurnal secara langsung.
 */
export async function postingJurnal(
  masukan: MasukanPostingModul,
  olehPengguna: string,
): Promise<EntriLengkap> {
  const { id } = await db.transaction((tx) => postingJurnalDalamTx(tx, masukan, olehPengguna))
  return (await ambilEntri(id))!
}

export { formatTanggalIndonesia }
