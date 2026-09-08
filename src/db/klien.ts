import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL belum diatur')

export const koneksi = postgres(url, { max: 10 })
export const db = drizzle(koneksi, { schema })

export type Basis = typeof db
export type Transaksi = Parameters<Parameters<typeof db.transaction>[0]>[0]
