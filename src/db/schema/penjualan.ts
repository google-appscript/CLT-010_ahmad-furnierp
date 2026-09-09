import {
  pgTable, uuid, text, integer, numeric, date, timestamp,
  uniqueIndex, index, check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  statusPenjualanEnum, tipeFakturEnum, statusTagihanEnum, statusPembayaranEnum,
} from './enum'
import { accounts, partners, taxes, paymentTerms } from './akuntansi'
import { currencies } from './mata-uang'
import { journalEntries } from './jurnal'
import { products, uoms, locations } from './gudang'
import { users } from './identitas'

export const salesOrders = pgTable('sales_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Nomor diberikan saat penawaran dikonfirmasi menjadi pesanan.
  nomor: text('nomor'),
  status: statusPenjualanEnum('status').notNull().default('penawaran'),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  tanggal: date('tanggal').notNull(),
  tanggalPengiriman: date('tanggal_pengiriman'),
  /** Lokasi internal asal pengiriman barang. */
  lokasiAsalId: uuid('lokasi_asal_id').notNull().references(() => locations.id),
  syaratPembayaranId: uuid('syarat_pembayaran_id').references(() => paymentTerms.id),
  mataUangId: text('mata_uang_id').notNull().default('IDR').references(() => currencies.kode),
  referensi: text('referensi'),
  catatan: text('catatan'),
  dikonfirmasiPada: timestamp('dikonfirmasi_pada', { withTimezone: true }),
  dikonfirmasiOleh: uuid('dikonfirmasi_oleh').references(() => users.id),
  dibuatOleh: uuid('dibuat_oleh').references(() => users.id),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('sales_orders_nomor_unik').on(t.nomor).where(sql`${t.nomor} IS NOT NULL`),
  index('sales_orders_status_idx').on(t.status),
  index('sales_orders_partner_idx').on(t.partnerId),
  index('sales_orders_tanggal_idx').on(t.tanggal),
])

export const salesOrderLines = pgTable('sales_order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  soId: uuid('so_id').notNull().references(() => salesOrders.id, { onDelete: 'cascade' }),
  urutan: integer('urutan').notNull().default(1),
  produkId: uuid('produk_id').notNull().references(() => products.id),
  deskripsi: text('deskripsi').notNull(),
  kuantitas: numeric('kuantitas', { precision: 18, scale: 6 }).notNull(),
  uomId: uuid('uom_id').notNull().references(() => uoms.id),
  hargaSatuan: numeric('harga_satuan', { precision: 18, scale: 6 }).notNull(),
  taxId: uuid('tax_id').references(() => taxes.id),
  kuantitasDikirim: numeric('kuantitas_dikirim', { precision: 18, scale: 6 })
    .notNull().default('0'),
  kuantitasDifakturkan: numeric('kuantitas_difakturkan', { precision: 18, scale: 6 })
    .notNull().default('0'),
}, (t) => [
  index('sales_order_lines_so_idx').on(t.soId),
  check('sales_order_lines_kuantitas_positif_ck', sql`${t.kuantitas} > 0`),
  check('sales_order_lines_harga_ck', sql`${t.hargaSatuan} >= 0`),
])

export const customerInvoices = pgTable('customer_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  nomor: text('nomor'),
  tipe: tipeFakturEnum('tipe').notNull().default('faktur'),
  status: statusTagihanEnum('status').notNull().default('draft'),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  soId: uuid('so_id').references(() => salesOrders.id),
  tanggal: date('tanggal').notNull(),
  tanggalJatuhTempo: date('tanggal_jatuh_tempo'),
  referensi: text('referensi'),
  mataUangId: text('mata_uang_id').notNull().default('IDR').references(() => currencies.kode),
  kurs: numeric('kurs', { precision: 18, scale: 6 }).notNull().default('1'),
  catatan: text('catatan'),
  jurnalEntryId: uuid('jurnal_entry_id').references(() => journalEntries.id),
  dipostingPada: timestamp('diposting_pada', { withTimezone: true }),
  dipostingOleh: uuid('diposting_oleh').references(() => users.id),
  dibuatOleh: uuid('dibuat_oleh').references(() => users.id),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('customer_invoices_nomor_unik').on(t.nomor).where(sql`${t.nomor} IS NOT NULL`),
  index('customer_invoices_status_idx').on(t.status),
  index('customer_invoices_partner_idx').on(t.partnerId),
  index('customer_invoices_so_idx').on(t.soId),
  index('customer_invoices_tanggal_idx').on(t.tanggal),
])

