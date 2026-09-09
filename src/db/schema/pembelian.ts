import {
  pgTable, uuid, text, integer, numeric, date, timestamp,
  uniqueIndex, index, check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  statusPembelianEnum, statusTagihanEnum, tipeTagihanEnum, statusPembayaranEnum,
} from './enum'
import { accounts, partners, taxes, paymentTerms } from './akuntansi'
import { currencies } from './mata-uang'
import { journalEntries } from './jurnal'
import { products, uoms, locations } from './gudang'
import { users } from './identitas'

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Nomor diberikan saat permintaan dikonfirmasi menjadi pesanan.
  nomor: text('nomor'),
  status: statusPembelianEnum('status').notNull().default('permintaan'),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  tanggal: date('tanggal').notNull(),
  tanggalDiharapkan: date('tanggal_diharapkan'),
  /** Lokasi internal tujuan penerimaan barang. */
  lokasiTujuanId: uuid('lokasi_tujuan_id').notNull().references(() => locations.id),
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
  uniqueIndex('purchase_orders_nomor_unik').on(t.nomor).where(sql`${t.nomor} IS NOT NULL`),
  index('purchase_orders_status_idx').on(t.status),
  index('purchase_orders_partner_idx').on(t.partnerId),
  index('purchase_orders_tanggal_idx').on(t.tanggal),
])

/**
 * Kuantitas yang sudah diterima dan sudah ditagih disimpan di baris pesanan.
 * Keduanya adalah cerminan yang diperbarui saat penerimaan dan tagihan
 * diselesaikan; sumber kebenarannya tetap dokumen masing-masing.
 */
export const purchaseOrderLines = pgTable('purchase_order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  poId: uuid('po_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  urutan: integer('urutan').notNull().default(1),
  produkId: uuid('produk_id').notNull().references(() => products.id),
  deskripsi: text('deskripsi').notNull(),
  kuantitas: numeric('kuantitas', { precision: 18, scale: 6 }).notNull(),
  uomId: uuid('uom_id').notNull().references(() => uoms.id),
  hargaSatuan: numeric('harga_satuan', { precision: 18, scale: 6 }).notNull(),
  taxId: uuid('tax_id').references(() => taxes.id),
  kuantitasDiterima: numeric('kuantitas_diterima', { precision: 18, scale: 6 })
    .notNull().default('0'),
  kuantitasDitagih: numeric('kuantitas_ditagih', { precision: 18, scale: 6 })
    .notNull().default('0'),
}, (t) => [
  index('purchase_order_lines_po_idx').on(t.poId),
  check('purchase_order_lines_kuantitas_positif_ck', sql`${t.kuantitas} > 0`),
  check('purchase_order_lines_harga_ck', sql`${t.hargaSatuan} >= 0`),
])

export const vendorBills = pgTable('vendor_bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  nomor: text('nomor'),
  tipe: tipeTagihanEnum('tipe').notNull().default('tagihan'),
  status: statusTagihanEnum('status').notNull().default('draft'),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  poId: uuid('po_id').references(() => purchaseOrders.id),
  tanggal: date('tanggal').notNull(),
  tanggalJatuhTempo: date('tanggal_jatuh_tempo'),
  /** Nomor faktur yang diterbitkan pemasok. */
  referensiPemasok: text('referensi_pemasok'),
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
  uniqueIndex('vendor_bills_nomor_unik').on(t.nomor).where(sql`${t.nomor} IS NOT NULL`),
  index('vendor_bills_status_idx').on(t.status),
  index('vendor_bills_partner_idx').on(t.partnerId),
  index('vendor_bills_po_idx').on(t.poId),
  index('vendor_bills_tanggal_idx').on(t.tanggal),
])

export const vendorBillLines = pgTable('vendor_bill_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  billId: uuid('bill_id').notNull().references(() => vendorBills.id, { onDelete: 'cascade' }),
  urutan: integer('urutan').notNull().default(1),
  produkId: uuid('produk_id').references(() => products.id),
  /** Baris tagihan yang berasal dari pesanan, dipakai memperbarui kuantitas ditagih. */
  poLineId: uuid('po_line_id').references(() => purchaseOrderLines.id),
  deskripsi: text('deskripsi').notNull(),
  kuantitas: numeric('kuantitas', { precision: 18, scale: 6 }).notNull(),
  uomId: uuid('uom_id').references(() => uoms.id),
  hargaSatuan: numeric('harga_satuan', { precision: 18, scale: 6 }).notNull(),
  taxId: uuid('tax_id').references(() => taxes.id),
  /**
   * Akun yang didebit. Untuk baris yang berasal dari penerimaan, ini adalah
   * akun Penerimaan Barang Belum Ditagih sehingga tagihan menutupnya. Untuk
   * biaya lain, ini akun beban yang bersangkutan.
   */
  akunId: uuid('akun_id').notNull().references(() => accounts.id),
}, (t) => [
  index('vendor_bill_lines_bill_idx').on(t.billId),
  check('vendor_bill_lines_kuantitas_positif_ck', sql`${t.kuantitas} > 0`),
])

export const vendorPayments = pgTable('vendor_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  nomor: text('nomor'),
  status: statusPembayaranEnum('status').notNull().default('draft'),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  tanggal: date('tanggal').notNull(),
  /** Akun kas atau bank yang dikredit. */
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
  uniqueIndex('vendor_payments_nomor_unik').on(t.nomor).where(sql`${t.nomor} IS NOT NULL`),
  index('vendor_payments_partner_idx').on(t.partnerId),
  index('vendor_payments_tanggal_idx').on(t.tanggal),
  check('vendor_payments_jumlah_positif_ck', sql`${t.jumlah} > 0`),
])

/**
 * Alokasi pembayaran ke tagihan. Satu pembayaran dapat menutup beberapa
 * tagihan sekaligus, dan satu tagihan dapat dilunasi dengan beberapa
 * pembayaran; jumlah alokasi inilah yang menentukan sisa tagihan.
 */
export const vendorPaymentAllocations = pgTable('vendor_payment_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  pembayaranId: uuid('pembayaran_id').notNull()
    .references(() => vendorPayments.id, { onDelete: 'cascade' }),
  billId: uuid('bill_id').notNull().references(() => vendorBills.id),
  jumlah: numeric('jumlah', { precision: 18, scale: 2 }).notNull(),
}, (t) => [
  index('vendor_payment_allocations_pembayaran_idx').on(t.pembayaranId),
  index('vendor_payment_allocations_bill_idx').on(t.billId),
  check('vendor_payment_allocations_jumlah_positif_ck', sql`${t.jumlah} > 0`),
])
