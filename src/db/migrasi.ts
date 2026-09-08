import { muatEnv } from '@/lib/env'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

muatEnv()

async function jalankan() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL belum diatur')
  const koneksi = postgres(url, { max: 1 })
  await migrate(drizzle(koneksi), { migrationsFolder: './drizzle' })
  await koneksi.end()
  console.log('Migrasi selesai.')
}

jalankan().catch((galat) => {
  console.error(galat)
  process.exit(1)
})