export const customerInvoiceLines = pgTable('customer_invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull()
    .references(() => customerInvoices.id, { onDelete: 'cascade' }),
  urutan: integer('urutan').notNull().default(1),
  produkId: uuid('produk_id').references(() => products.id),
  soLineId: uuid('so_line_id').references(() => salesOrderLines.id),
  deskripsi: text('deskripsi').notNull(),
  kuantitas: numeric('kuantitas', { precision: 18, scale: 6 }).notNull(),
  uomId: uuid('uom_id').references(() => uoms.id),
  hargaSatuan: numeric('harga_satuan', { precision: 18, scale: 6 }).notNull(),
  taxId: uuid('tax_id').references(() => taxes.id),
  /** Akun pendapatan yang dikredit. */
  akunId: uuid('akun_id').notNull().references(() => accounts.id),
}, (t) => [
  index('customer_invoice_lines_invoice_idx').on(t.invoiceId),
  check('customer_invoice_lines_kuantitas_positif_ck', sql`${t.kuantitas} > 0`),
])

export const customerPayments = pgTable('customer_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  nomor: text('nomor'),
  status: statusPembayaranEnum('status').notNull().default('draft'),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  tanggal: date('tanggal').notNull(),
  /** Akun kas atau bank yang didebit. */
  akunKasId: uuid('akun_kas_id').notNull().references(() => accounts.id),
  jumlah: numeric('jumlah', { precision: 18, scale: 2 }).notNull(),
  referensi: text('referensi'),
  catatan: text('catatan'),
  jurnalEntryId: uuid('jurnal_entry_id').references(() => journalEntries.id),
  dipostingPada: timestamp('diposting_pada', { withTimezone: true }),
  dipostingOleh: uuid('diposting_oleh').references(() => users.id),
  dibuatOleh: uuid('dibuat_oleh').references(() => users.id),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('customer_payments_nomor_unik').on(t.nomor).where(sql`${t.nomor} IS NOT NULL`),
  index('customer_payments_partner_idx').on(t.partnerId),
  index('customer_payments_tanggal_idx').on(t.tanggal),
  check('customer_payments_jumlah_positif_ck', sql`${t.jumlah} > 0`),
])

export const customerPaymentAllocations = pgTable('customer_payment_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  pembayaranId: uuid('pembayaran_id').notNull()
    .references(() => customerPayments.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').notNull().references(() => customerInvoices.id),
  jumlah: numeric('jumlah', { precision: 18, scale: 2 }).notNull(),
}, (t) => [
  index('customer_payment_allocations_pembayaran_idx').on(t.pembayaranId),
  index('customer_payment_allocations_invoice_idx').on(t.invoiceId),
  check('customer_payment_allocations_jumlah_positif_ck', sql`${t.jumlah} > 0`),
])

/**
 * Satu kelompok rekonsiliasi menghubungkan item jurnal yang saling menutup —
 * misalnya piutang dari faktur dengan pelunasannya. Kelompok hanya sah bila
 * jumlah debit dan kreditnya sama, sehingga tidak ada nilai yang hilang saat
 * item ditandai selesai.
 */
export const reconciliations = pgTable('reconciliations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tanggal: date('tanggal').notNull(),
  /** Diisi 'otomatis' bila dibuat sistem saat pembayaran diposting. */
  asal: text('asal').notNull().default('manual'),
  catatan: text('catatan'),
  dibuatOleh: uuid('dibuat_oleh').references(() => users.id),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
})
