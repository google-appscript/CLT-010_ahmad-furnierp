import { muatEnv } from '@/lib/env'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

muatEnv()

/**
 * Migrasi memakai koneksi langsung bila tersedia, bukan lewat pooler.
 * Perintah DDL dijalankan sebagai satu transaksi panjang, dan pooler dalam
 * mode transaksi — seperti bawaan Neon — dapat memindahkan pernyataan
 * berikutnya ke sesi lain di tengah jalan. Skrip ini hanya butuh satu koneksi,
 * jadi tidak ada gunanya melewati pooler sama sekali.
 */
async function jalankan() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
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
