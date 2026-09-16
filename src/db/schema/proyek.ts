import {
  pgTable, uuid, text, integer, numeric, date, timestamp,
  uniqueIndex, index, check, type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { statusProyekEnum, statusTugasEnum, satuanTarifEnum } from './enum'
import { partners } from './akuntansi'
import { salesOrders } from './penjualan'
import { users } from './identitas'
import { workOrders } from './manufaktur'

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
  catatan: text('catatan'),
  /**
   * Angka job costing yang dibekukan saat proyek dikunci.
   *
   * Tanpa snapshot, laporan historis akan bergeser ketika harga pokok
   * rata-rata berubah oleh pembelian berikutnya — proyek yang sudah selesai
   * dan lunas tidak boleh berubah angkanya hanya karena ada transaksi lain.
   */
  pendapatanFinal: numeric('pendapatan_final', { precision: 18, scale: 2 }),
  /** Termasuk upah yang sudah terserap produksi; seluruhnya angka buku besar. */
  hargaPokokFinal: numeric('harga_pokok_final', { precision: 18, scale: 2 }),
  /** Pendapatan dikurangi harga pokok — laba kotor, dapat diadu dengan buku besar. */
  labaKotorFinal: numeric('laba_kotor_final', { precision: 18, scale: 2 }),
  bebanLainFinal: numeric('beban_lain_final', { precision: 18, scale: 2 }),
  /** Hanya upah yang belum terserap produksi; yang sudah terserap ada di harga pokok. */
  biayaTenagaKerjaFinal: numeric('biaya_tenaga_kerja_final', { precision: 18, scale: 2 }),
  totalHariFinal: numeric('total_hari_final', { precision: 18, scale: 2 }),
  totalJamFinal: numeric('total_jam_final', { precision: 18, scale: 2 }),
  /** Laba bersih: laba kotor dikurangi beban lain dan upah yang belum terserap. */
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
 * Pekerjaan yang tercatat pada sebuah proyek, per pegawai per tanggal.
 *
 * Timesheet sendiri tidak memposting jurnal. Upahnya menjadi angka buku besar
 * hanya lewat perintah produksi: baris yang tertaut ke sebuah perintah ikut
 * diserap ke Barang Dalam Proses sebagai biaya tenaga kerja, lalu menyatu ke
 * harga pokok barang jadi. Baris yang tidak tertaut — pemasangan di lokasi,
 * survei, pekerjaan yang tidak melewati bengkel — tetap angka manajerial dan
 * hanya muncul di laba bersih proyek.
 *
 * Pembedaan itu yang menjaga upah tidak terhitung dua kali: yang sudah masuk
 * harga pokok tidak pernah ditambahkan lagi sebagai beban tersendiri.
 */
export const timesheets = pgTable('timesheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  proyekId: uuid('proyek_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  tugasId: uuid('tugas_id').references(() => projectTasks.id, { onDelete: 'set null' }),
  /**
   * Pegawai yang mengerjakan — tukang di bengkel, bukan pengguna sistem.
   * Tukang tidak perlu punya akun untuk jam kerjanya tercatat.
   */
  pegawaiId: uuid('pegawai_id').notNull().references(() => partners.id),
  /**
   * Perintah produksi yang menyerap upah baris ini. Referensinya lazy karena
   * perintah produksi sendiri merujuk proyek di berkas ini.
   */
  woId: uuid('wo_id').references((): AnyPgColumn => workOrders.id, { onDelete: 'set null' }),
  tanggal: date('tanggal').notNull(),
  /** Banyaknya pekerjaan dalam satuan `satuanTarif`: berapa hari, atau berapa jam. */
  kuantitas: numeric('kuantitas', { precision: 18, scale: 2 }).notNull(),
  /** Tarif dan satuannya dibekukan dari pegawai saat baris ini dicatat. */
  tarif: numeric('tarif', { precision: 18, scale: 2 }).notNull().default('0'),
  satuanTarif: satuanTarifEnum('satuan_tarif').notNull().default('harian'),
  deskripsi: text('deskripsi').notNull(),
  dicatatOleh: uuid('dicatat_oleh').references(() => users.id),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('timesheets_proyek_tanggal_idx').on(t.proyekId, t.tanggal),
  index('timesheets_pegawai_idx').on(t.pegawaiId),
  index('timesheets_wo_idx').on(t.woId),
  // Satu baris adalah satu tanggal: paling banyak satu hari kerja, atau dua
  // puluh empat jam. Setengah hari ditulis 0,5.
  check(
    'timesheets_kuantitas_wajar_ck',
    sql`${t.kuantitas} > 0 AND ${t.kuantitas} <= CASE WHEN ${t.satuanTarif} = 'jam' THEN 24 ELSE 1 END`,
  ),
  check('timesheets_tarif_tidak_negatif_ck', sql`${t.tarif} >= 0`),
])
