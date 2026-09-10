import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import {
  profitPeriods, profitShares, owners, companySettings,
  journalEntries, journalItems, accounts,
} from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bagi, bulatkan, kali, kurang, tambah, type Uang } from '@/lib/uang'
import { postingJurnalDalamTx, balikEntri } from '@/modules/akuntansi/layanan/entri'
import {
  jurnalUntukDalamTx, akunOtomatisDalamTx, PEMETAAN_JURNAL,
} from '@/modules/akuntansi/layanan/pemetaan'
import { susunanBerlakuDalamTx } from './pemilik'

const DESIMAL = 2
const DESIMAL_PERSEN = 4

export type TipePeriode = 'bulanan' | 'kuartalan' | 'tahunan'

export type RentangPeriode = {
  kode: string
  tipe: TipePeriode
  nama: string
  tanggalMulai: string
  tanggalSelesai: string
}

/** Hari terakhir sebuah bulan, tanpa terpengaruh zona waktu. */
function akhirBulan(tahun: number, bulan: number): string {
  return new Date(Date.UTC(tahun, bulan, 0)).toISOString().slice(0, 10)
}

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Seluruh periode bagi hasil dalam satu tahun, mengikuti panjang periode yang
 * dipilih di pengaturan. Periode dihitung, bukan disimpan — mengubah pilihan
 * dari bulanan ke kuartalan tidak boleh meninggalkan baris kosong yang
 * menyesatkan.
 */
export function periodeSetahun(tahun: number, tipe: TipePeriode): RentangPeriode[] {
  if (tipe === 'tahunan') {
    return [{
      kode: String(tahun),
      tipe,
      nama: `Tahun ${tahun}`,
      tanggalMulai: `${tahun}-01-01`,
      tanggalSelesai: `${tahun}-12-31`,
    }]
  }

  if (tipe === 'kuartalan') {
    return [1, 2, 3, 4].map((k) => ({
      kode: `${tahun}-Q${k}`,
      tipe,
      nama: `Kuartal ${k} ${tahun}`,
      tanggalMulai: `${tahun}-${String(k * 3 - 2).padStart(2, '0')}-01`,
      tanggalSelesai: akhirBulan(tahun, k * 3),
    }))
  }

  return Array.from({ length: 12 }, (_, i) => ({
    kode: `${tahun}-${String(i + 1).padStart(2, '0')}`,
    tipe,
    nama: `${NAMA_BULAN[i]} ${tahun}`,
    tanggalMulai: `${tahun}-${String(i + 1).padStart(2, '0')}-01`,
    tanggalSelesai: akhirBulan(tahun, i + 1),
  }))
}

/**
 * Laba bersih sebuah rentang: pendapatan dikurangi beban, dihitung dari item
 * jurnal terposting menurut tipe akunnya — sama seperti Laporan Laba Rugi,
 * sehingga keduanya tidak mungkin berselisih.
 */
export async function hitungLabaBersihDalamTx(
  tx: Transaksi, dari: string, sampai: string,
): Promise<Uang> {
  const item = await tx
    .select({
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
      inArray(accounts.tipeAkun, [
        'pendapatan', 'pendapatan_lain',
        'beban_hpp', 'beban_operasional', 'beban_depresiasi',
        'beban_lain', 'beban_pajak',
      ]),
    ))

  let laba = '0'
  for (const i of item) {
    laba = i.tipeAkun.startsWith('pendapatan')
      ? tambah(laba, kurang(i.kredit, i.debit))
      : kurang(laba, kurang(i.debit, i.kredit))
  }
  return bulatkan(laba, DESIMAL)
}

export async function hitungLabaBersih(dari: string, sampai: string): Promise<Uang> {
  return db.transaction((tx) => hitungLabaBersihDalamTx(tx, dari, sampai))
}

export type BarisPeriode = RentangPeriode & {
  status: 'terbuka' | 'terkunci'
  labaBersih: Uang
  profitPeriodId: string | null
  jurnalEntryId: string | null
  porsi: { ownerId: string; kode: string; nama: string; persentase: Uang; jumlah: Uang }[]
}

/**
 * Daftar periode satu tahun beserta keadaannya: yang sudah dikunci memakai
 * angka bekunya, yang belum dihitung dari buku besar saat ini.
 */
