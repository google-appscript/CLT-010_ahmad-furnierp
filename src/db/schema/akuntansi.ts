import {
  pgTable, uuid, text, boolean, integer, numeric, timestamp, uniqueIndex, index,
} from 'drizzle-orm/pg-core'
import { tipeAkunEnum, tipePartnerEnum, tipeJurnalEnum, ruangLingkupPajakEnum } from './enum'
import { currencies } from './mata-uang'
import { sequences } from './konfigurasi'

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  tipeAkun: tipeAkunEnum('tipe_akun').notNull(),
  mataUangId: text('mata_uang_id').references(() => currencies.kode),
  dapatDirekonsiliasi: boolean('dapat_direkonsiliasi').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  catatan: text('catatan'),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('accounts_kode_unik').on(t.kode),
  index('accounts_tipe_idx').on(t.tipeAkun),
])

export const paymentTerms = pgTable('payment_terms', {
  id: uuid('id').primaryKey().defaultRandom(),
  nama: text('nama').notNull(),
  jumlahHari: integer('jumlah_hari').notNull().default(0),
  catatan: text('catatan'),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [uniqueIndex('payment_terms_nama_unik').on(t.nama)])

/** Pelanggan dan pemasok disimpan dalam satu tabel; satu mitra dapat keduanya. */
export const partners = pgTable('partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  tipe: tipePartnerEnum('tipe').notNull().default('badan'),
  isPelanggan: boolean('is_pelanggan').notNull().default(false),
  isPemasok: boolean('is_pemasok').notNull().default(false),
  // NPWP disimpan sebagai angka saja; pemformatan adalah urusan tampilan.
  npwp: text('npwp'),
  nik: text('nik'),
  alamat: text('alamat'),
  kota: text('kota'),
  provinsi: text('provinsi'),
  kodePos: text('kode_pos'),
  telepon: text('telepon'),
  email: text('email'),
  kontakPerson: text('kontak_person'),
  syaratPembayaranId: uuid('syarat_pembayaran_id').references(() => paymentTerms.id),
  akunPiutangId: uuid('akun_piutang_id').references(() => accounts.id),
  akunUtangId: uuid('akun_utang_id').references(() => accounts.id),
  isActive: boolean('is_active').notNull().default(true),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('partners_kode_unik').on(t.kode),
  index('partners_pelanggan_idx').on(t.isPelanggan),
  index('partners_pemasok_idx').on(t.isPemasok),
])

export const taxes = pgTable('taxes', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  ruangLingkup: ruangLingkupPajakEnum('ruang_lingkup').notNull(),
  tarif: numeric('tarif', { precision: 9, scale: 4 }).notNull(),
  hargaTermasukPajak: boolean('harga_termasuk_pajak').notNull().default(false),
  isPemotongan: boolean('is_pemotongan').notNull().default(false),
  akunPajakId: uuid('akun_pajak_id').notNull().references(() => accounts.id),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [uniqueIndex('taxes_kode_unik').on(t.kode)])

export const journals = pgTable('journals', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  tipe: tipeJurnalEnum('tipe').notNull(),
  sequenceId: uuid('sequence_id').notNull().references(() => sequences.id),
  akunDefaultDebitId: uuid('akun_default_debit_id').references(() => accounts.id),
  akunDefaultKreditId: uuid('akun_default_kredit_id').references(() => accounts.id),
  mataUangId: text('mata_uang_id').references(() => currencies.kode),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [uniqueIndex('journals_kode_unik').on(t.kode)])
