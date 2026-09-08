import {
  pgTable, uuid, text, integer, boolean, date, numeric, uniqueIndex, index,
} from 'drizzle-orm/pg-core'

export const currencies = pgTable('currencies', {
  kode: text('kode').primaryKey(),
  nama: text('nama').notNull(),
  simbol: text('simbol').notNull(),
  desimal: integer('desimal').notNull().default(2),
  isActive: boolean('is_active').notNull().default(true),
})

/** `kurs` bermakna jumlah IDR per satu unit mata uang asing. */
export const currencyRates = pgTable('currency_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  kodeMataUang: text('kode_mata_uang').notNull()
    .references(() => currencies.kode, { onDelete: 'cascade' }),
  tanggal: date('tanggal').notNull(),
  kurs: numeric('kurs', { precision: 18, scale: 6 }).notNull(),
}, (t) => [
  uniqueIndex('currency_rates_unik').on(t.kodeMataUang, t.tanggal),
  index('currency_rates_pencarian_idx').on(t.kodeMataUang, t.tanggal),
])
