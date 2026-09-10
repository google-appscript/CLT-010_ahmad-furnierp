import {
  pgTable, uuid, text, integer, numeric, date, timestamp,
  uniqueIndex, index, check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { statusProyekEnum, statusTugasEnum } from './enum'
import { partners } from './akuntansi'
import { salesOrders } from './penjualan'
import { users } from './identitas'

/**
 * Satu proyek selalu mengikuti tepat satu pesanan penjualan — itulah yang
 * membuat pendapatannya dapat dihitung tanpa alokasi: apa pun yang difakturkan
 * atas pesanan itu adalah pendapatan proyek ini.
 */
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  soId: uuid('so_id').notNull().references(() => salesOrders.id),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  status: statusProyekEnum('status').notNull().default('draft'),
  tanggalMulai: date('tanggal_mulai').notNull(),
  tanggalTarget: date('tanggal_target'),
  tanggalSelesai: date('tanggal_selesai'),
  manajerId: uuid('manajer_id').references(() => users.id),
  /**
   * Tarif jam kerja bawaan proyek. Timesheet menyalinnya saat dicatat, bukan
   * membacanya kembali saat laporan disusun, sehingga menaikkan tarif tidak
   * mengubah biaya pekerjaan yang sudah lewat.
   */
  tarifPerJam: numeric('tarif_per_jam', { precision: 18, scale: 2 }).notNull().default('0'),
  catatan: text('catatan'),
  /**
   * Angka job costing yang dibekukan saat proyek dikunci.
   *
   * Tanpa snapshot, laporan historis akan bergeser ketika harga pokok
   * rata-rata berubah oleh pembelian berikutnya — proyek yang sudah selesai
   * dan lunas tidak boleh berubah angkanya hanya karena ada transaksi lain.
   */
  pendapatanFinal: numeric('pendapatan_final', { precision: 18, scale: 2 }),
  hargaPokokFinal: numeric('harga_pokok_final', { precision: 18, scale: 2 }),
  bebanLainFinal: numeric('beban_lain_final', { precision: 18, scale: 2 }),
  biayaTenagaKerjaFinal: numeric('biaya_tenaga_kerja_final', { precision: 18, scale: 2 }),
  totalJamFinal: numeric('total_jam_final', { precision: 18, scale: 2 }),
  labaFinal: numeric('laba_final', { precision: 18, scale: 2 }),
  dikunciPada: timestamp('dikunci_pada', { withTimezone: true }),
  dikunciOleh: uuid('dikunci_oleh').references(() => users.id),
  dibuatOleh: uuid('dibuat_oleh').references(() => users.id),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('projects_kode_unik').on(t.kode),
  // Satu pesanan penjualan tidak boleh dipegang dua proyek.
  uniqueIndex('projects_so_unik').on(t.soId),
  index('projects_status_idx').on(t.status),
  check('projects_tarif_tidak_negatif_ck', sql`${t.tarifPerJam} >= 0`),
])

export const projectTasks = pgTable('project_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  proyekId: uuid('proyek_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  urutan: integer('urutan').notNull().default(1),
  nama: text('nama').notNull(),
  deskripsi: text('deskripsi'),
  status: statusTugasEnum('status').notNull().default('belum_mulai'),
  penanggungJawabId: uuid('penanggung_jawab_id').references(() => users.id),
  tanggalMulai: date('tanggal_mulai'),
  tenggat: date('tenggat'),
  estimasiJam: numeric('estimasi_jam', { precision: 18, scale: 2 }).notNull().default('0'),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('project_tasks_proyek_idx').on(t.proyekId),
  index('project_tasks_status_idx').on(t.status),
  check('project_tasks_estimasi_tidak_negatif_ck', sql`${t.estimasiJam} >= 0`),
])

/**
 * Jam kerja yang tercatat pada sebuah proyek. Timesheet tidak memposting
 * jurnal — tanpa modul penggajian, upahnya belum benar-benar terjadi sebagai
 * transaksi. Biayanya muncul sebagai angka manajerial di laporan
 * profitabilitas, terpisah dari angka yang berasal dari buku besar.
 */
export const timesheets = pgTable('timesheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  proyekId: uuid('proyek_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  tugasId: uuid('tugas_id').references(() => projectTasks.id, { onDelete: 'set null' }),
  penggunaId: uuid('pengguna_id').notNull().references(() => users.id),
  tanggal: date('tanggal').notNull(),
  jam: numeric('jam', { precision: 18, scale: 2 }).notNull(),
  /** Tarif dibekukan dari proyek saat baris ini dicatat. */
  tarifPerJam: numeric('tarif_per_jam', { precision: 18, scale: 2 }).notNull().default('0'),
  deskripsi: text('deskripsi').notNull(),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('timesheets_proyek_tanggal_idx').on(t.proyekId, t.tanggal),
  index('timesheets_pengguna_idx').on(t.penggunaId),
  check('timesheets_jam_positif_ck', sql`${t.jam} > 0 AND ${t.jam} <= 24`),
  check('timesheets_tarif_tidak_negatif_ck', sql`${t.tarifPerJam} >= 0`),
])
