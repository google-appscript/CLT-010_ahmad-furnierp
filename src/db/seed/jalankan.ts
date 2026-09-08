import { muatEnv } from '@/lib/env'

muatEnv()

async function main() {
  const { jalankanSeed } = await import('./index')
  const { koneksi } = await import('@/db/klien')
  await jalankanSeed()
  await koneksi.end()
  console.log('Seed data awal selesai.')
}

main().catch((galat) => {
  console.error(galat)
  process.exit(1)
})
