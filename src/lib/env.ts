import { config } from 'dotenv'

/**
 * Memuat environment untuk skrip baris perintah (migrasi, seed).
 * Next.js memuat .env.local sendiri; tsx tidak, sehingga perlu eksplisit.
 */
export function muatEnv() {
  config({ path: '.env.local' })
  config({ path: '.env' })
}
