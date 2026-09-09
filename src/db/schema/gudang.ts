import {
  pgTable, uuid, text, integer, numeric, date, timestamp, boolean,
  uniqueIndex, index, check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  tipeProdukEnum, kategoriUomEnum, tipeLokasiEnum,
  tipeOperasiEnum, statusOperasiEnum,
} from './enum'
import { accounts, partners } from './akuntansi'
import { journalEntries } from './jurnal'
import { users } from './identitas'

/**
 * Satuan dikelompokkan per kategori. `faktor` menyatakan berapa satuan acuan
 * yang setara dengan satu satuan ini — Lusin berfaktor 12 terhadap Unit.
 * Konversi hanya diizinkan di dalam kategori yang sama.
 */
export const uoms = pgTable('uoms', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  kategori: kategoriUomEnum('kategori').notNull(),
  faktor: numeric('faktor', { precision: 18, scale: 6 }).notNull().default('1'),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [
  uniqueIndex('uoms_kode_unik').on(t.kode),
  check('uoms_faktor_positif_ck', sql`${t.faktor} > 0`),
])

/**
 * Kategori produk menentukan akun mana yang dipakai saat pergerakan stok
 * memposting jurnal, sehingga penambahan produk baru tidak memerlukan
 * konfigurasi akuntansi tambahan.
 */
export const productCategories = pgTable('product_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  akunPersediaanId: uuid('akun_persediaan_id').notNull().references(() => accounts.id),
  akunHppId: uuid('akun_hpp_id').notNull().references(() => accounts.id),
  // Selisih stock opname dan kerugian barang rusak adalah beban yang
  // berbeda, dan bagan akun sudah memisahkannya.
  akunSelisihId: uuid('akun_selisih_id').notNull().references(() => accounts.id),
  akunBarangRusakId: uuid('akun_barang_rusak_id').notNull().references(() => accounts.id),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [uniqueIndex('product_categories_kode_unik').on(t.kode)])

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  tipe: tipeProdukEnum('tipe').notNull().default('disimpan'),
  kategoriId: uuid('kategori_id').notNull().references(() => productCategories.id),
  uomId: uuid('uom_id').notNull().references(() => uoms.id),
  barcode: text('barcode'),
  hargaJual: numeric('harga_jual', { precision: 18, scale: 2 }).notNull().default('0'),
  /**
   * Harga pokok rata-rata bergerak, berlaku untuk seluruh perusahaan dan
   * diperbarui setiap kali barang masuk. Nilai ini adalah cerminan; sumber
   * kebenarannya tetap riwayat pergerakan stok.
   */
  hargaPokokRataRata: numeric('harga_pokok_rata_rata', { precision: 18, scale: 6 })
    .notNull().default('0'),
  isActive: boolean('is_active').notNull().default(true),
  catatan: text('catatan'),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('products_kode_unik').on(t.kode),
  index('products_kategori_idx').on(t.kategoriId),
  check('products_harga_tidak_negatif_ck', sql`${t.hargaJual} >= 0 AND ${t.hargaPokokRataRata} >= 0`),
])

export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  alamat: text('alamat'),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [uniqueIndex('warehouses_kode_unik').on(t.kode)])

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  tipe: tipeLokasiEnum('tipe').notNull(),
  parentId: uuid('parent_id'),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [
  uniqueIndex('locations_kode_unik').on(t.kode),
  index('locations_tipe_idx').on(t.tipe),
  index('locations_warehouse_idx').on(t.warehouseId),
])

export const stockOperations = pgTable('stock_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Nomor diberikan saat operasi diselesaikan, bukan saat draft dibuat.
  nomor: text('nomor'),
  tipe: tipeOperasiEnum('tipe').notNull(),
  tanggal: date('tanggal').notNull(),
  status: statusOperasiEnum('status').notNull().default('draft'),
  lokasiAsalId: uuid('lokasi_asal_id').notNull().references(() => locations.id),
  lokasiTujuanId: uuid('lokasi_tujuan_id').notNull().references(() => locations.id),
  partnerId: uuid('partner_id').references(() => partners.id),
  referensi: text('referensi'),
  catatan: text('catatan'),
  jurnalEntryId: uuid('jurnal_entry_id').references(() => journalEntries.id),
  sumberTipe: text('sumber_tipe'),
  sumberId: uuid('sumber_id'),
  diselesaikanPada: timestamp('diselesaikan_pada', { withTimezone: true }),
  diselesaikanOleh: uuid('diselesaikan_oleh').references(() => users.id),
  dibuatOleh: uuid('dibuat_oleh').references(() => users.id),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('stock_operations_nomor_unik').on(t.nomor).where(sql`${t.nomor} IS NOT NULL`),
  index('stock_operations_tanggal_status_idx').on(t.tanggal, t.status),
  index('stock_operations_tipe_idx').on(t.tipe),
  index('stock_operations_sumber_idx').on(t.sumberTipe, t.sumberId),
])

