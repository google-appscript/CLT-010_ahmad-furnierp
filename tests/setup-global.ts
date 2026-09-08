import { existsSync } from 'node:fs'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

config({ path: '.env.test', override: true })

export default async function setup() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL belum diatur di .env.test')

  // Sampai skema pertama dibuat, folder migrasi belum ada.
  if (!existsSync('./drizzle')) return

  const koneksi = postgres(url, { max: 1 })
  await migrate(drizzle(koneksi), { migrationsFolder: './drizzle' })
  await koneksi.end()
}