export async function daftarPeriodeBagiHasil(tahun: number): Promise<BarisPeriode[]> {
  const [pengaturan] = await db.select().from(companySettings).limit(1)
  const tipe = (pengaturan?.periodeBagiHasil ?? 'tahunan') as TipePeriode

  const rentang = periodeSetahun(tahun, tipe)
  const terkunci = await db.select().from(profitPeriods)
    .where(inArray(profitPeriods.kode, rentang.map((r) => r.kode)))
  const terkunciLewatKode = new Map(terkunci.map((p) => [p.kode, p]))

  const semuaPorsi = terkunci.length > 0
    ? await db
        .select({
          profitPeriodId: profitShares.profitPeriodId,
          ownerId: profitShares.ownerId,
          kode: owners.kode,
          nama: owners.nama,
          persentase: profitShares.persentase,
          jumlah: profitShares.jumlah,
        })
        .from(profitShares)
        .innerJoin(owners, eq(owners.id, profitShares.ownerId))
        .where(inArray(profitShares.profitPeriodId, terkunci.map((p) => p.id)))
        .orderBy(asc(owners.kode))
    : []

  const hasil: BarisPeriode[] = []
  for (const r of rentang) {
    const beku = terkunciLewatKode.get(r.kode)
    if (beku) {
      hasil.push({
        ...r,
        status: 'terkunci',
        labaBersih: beku.labaBersih,
        profitPeriodId: beku.id,
        jurnalEntryId: beku.jurnalEntryId,
        porsi: semuaPorsi
          .filter((p) => p.profitPeriodId === beku.id)
          .map((p) => ({
            ownerId: p.ownerId, kode: p.kode, nama: p.nama,
            persentase: p.persentase, jumlah: p.jumlah,
          })),
      })
      continue
    }

    hasil.push({
      ...r,
      status: 'terbuka',
      labaBersih: await hitungLabaBersih(r.tanggalMulai, r.tanggalSelesai),
      profitPeriodId: null,
      jurnalEntryId: null,
      porsi: [],
    })
  }

  return hasil
}

/**
 * Membagi laba menurut persentase, dengan baris terakhir menyerap sisa
 * pembulatan agar jumlah seluruh porsi persis sama dengan laba bersihnya.
 * Tanpa itu jurnal distribusinya tidak akan seimbang.
 */
export function bagiLaba(
  laba: Uang, porsi: { ownerId: string; persentase: Uang }[],
): { ownerId: string; persentase: Uang; jumlah: Uang }[] {
  const total = bulatkan(tambah(...porsi.map((p) => p.persentase)), DESIMAL_PERSEN)
  if (Number(total) !== 100) {
    throw new ValidasiError(
      `Susunan kepemilikan harus berjumlah tepat 100%, saat ini ${Number(total)}%.`,
    )
  }

  const hasil: { ownerId: string; persentase: Uang; jumlah: Uang }[] = []
  let terpakai = '0'

  porsi.forEach((p, i) => {
    const terakhir = i === porsi.length - 1
    const jumlah = terakhir
      ? bulatkan(kurang(laba, terpakai), DESIMAL)
      : bulatkan(kali(laba, bagi(p.persentase, '100')), DESIMAL)
    terpakai = bulatkan(tambah(terpakai, jumlah), DESIMAL)
    hasil.push({
      ownerId: p.ownerId,
      persentase: bulatkan(p.persentase, DESIMAL_PERSEN),
      jumlah,
    })
  })

  return hasil
}

/**
 * Mengunci laba bersih sebuah periode dan membagikannya kepada para pemilik.
 *
 * Jurnalnya mendebit Laba Tahun Berjalan dan mengkredit akun modal
 * masing-masing pemilik — bukan menutup akun laba rugi. Dengan begitu
 * Laporan Laba Rugi periode itu tetap terbaca utuh, sementara neraca sudah
 * memperlihatkan hak tiap pemilik pada akun modalnya sendiri. Rugi berjalan
 * membalik arah keduanya.
 *
 * Periode dikunci berurutan; melompati periode yang lebih awal akan membuat
 * laba yang belum dibagikan tertinggal tanpa pernah ketahuan.
 */