export const stockOperationLines = pgTable('stock_operation_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  operasiId: uuid('operasi_id').notNull()
    .references(() => stockOperations.id, { onDelete: 'cascade' }),
  urutan: integer('urutan').notNull().default(1),
  produkId: uuid('produk_id').notNull().references(() => products.id),
  /** Kuantitas dalam satuan `uom_id`, belum dikonversi ke satuan produk. */
  kuantitas: numeric('kuantitas', { precision: 18, scale: 6 }).notNull(),
  uomId: uuid('uom_id').notNull().references(() => uoms.id),
  /**
   * Harga satuan hanya diisi pada penerimaan; pengeluaran memakai harga
   * pokok rata-rata yang berlaku saat operasi diselesaikan.
   */
  hargaSatuan: numeric('harga_satuan', { precision: 18, scale: 6 }),
  catatan: text('catatan'),
}, (t) => [
  index('stock_operation_lines_operasi_idx').on(t.operasiId),
  check('stock_operation_lines_kuantitas_positif_ck', sql`${t.kuantitas} > 0`),
])

/**
 * Catatan pergerakan stok yang sudah terjadi. Baris di sini tidak pernah
 * diubah maupun dihapus — pembatalan operasi menghasilkan pergerakan balik,
 * sama seperti entri jurnal dikoreksi lewat entri pembalik.
 */
export const stockMoves = pgTable('stock_moves', {
  id: uuid('id').primaryKey().defaultRandom(),
  operasiId: uuid('operasi_id').references(() => stockOperations.id),
  produkId: uuid('produk_id').notNull().references(() => products.id),
  lokasiAsalId: uuid('lokasi_asal_id').notNull().references(() => locations.id),
  lokasiTujuanId: uuid('lokasi_tujuan_id').notNull().references(() => locations.id),
  tanggal: date('tanggal').notNull(),
  /** Selalu dalam satuan dasar produk, sudah dikonversi. */
  kuantitas: numeric('kuantitas', { precision: 18, scale: 6 }).notNull(),
  /** Harga pokok satuan yang berlaku pada saat pergerakan ini terjadi. */
  hargaPokokSatuan: numeric('harga_pokok_satuan', { precision: 18, scale: 6 })
    .notNull().default('0'),
  nilaiTotal: numeric('nilai_total', { precision: 18, scale: 2 }).notNull().default('0'),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('stock_moves_produk_idx').on(t.produkId),
  index('stock_moves_tanggal_idx').on(t.tanggal),
  index('stock_moves_operasi_idx').on(t.operasiId),
  index('stock_moves_asal_idx').on(t.lokasiAsalId),
  index('stock_moves_tujuan_idx').on(t.lokasiTujuanId),
  check('stock_moves_kuantitas_positif_ck', sql`${t.kuantitas} > 0`),
  check('stock_moves_lokasi_berbeda_ck', sql`${t.lokasiAsalId} <> ${t.lokasiTujuanId}`),
])

export const packingLists = pgTable('packing_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  nomor: text('nomor').notNull(),
  operasiId: uuid('operasi_id').notNull()
    .references(() => stockOperations.id, { onDelete: 'cascade' }),
  tanggal: date('tanggal').notNull(),
  catatan: text('catatan'),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('packing_lists_nomor_unik').on(t.nomor)])

export const packingListItems = pgTable('packing_list_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  packingListId: uuid('packing_list_id').notNull()
    .references(() => packingLists.id, { onDelete: 'cascade' }),
  urutan: integer('urutan').notNull().default(1),
  nomorKoli: text('nomor_koli').notNull(),
  produkId: uuid('produk_id').notNull().references(() => products.id),
  kuantitas: numeric('kuantitas', { precision: 18, scale: 6 }).notNull(),
  beratKg: numeric('berat_kg', { precision: 18, scale: 3 }),
  catatan: text('catatan'),
}, (t) => [
  index('packing_list_items_list_idx').on(t.packingListId),
  check('packing_list_items_kuantitas_positif_ck', sql`${t.kuantitas} > 0`),
])
