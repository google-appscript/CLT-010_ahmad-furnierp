import {
  pgTable, uuid, text, integer, numeric, date, timestamp, boolean,
  uniqueIndex, index, check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { statusPerintahProduksiEnum } from './enum'
import { products, uoms, locations, stockOperations } from './gudang'
import { journalEntries } from './jurnal'
import { users } from './identitas'

/**
 * Resep sebuah produk: berapa bahan yang dibutuhkan untuk menghasilkan
 * `kuantitas` unit. Kuantitas hasil disimpan agar resep dapat ditulis dalam
 * takaran yang wajar — misalnya bahan untuk sepuluh kursi sekaligus — lalu
 * diskalakan saat dipakai perintah produksi.
 */
export const billOfMaterials = pgTable('bill_of_materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  produkId: uuid('produk_id').notNull().references(() => products.id),
  kuantitas: numeric('kuantitas', { precision: 18, scale: 6 }).notNull().default('1'),
  uomId: uuid('uom_id').notNull().references(() => uoms.id),
  isActive: boolean('is_active').notNull().default(true),
  catatan: text('catatan'),
  dibuatOleh: uuid('dibuat_oleh').references(() => users.id),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('bill_of_materials_kode_unik').on(t.kode),
  index('bill_of_materials_produk_idx').on(t.produkId),
  check('bill_of_materials_kuantitas_positif_ck', sql`${t.kuantitas} > 0`),
])

export const bomLines = pgTable('bom_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  bomId: uuid('bom_id').notNull()
    .references(() => billOfMaterials.id, { onDelete: 'cascade' }),
  urutan: integer('urutan').notNull().default(1),
  produkId: uuid('produk_id').notNull().references(() => products.id),
  kuantitas: numeric('kuantitas', { precision: 18, scale: 6 }).notNull(),
  uomId: uuid('uom_id').notNull().references(() => uoms.id),
  catatan: text('catatan'),
}, (t) => [
  index('bom_lines_bom_idx').on(t.bomId),
  check('bom_lines_kuantitas_positif_ck', sql`${t.kuantitas} > 0`),
])

/**
 * Perintah produksi. Nomor diberikan saat dikonfirmasi, bukan saat draft dibuat.
 *
 * Kebutuhan bahan disalin ke `work_order_lines` saat perintah dibuat, bukan
 * dibaca ulang dari resep saat diselesaikan — resep boleh berubah kapan saja,
 * sedangkan perintah yang sudah berjalan harus tetap mencerminkan bahan yang
 * memang direncanakan untuknya.
 */
export const workOrders = pgTable('work_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  nomor: text('nomor'),
  status: statusPerintahProduksiEnum('status').notNull().default('draft'),
  produkId: uuid('produk_id').notNull().references(() => products.id),
  bomId: uuid('bom_id').references(() => billOfMaterials.id),
  kuantitas: numeric('kuantitas', { precision: 18, scale: 6 }).notNull(),
  uomId: uuid('uom_id').notNull().references(() => uoms.id),
  tanggal: date('tanggal').notNull(),
  tanggalTarget: date('tanggal_target'),
  /** Gudang tempat bahan diambil; harus lokasi internal. */
  lokasiSumberId: uuid('lokasi_sumber_id').notNull().references(() => locations.id),
  /** Gudang tempat barang jadi disimpan; harus lokasi internal. */
  lokasiTujuanId: uuid('lokasi_tujuan_id').notNull().references(() => locations.id),
  /**
   * Biaya konversi yang diserap ke harga pokok barang jadi. Keduanya
   * mengkredit akun beban terkait dan mendebit Barang Dalam Proses, sehingga
   * beban tenaga kerja dan overhead yang sudah dicatat saat terjadi tidak
   * dihitung dua kali ketika barangnya terjual.
   */
  biayaTenagaKerja: numeric('biaya_tenaga_kerja', { precision: 18, scale: 2 })
    .notNull().default('0'),
  biayaOverhead: numeric('biaya_overhead', { precision: 18, scale: 2 })
    .notNull().default('0'),
  referensi: text('referensi'),
  catatan: text('catatan'),
  operasiKonsumsiId: uuid('operasi_konsumsi_id').references(() => stockOperations.id),
  operasiHasilId: uuid('operasi_hasil_id').references(() => stockOperations.id),
  jurnalBiayaId: uuid('jurnal_biaya_id').references(() => journalEntries.id),
  /** Harga pokok satuan barang jadi yang dihasilkan perintah ini. */
  hargaPokokSatuan: numeric('harga_pokok_satuan', { precision: 18, scale: 6 }),
  dikonfirmasiPada: timestamp('dikonfirmasi_pada', { withTimezone: true }),
  dikonfirmasiOleh: uuid('dikonfirmasi_oleh').references(() => users.id),
  diselesaikanPada: timestamp('diselesaikan_pada', { withTimezone: true }),
  diselesaikanOleh: uuid('diselesaikan_oleh').references(() => users.id),
  dibuatOleh: uuid('dibuat_oleh').references(() => users.id),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('work_orders_nomor_unik').on(t.nomor).where(sql`${t.nomor} IS NOT NULL`),
  index('work_orders_tanggal_status_idx').on(t.tanggal, t.status),
  index('work_orders_produk_idx').on(t.produkId),
  check('work_orders_kuantitas_positif_ck', sql`${t.kuantitas} > 0`),
  check(
    'work_orders_biaya_tidak_negatif_ck',
    sql`${t.biayaTenagaKerja} >= 0 AND ${t.biayaOverhead} >= 0`,
  ),
  check('work_orders_lokasi_berbeda_ck', sql`${t.lokasiSumberId} <> ${t.lokasiTujuanId}`),
])

export const workOrderLines = pgTable('work_order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  woId: uuid('wo_id').notNull().references(() => workOrders.id, { onDelete: 'cascade' }),
  urutan: integer('urutan').notNull().default(1),
  produkId: uuid('produk_id').notNull().references(() => products.id),
  kuantitas: numeric('kuantitas', { precision: 18, scale: 6 }).notNull(),
  uomId: uuid('uom_id').notNull().references(() => uoms.id),
  kuantitasDikonsumsi: numeric('kuantitas_dikonsumsi', { precision: 18, scale: 6 })
    .notNull().default('0'),
  catatan: text('catatan'),
}, (t) => [
  index('work_order_lines_wo_idx').on(t.woId),
  check('work_order_lines_kuantitas_positif_ck', sql`${t.kuantitas} > 0`),
])
