import {
  pgTable, uuid, text, numeric, date, timestamp, boolean,
  uniqueIndex, index, check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { periodeBagiHasilEnum, statusBagiHasilEnum } from './enum'
import { accounts } from './akuntansi'
import { journalEntries } from './jurnal'
import { users } from './identitas'

/**
 * Pemilik perusahaan. Setiap pemilik punya akun modalnya sendiri sehingga
 * hak masing-masing terbaca langsung dari neraca, bukan dari catatan di luar
 * pembukuan.
 */
export const owners = pgTable('owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  akunModalId: uuid('akun_modal_id').notNull().references(() => accounts.id),
  /** Akun penarikan pribadi; dipakai laporan untuk memperlihatkan sisa hak. */
  akunPriveId: uuid('akun_prive_id').references(() => accounts.id),
  isActive: boolean('is_active').notNull().default(true),
  catatan: text('catatan'),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('owners_kode_unik').on(t.kode)])

/**
 * Susunan kepemilikan yang berlaku pada suatu rentang waktu.
 *
 * Persentase disimpan per periode, bukan sebagai satu angka pada pemiliknya,
 * karena komposisi kepemilikan bisa berubah — dan pembagian tahun lalu tidak
 * boleh ikut berubah ketika susunannya diperbarui hari ini. Pola yang sama
 * seperti kurs yang dibekukan dan tarif timesheet yang disalin saat dicatat.
 */
export const ownershipPeriods = pgTable('ownership_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  nama: text('nama').notNull(),
  tanggalMulai: date('tanggal_mulai').notNull(),
  /** Kosong berarti berlaku sampai digantikan susunan berikutnya. */
  tanggalSelesai: date('tanggal_selesai'),
  catatan: text('catatan'),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('ownership_periods_mulai_idx').on(t.tanggalMulai)])

export const ownershipShares = pgTable('ownership_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  periodeId: uuid('periode_id').notNull()
    .references(() => ownershipPeriods.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => owners.id),
  persentase: numeric('persentase', { precision: 9, scale: 4 }).notNull(),
}, (t) => [
  uniqueIndex('ownership_shares_unik').on(t.periodeId, t.ownerId),
  check(
    'ownership_shares_persentase_ck',
    sql`${t.persentase} > 0 AND ${t.persentase} <= 100`,
  ),
])

/**
 * Satu periode bagi hasil yang laba bersihnya sudah dikunci.
 *
 * Baris hanya lahir saat penguncian; periode yang belum dikunci dihitung
 * dari konfigurasi, tidak disimpan. Dengan begitu mengubah pilihan periode
 * dari bulanan ke kuartalan tidak meninggalkan baris kosong yang menyesatkan.
 */
export const profitPeriods = pgTable('profit_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  tipe: periodeBagiHasilEnum('tipe').notNull(),
  tanggalMulai: date('tanggal_mulai').notNull(),
  tanggalSelesai: date('tanggal_selesai').notNull(),
  status: statusBagiHasilEnum('status').notNull().default('terkunci'),
  /** Laba bersih periode ini pada saat dikunci; tidak dihitung ulang. */
  labaBersih: numeric('laba_bersih', { precision: 18, scale: 2 }).notNull(),
  jurnalEntryId: uuid('jurnal_entry_id').references(() => journalEntries.id),
  ownershipPeriodId: uuid('ownership_periode_id').references(() => ownershipPeriods.id),
  dikunciPada: timestamp('dikunci_pada', { withTimezone: true }),
  dikunciOleh: uuid('dikunci_oleh').references(() => users.id),
}, (t) => [
  uniqueIndex('profit_periods_kode_unik').on(t.kode),
  index('profit_periods_rentang_idx').on(t.tanggalMulai, t.tanggalSelesai),
])

/** Porsi tiap pemilik atas laba sebuah periode, dibekukan saat penguncian. */
export const profitShares = pgTable('profit_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  profitPeriodId: uuid('profit_period_id').notNull()
    .references(() => profitPeriods.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => owners.id),
  persentase: numeric('persentase', { precision: 9, scale: 4 }).notNull(),
  jumlah: numeric('jumlah', { precision: 18, scale: 2 }).notNull(),
}, (t) => [uniqueIndex('profit_shares_unik').on(t.profitPeriodId, t.ownerId)])
