import {
  pgTable, uuid, text, integer, numeric, date, timestamp,
  uniqueIndex, index, check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { statusEntriEnum } from './enum'
import { accounts, partners, taxes, journals } from './akuntansi'
import { currencies } from './mata-uang'
import { users } from './identitas'

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Nomor diberikan saat posting, bukan saat draft dibuat, sehingga draft
  // yang dibuang tidak meninggalkan lubang nomor.
  nomor: text('nomor'),
  journalId: uuid('journal_id').notNull().references(() => journals.id),
  tanggal: date('tanggal').notNull(),
  referensi: text('referensi'),
  keterangan: text('keterangan'),
  status: statusEntriEnum('status').notNull().default('draft'),
  mataUangId: text('mata_uang_id').notNull().references(() => currencies.kode),
  // Kurs dibekukan pada entri; perubahan kurs kemudian tidak mengubah jurnal ini.
  kurs: numeric('kurs', { precision: 18, scale: 6 }).notNull().default('1'),
  partnerId: uuid('partner_id').references(() => partners.id),
  // Relasi polimorfik ke dokumen asal: 'faktur', 'tagihan',
  // 'pergerakan_stok', 'depresiasi_aset'. Satu-satunya kanal integrasi
  // antar modul.
  sumberTipe: text('sumber_tipe'),
  sumberId: uuid('sumber_id'),
  // Terisi pada entri pembalik, menunjuk entri yang dibalik.
  membalikEntryId: uuid('membalik_entry_id'),
  dipostingPada: timestamp('diposting_pada', { withTimezone: true }),
  dipostingOleh: uuid('diposting_oleh').references(() => users.id),
  dibuatOleh: uuid('dibuat_oleh').references(() => users.id),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('journal_entries_nomor_unik').on(t.nomor).where(sql`${t.nomor} IS NOT NULL`),
  index('journal_entries_tanggal_status_idx').on(t.tanggal, t.status),
  index('journal_entries_sumber_idx').on(t.sumberTipe, t.sumberId),
  index('journal_entries_journal_idx').on(t.journalId),
])

export const journalItems = pgTable('journal_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id').notNull()
    .references(() => journalEntries.id, { onDelete: 'cascade' }),
  urutan: integer('urutan').notNull().default(1),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  partnerId: uuid('partner_id').references(() => partners.id),
  label: text('label').notNull(),
  // Selalu dalam IDR.
  debit: numeric('debit', { precision: 18, scale: 2 }).notNull().default('0'),
  kredit: numeric('kredit', { precision: 18, scale: 2 }).notNull().default('0'),
  // Nilai asli mata uang asing; positif untuk debit, negatif untuk kredit.
  nilaiMataUang: numeric('nilai_mata_uang', { precision: 18, scale: 6 }),
  mataUangId: text('mata_uang_id').references(() => currencies.kode),
  taxId: uuid('tax_id').references(() => taxes.id),
  // Disiapkan sejak sekarang agar profitabilitas proyek pada Fase 7 dapat
  // dihitung dari data jurnal historis tanpa migrasi.
  projectId: uuid('project_id'),
  rekonsiliasiId: uuid('rekonsiliasi_id'),
}, (t) => [
  check(
    'journal_items_debit_kredit_ck',
    sql`${t.debit} >= 0 AND ${t.kredit} >= 0 AND NOT (${t.debit} > 0 AND ${t.kredit} > 0)`,
  ),
  index('journal_items_entry_idx').on(t.entryId),
  index('journal_items_account_idx').on(t.accountId),
  index('journal_items_partner_idx').on(t.partnerId),
])
