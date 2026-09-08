import {
  pgTable, uuid, text, integer, date, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core'
import { statusTahunBukuEnum, resetUrutanEnum } from './enum'
import { accounts } from './akuntansi'

export const companySettings = pgTable('company_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  nama: text('nama').notNull(),
  npwp: text('npwp'),
  alamat: text('alamat'),
  kota: text('kota'),
  provinsi: text('provinsi'),
  kodePos: text('kode_pos'),
  telepon: text('telepon'),
  email: text('email'),
  logoUrl: text('logo_url'),
  mataUangFungsional: text('mata_uang_fungsional').notNull().default('IDR'),
  bulanAwalTahunBuku: integer('bulan_awal_tahun_buku').notNull().default(1),
  // Entri bertanggal pada atau sebelum tanggal ini tidak dapat dibuat,
  // diubah, maupun dihapus — termasuk oleh proses otomatis modul lain.
  tanggalKunciBuku: date('tanggal_kunci_buku'),
  tanggalKunciPajak: date('tanggal_kunci_pajak'),
  akunLabaDitahanId: uuid('akun_laba_ditahan_id').references(() => accounts.id),
  akunSelisihKursUntungId: uuid('akun_selisih_kurs_untung_id').references(() => accounts.id),
  akunSelisihKursRugiId: uuid('akun_selisih_kurs_rugi_id').references(() => accounts.id),
  akunPembulatanId: uuid('akun_pembulatan_id').references(() => accounts.id),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
})

export const fiscalYears = pgTable('fiscal_years', {
  id: uuid('id').primaryKey().defaultRandom(),
  nama: text('nama').notNull(),
  tanggalMulai: date('tanggal_mulai').notNull(),
  tanggalSelesai: date('tanggal_selesai').notNull(),
  status: statusTahunBukuEnum('status').notNull().default('terbuka'),
  entryPenutupId: uuid('entry_penutup_id'),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('fiscal_years_nama_unik').on(t.nama)])

export const sequences = pgTable('sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  prefix: text('prefix').notNull(),
  panjangDigit: integer('panjang_digit').notNull().default(4),
  nomorBerikut: integer('nomor_berikut').notNull().default(1),
  reset: resetUrutanEnum('reset').notNull().default('tahunan'),
  tahunTerakhir: integer('tahun_terakhir'),
  bulanTerakhir: integer('bulan_terakhir'),
}, (t) => [uniqueIndex('sequences_kode_unik').on(t.kode)])