export async function kunciBagiHasil(
  kodePeriode: string, olehPengguna: string,
): Promise<{ profitPeriodId: string; labaBersih: Uang }> {
  return db.transaction(async (tx) => {
    const [pengaturan] = await tx.select().from(companySettings).limit(1)
    const tipe = (pengaturan?.periodeBagiHasil ?? 'tahunan') as TipePeriode

    const tahun = Number(kodePeriode.slice(0, 4))
    if (!Number.isFinite(tahun)) throw new ValidasiError('Kode periode tidak dikenali')

    const rentang = periodeSetahun(tahun, tipe).find((r) => r.kode === kodePeriode)
    if (!rentang) {
      throw new ValidasiError(
        `Periode ${kodePeriode} tidak sesuai dengan panjang periode bagi hasil yang berlaku.`,
      )
    }

    const [sudah] = await tx.select().from(profitPeriods)
      .where(eq(profitPeriods.kode, kodePeriode)).limit(1)
    if (sudah) throw new ValidasiError(`Periode ${kodePeriode} sudah dikunci`)

    // Periode sebelumnya dalam tahun yang sama harus sudah tuntas.
    const sebelumnya = periodeSetahun(tahun, tipe)
      .filter((r) => r.tanggalSelesai < rentang.tanggalMulai)
    if (sebelumnya.length > 0) {
      const terkunci = await tx.select({ kode: profitPeriods.kode }).from(profitPeriods)
        .where(inArray(profitPeriods.kode, sebelumnya.map((r) => r.kode)))
      const sudahKode = new Set(terkunci.map((t) => t.kode))
      const tertinggal = sebelumnya.filter((r) => !sudahKode.has(r.kode))
      if (tertinggal.length > 0) {
        throw new ValidasiError(
          `Periode ${tertinggal.map((r) => r.kode).join(', ')} belum dikunci. ` +
          'Bagi hasil harus dikunci berurutan.',
        )
      }
    }

    const susunan = await susunanBerlakuDalamTx(tx, rentang.tanggalSelesai)
    if (!susunan || susunan.porsi.length === 0) {
      throw new ValidasiError(
        `Belum ada susunan kepemilikan yang berlaku pada ${rentang.tanggalSelesai}.`,
      )
    }

    const labaBersih = await hitungLabaBersihDalamTx(
      tx, rentang.tanggalMulai, rentang.tanggalSelesai,
    )
    if (Number(labaBersih) === 0) {
      throw new ValidasiError(
        `Laba bersih ${rentang.nama} nol, tidak ada yang dapat dibagikan.`,
      )
    }

    const porsi = bagiLaba(labaBersih, susunan.porsi)

    const akunLabaBerjalan = await akunOtomatisDalamTx(tx, 'akunLabaBerjalanId')
    const journalId = await jurnalUntukDalamTx(tx, PEMETAAN_JURNAL.BAGI_HASIL)

    const daftarPemilik = await tx.select().from(owners)
      .where(inArray(owners.id, porsi.map((p) => p.ownerId)))
    const pemilikLewatId = new Map(daftarPemilik.map((o) => [o.id, o]))

    const untung = Number(labaBersih) > 0
    const nilaiLaba = bulatkan(untung ? labaBersih : String(-Number(labaBersih)), DESIMAL)

    type ItemJurnal = {
      accountId: string; partnerId: null; label: string
      debit: string; kredit: string
      nilaiMataUang: null; taxId: null; projectId: null
      alokasiBiaya: never[]
    }

    const item: ItemJurnal[] = [{
      accountId: akunLabaBerjalan,
      partnerId: null,
      label: `Distribusi ${untung ? 'laba' : 'rugi'} ${rentang.nama}`,
      debit: untung ? nilaiLaba : '0',
      kredit: untung ? '0' : nilaiLaba,
      nilaiMataUang: null, taxId: null, projectId: null, alokasiBiaya: [],
    }]

    for (const p of porsi) {
      const pemilik = pemilikLewatId.get(p.ownerId)
      if (!pemilik) throw new ValidasiError('Pemilik tidak ditemukan')
      if (Number(p.jumlah) === 0) continue
      const bagianUntung = Number(p.jumlah) > 0
      const nilai = bulatkan(
        bagianUntung ? p.jumlah : String(-Number(p.jumlah)), DESIMAL,
      )
      item.push({
        accountId: pemilik.akunModalId,
        partnerId: null,
        label: `${pemilik.nama} — ${Number(p.persentase)}% ${rentang.nama}`,
        debit: bagianUntung ? '0' : nilai,
        kredit: bagianUntung ? nilai : '0',
        nilaiMataUang: null, taxId: null, projectId: null, alokasiBiaya: [],
      })
    }

    const posting = await postingJurnalDalamTx(tx, {
      journalId,
      tanggal: rentang.tanggalSelesai,
      referensi: kodePeriode,
      keterangan: `Bagi hasil ${rentang.nama}`,
      mataUangId: 'IDR',
      partnerId: null,
      sumberTipe: 'bagi-hasil:periode',
      sumberId: susunan.periodeId,
      item,
    }, olehPengguna)

    const [periode] = await tx.insert(profitPeriods).values({
      kode: kodePeriode,
      tipe,
      tanggalMulai: rentang.tanggalMulai,
      tanggalSelesai: rentang.tanggalSelesai,
      status: 'terkunci',
      labaBersih,
      jurnalEntryId: posting.id,
      ownershipPeriodId: susunan.periodeId,
      dikunciPada: new Date(),
      dikunciOleh: olehPengguna,
    }).returning()

    await tx.insert(profitShares).values(
      porsi.map((p) => ({
        profitPeriodId: periode.id,
        ownerId: p.ownerId,
        persentase: p.persentase,
        jumlah: p.jumlah,
      })),
    )

    return { profitPeriodId: periode.id, labaBersih }
  })
}

