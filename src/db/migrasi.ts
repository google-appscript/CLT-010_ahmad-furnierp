import { muatEnv } from '@/lib/env'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

muatEnv()

/**
 * Basis data yang ditunjuk sebuah URL, tanpa kredensialnya.
 *
 * Nama host pooler Neon hanyalah nama host langsungnya ditambah `-pooler`,
 * sehingga imbuhan itu dibuang agar dua URL yang menunjuk basis data sama
 * dikenali sama meski satu lewat pooler dan satunya tidak.
 */
function identitas(url: string): string {
  const { hostname, pathname } = new URL(url)
  return `${hostname.replace('-pooler', '')}${pathname}`
}

/**
 * Memilih koneksi untuk migrasi.
 *
 * Koneksi langsung lebih disukai daripada pooler: perintah DDL berjalan sebagai
 * satu transaksi panjang, dan pooler dalam mode transaksi — seperti bawaan
 * Neon — dapat memindahkan pernyataan berikutnya ke sesi lain di tengah jalan.
 *
 * Tetapi keduanya wajib menunjuk basis data yang sama. Pada mesin pengembang,
 * `DATABASE_URL` kerap menunjuk Postgres lokal sementara `DATABASE_URL_UNPOOLED`
 * masih berisi sisa sambungan produksi. Mendahulukan yang satu secara diam-diam
 * berarti memigrasi basis data yang sama sekali berbeda dari yang dipakai
 * aplikasi — kekeliruan yang baru ketahuan setelah produksi tersentuh. Bila
 * keduanya berselisih, skrip ini berhenti dan meminta manusia memutuskan.
 */
function pilihKoneksi(): string {
  const pooled = process.env.DATABASE_URL
  const langsung = process.env.DATABASE_URL_UNPOOLED

  if (!pooled && !langsung) throw new Error('DATABASE_URL belum diatur')
  if (!langsung) return pooled!
  if (!pooled) return langsung

  if (identitas(pooled) !== identitas(langsung)) {
    // Bila keduanya berselisih, yang dipakai aplikasi yang menang. Menebak ke
    // arah sebaliknya pernah membuat migrasi dari mesin pengembang mendarat di
    // basis data produksi.
    console.warn(
      'Peringatan: DATABASE_URL dan DATABASE_URL_UNPOOLED menunjuk basis data berbeda.\n' +
      `  DATABASE_URL          -> ${identitas(pooled)}  (dipakai)\n` +
      `  DATABASE_URL_UNPOOLED -> ${identitas(langsung)}  (diabaikan)\n` +
      'Kosongkan DATABASE_URL_UNPOOLED bila ia sisa dari lingkungan lain.',
    )
    return pooled
  }
  return langsung
}

async function jalankan() {
  const url = pilihKoneksi()
  console.log(`Migrasi menuju ${identitas(url)}`)
  const koneksi = postgres(url, { max: 1 })
  await migrate(drizzle(koneksi), { migrationsFolder: './drizzle' })
  await koneksi.end()
  console.log('Migrasi selesai.')
}

jalankan().catch((galat) => {
  console.error(galat)
  process.exit(1)
})
