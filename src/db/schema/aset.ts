import {
  pgTable, uuid, text, integer, numeric, date, timestamp, boolean,
  uniqueIndex, index, check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { metodeDepresiasiEnum, statusAsetEnum, statusDepresiasiEnum } from './enum'
import { accounts, partners } from './akuntansi'
import { journalEntries } from './jurnal'
import { users } from './identitas'

/**
 * Kategori aset menentukan tiga akun yang dipakai depresiasi: aset itu
 * sendiri, akumulasinya, dan bebannya. Polanya sama seperti kategori produk —
 * menambah aset baru tidak memerlukan konfigurasi akuntansi tambahan.
 *
 * Tanah tidak disusutkan, jadi akun akumulasi dan bebannya boleh kosong.
 */
export const assetCategories = pgTable('asset_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  akunAsetId: uuid('akun_aset_id').notNull().references(() => accounts.id),
  akunAkumulasiId: uuid('akun_akumulasi_id').references(() => accounts.id),
  akunBebanId: uuid('akun_beban_id').references(() => accounts.id),
  dapatDidepresiasi: boolean('dapat_didepresiasi').notNull().default(true),
  metodeBawaan: metodeDepresiasiEnum('metode_bawaan').notNull().default('garis_lurus'),
  masaManfaatBulanBawaan: integer('masa_manfaat_bulan_bawaan').notNull().default(60),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [
  uniqueIndex('asset_categories_kode_unik').on(t.kode),
  check(
    'asset_categories_masa_manfaat_positif_ck',
    sql`${t.masaManfaatBulanBawaan} > 0`,
  ),
  // Kategori yang disusutkan wajib punya kedua akun lawannya; tanpa itu
  // depresiasinya tidak akan pernah bisa diposting.
  check(
    'asset_categories_akun_depresiasi_ck',
    sql`${t.dapatDidepresiasi} = false
        OR (${t.akunAkumulasiId} IS NOT NULL AND ${t.akunBebanId} IS NOT NULL)`,
  ),
])

/**
 * Aset tetap. Modul ini tidak memposting perolehan aset — nilainya sudah
 * masuk buku besar lewat tagihan pembelian atau saldo awal. Mencatatnya lagi
 * di sini akan menghitung aset yang sama dua kali; yang dilakukan modul ini
 * hanyalah menyusutkannya.
 */
export const fixedAssets = pgTable('fixed_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  kategoriId: uuid('kategori_id').notNull().references(() => assetCategories.id),
  status: statusAsetEnum('status').notNull().default('draft'),
  tanggalPerolehan: date('tanggal_perolehan').notNull(),
  /** Bulan pertama yang disusutkan; boleh berbeda dari tanggal perolehan. */
  tanggalMulaiDepresiasi: date('tanggal_mulai_depresiasi').notNull(),
  nilaiPerolehan: numeric('nilai_perolehan', { precision: 18, scale: 2 }).notNull(),
  nilaiResidu: numeric('nilai_residu', { precision: 18, scale: 2 }).notNull().default('0'),
  masaManfaatBulan: integer('masa_manfaat_bulan').notNull(),
  metode: metodeDepresiasiEnum('metode').notNull().default('garis_lurus'),
  partnerId: uuid('partner_id').references(() => partners.id),
  referensi: text('referensi'),
  catatan: text('catatan'),
  /** Terisi saat aset dilepas; setelah itu depresiasi berhenti. */
  tanggalPelepasan: date('tanggal_pelepasan'),
  nilaiPelepasan: numeric('nilai_pelepasan', { precision: 18, scale: 2 }),
  jurnalPelepasanId: uuid('jurnal_pelepasan_id').references(() => journalEntries.id),
  dijalankanPada: timestamp('dijalankan_pada', { withTimezone: true }),
  dijalankanOleh: uuid('dijalankan_oleh').references(() => users.id),
  dibuatOleh: uuid('dibuat_oleh').references(() => users.id),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('fixed_assets_kode_unik').on(t.kode),
  index('fixed_assets_kategori_idx').on(t.kategoriId),
  index('fixed_assets_status_idx').on(t.status),
  check('fixed_assets_nilai_perolehan_positif_ck', sql`${t.nilaiPerolehan} > 0`),
  check(
    'fixed_assets_residu_masuk_akal_ck',
    sql`${t.nilaiResidu} >= 0 AND ${t.nilaiResidu} < ${t.nilaiPerolehan}`,
  ),
  check('fixed_assets_masa_manfaat_positif_ck', sql`${t.masaManfaatBulan} > 0`),
])

/**
 * Satu baris jadwal depresiasi per bulan. Baris disusun sekaligus saat aset
 * dijalankan sehingga rencana penyusutannya terlihat utuh sejak awal, lalu
 * diposting satu per satu ketika bulannya tiba.
 */
export const depreciationLines = pgTable('depreciation_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  asetId: uuid('aset_id').notNull().references(() => fixedAssets.id, { onDelete: 'cascade' }),
  urutan: integer('urutan').notNull(),
  tanggal: date('tanggal').notNull(),
  status: statusDepresiasiEnum('status').notNull().default('draft'),
  nilai: numeric('nilai', { precision: 18, scale: 2 }).notNull(),
  akumulasi: numeric('akumulasi', { precision: 18, scale: 2 }).notNull(),
  nilaiBuku: numeric('nilai_buku', { precision: 18, scale: 2 }).notNull(),
  jurnalEntryId: uuid('jurnal_entry_id').references(() => journalEntries.id),
  dipostingPada: timestamp('diposting_pada', { withTimezone: true }),
  dipostingOleh: uuid('diposting_oleh').references(() => users.id),
}, (t) => [
  uniqueIndex('depreciation_lines_urutan_unik').on(t.asetId, t.urutan),
  index('depreciation_lines_tanggal_status_idx').on(t.tanggal, t.status),
  check('depreciation_lines_nilai_positif_ck', sql`${t.nilai} > 0`),
])