/**
 * Membuka kembali sebuah periode bagi hasil.
 *
 * Jurnal distribusinya tidak dihapus melainkan dibalik, sesuai aturan bahwa
 * entri terposting tidak pernah diubah. Periode terakhir saja yang boleh
 * dibuka, karena membuka periode di tengah akan meninggalkan periode
 * sesudahnya berdiri di atas angka yang sudah tidak berlaku.
 */
export async function bukaKunciBagiHasil(
  profitPeriodId: string, olehPengguna: string,
): Promise<void> {
  const [periode] = await db.select().from(profitPeriods)
    .where(eq(profitPeriods.id, profitPeriodId)).limit(1)
  if (!periode) throw new ValidasiError('Periode bagi hasil tidak ditemukan')

  const [terakhir] = await db.select().from(profitPeriods)
    .orderBy(desc(profitPeriods.tanggalSelesai)).limit(1)
  if (terakhir && terakhir.id !== profitPeriodId) {
    throw new ValidasiError(
      `Hanya periode terakhir (${terakhir.kode}) yang dapat dibuka kembali.`,
    )
  }

  if (periode.jurnalEntryId) {
    // Pembalikan bertanggal sama dengan distribusinya agar keduanya saling
    // meniadakan di periode yang sama, bukan menggeser laba ke periode lain.
    await balikEntri(periode.jurnalEntryId, periode.tanggalSelesai, olehPengguna)
  }

  await db.delete(profitPeriods).where(eq(profitPeriods.id, profitPeriodId))
}

// ── Laporan transparansi ────────────────────────────────────────────────────

export type RingkasanPemilik = {
  ownerId: string
  kode: string
  nama: string
  /** Akumulasi porsi laba yang pernah dibagikan. */
  totalBagiHasil: Uang
  /** Saldo akun modalnya di buku besar, termasuk setoran modal awal. */
  saldoModal: Uang
  /** Saldo akun prive; penarikan yang sudah dilakukan. */
  totalPrive: Uang
  /** Modal dikurangi prive — hak yang masih tertinggal di perusahaan. */
  sisaHak: Uang
}

/**
 * Transparansi hak tiap pemilik: berapa yang pernah dibagikan, berapa yang
 * sudah ditarik, dan berapa sisanya. Angkanya dibaca dari buku besar, bukan
 * dari catatan tersendiri, sehingga tidak mungkin berselisih dengan neraca.
 */
export async function ringkasanPemilik(): Promise<RingkasanPemilik[]> {
  const daftar = await db.select().from(owners).orderBy(asc(owners.kode))
  if (daftar.length === 0) return []

  const idAkun = [
    ...daftar.map((o) => o.akunModalId),
    ...daftar.map((o) => o.akunPriveId).filter((x): x is string => Boolean(x)),
  ]

  const item = await db
    .select({
      akunId: journalItems.accountId,
      debit: journalItems.debit,
      kredit: journalItems.kredit,
    })
    .from(journalItems)
    .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
    .where(and(
      eq(journalEntries.status, 'diposting'),
      inArray(journalItems.accountId, idAkun),
    ))

  const saldo = new Map<string, string>()
  for (const i of item) {
    // Ekuitas bersaldo kredit.
    saldo.set(
      i.akunId,
      tambah(saldo.get(i.akunId) ?? '0', kurang(i.kredit, i.debit)),
    )
  }

  const bagian = await db
    .select({ ownerId: profitShares.ownerId, jumlah: profitShares.jumlah })
    .from(profitShares)
  const bagianPerPemilik = new Map<string, string>()
  for (const b of bagian) {
    bagianPerPemilik.set(
      b.ownerId, tambah(bagianPerPemilik.get(b.ownerId) ?? '0', b.jumlah),
    )
  }

  return daftar.map((o) => {
    const saldoModal = bulatkan(saldo.get(o.akunModalId) ?? '0', DESIMAL)
    // Prive bersaldo debit, jadi saldo kreditnya negatif; dibalik agar terbaca
    // sebagai jumlah yang sudah ditarik.
    const totalPrive = bulatkan(
      o.akunPriveId ? String(-Number(saldo.get(o.akunPriveId) ?? '0')) : '0', DESIMAL,
    )
    return {
      ownerId: o.id,
      kode: o.kode,
      nama: o.nama,
      totalBagiHasil: bulatkan(bagianPerPemilik.get(o.id) ?? '0', DESIMAL),
      saldoModal,
      totalPrive,
      sisaHak: bulatkan(kurang(saldoModal, totalPrive), DESIMAL),
    }
  })
}
