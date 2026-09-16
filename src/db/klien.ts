import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL belum diatur')

/**
 * Lingkungan tanpa server menjalankan banyak salinan proses ini sekaligus, dan
 * setiap salinan memegang kolam koneksinya sendiri. Kolam sepuluh koneksi per
 * salinan cepat menghabiskan jatah koneksi basis data begitu ada beberapa
 * permintaan berbarengan, dan sisanya mengantre — tampak sebagai halaman yang
 * lambat, bukan sebagai galat. Satu koneksi per salinan sudah cukup karena tiap
 * permintaan hanya melayani satu pengguna.
 */
const tanpaServer = Boolean(process.env.VERCEL)

/**
 * Pooler dalam mode transaksi — seperti endpoint berpooler milik Neon —
 * memindahkan pernyataan berikutnya ke sesi lain, sehingga pernyataan yang
 * sudah disiapkan di sesi sebelumnya tidak dikenali lagi.
 */
const lewatPooler = url.includes('-pooler.')

export const koneksi = postgres(url, {
  max: tanpaServer ? 1 : 10,
  prepare: !lewatPooler,
  // Koneksi menganggur ditutup supaya salinan yang sudah tidak melayani
  // permintaan tidak terus memegang jatah koneksi.
  idle_timeout: tanpaServer ? 20 : undefined,
})
export const db = drizzle(koneksi, { schema })

export type Basis = typeof db
export type Transaksi = Parameters<Parameters<typeof db.transaction>[0]>[0]
