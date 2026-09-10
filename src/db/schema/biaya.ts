import {
  pgTable, uuid, text, numeric, timestamp, boolean,
  uniqueIndex, index, check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { journalItems } from './jurnal'
import { locations } from './gudang'

/**
 * Pos biaya — unit kerja yang menanggung beban operasional.
 *
 * Berbeda dari proyek: proyek punya awal dan akhir, sedangkan pos biaya
 * adalah pembagian permanen perusahaan. Keduanya berdampingan sebagai dua
 * dimensi terpisah pada item jurnal, sehingga sebuah beban dapat sekaligus
 * milik Workshop dan proyek tertentu.
 */
export const costCenters = pgTable('cost_centers', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  deskripsi: text('deskripsi'),
  isActive: boolean('is_active').notNull().default(true),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('cost_centers_kode_unik').on(t.kode)])

/**
 * Alokasi sebuah item jurnal ke satu atau beberapa pos biaya.
 *
 * Dibuat sebagai tabel tersendiri, bukan satu kolom pada item jurnal, karena
 * satu pengeluaran sering ditanggung beberapa unit sekaligus — tagihan
 * listrik satu gedung yang dipakai workshop dan showroom, misalnya. Item
 * jurnalnya tetap satu baris utuh sehingga buku besar terbaca apa adanya;
 * pembagiannya hidup di sini.
 *
 * Satu pos saja tetap direkam sebagai satu baris berpersentase seratus, agar
 * pelaporan tidak perlu membedakan dua bentuk penyimpanan.
 */
export const journalItemCostAllocations = pgTable('journal_item_cost_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull()
    .references(() => journalItems.id, { onDelete: 'cascade' }),
  costCenterId: uuid('cost_center_id').notNull().references(() => costCenters.id),
  persentase: numeric('persentase', { precision: 9, scale: 4 }).notNull(),
  /** Nilai rupiah bagian ini; jumlah seluruh baris sama dengan nilai itemnya. */
  nilai: numeric('nilai', { precision: 18, scale: 2 }).notNull(),
}, (t) => [
  uniqueIndex('journal_item_cost_allocations_unik').on(t.itemId, t.costCenterId),
  index('journal_item_cost_allocations_pos_idx').on(t.costCenterId),
  check(
    'journal_item_cost_allocations_persentase_ck',
    sql`${t.persentase} > 0 AND ${t.persentase} <= 100`,
  ),
])

/**
 * Pos biaya bawaan sebuah lokasi gudang.
 *
 * Operator tidak perlu memilih pos untuk setiap pergerakan stok; pergerakan
 * yang berasal dari Gudang Bahan Baku menanggung pos Bahan Baku dengan
 * sendirinya. Pilihan manual tetap mengalahkan bawaan ini.
 */
export const locationCostCenters = pgTable('location_cost_centers', {
  id: uuid('id').primaryKey().defaultRandom(),
  lokasiId: uuid('lokasi_id').notNull()
    .references(() => locations.id, { onDelete: 'cascade' }),
  costCenterId: uuid('cost_center_id').notNull().references(() => costCenters.id),
}, (t) => [uniqueIndex('location_cost_centers_lokasi_unik').on(t.lokasiId)])
