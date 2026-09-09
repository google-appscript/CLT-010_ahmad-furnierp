import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { users } from './identitas'

export const filterTersimpan = pgTable('filter_tersimpan', {
  id: uuid('id').primaryKey().defaultRandom(),
  penggunaId: uuid('pengguna_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kunciDaftar: text('kunci_daftar').notNull(),
  nama: text('nama').notNull(),
  kriteria: jsonb('kriteria').notNull(),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
})
