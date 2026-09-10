import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globalSetup: ['./tests/setup-global.ts'],
    setupFiles: ['./tests/setup-env.ts'],
    environment: 'node',
    // Pengujian berbagi satu basis data; menjalankannya paralel akan saling
    // menghapus data antar berkas.
    fileParallelism: false,
    // Worktree sesi lain berada di dalam repositori ini dan membawa salinan
    // berkas ujinya sendiri. Tanpa pengecualian ini, Vitest menjalankan
    // keduanya terhadap satu basis data yang sama dan hasilnya saling
    // menimpa.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
  },
  resolve: {
    alias: { '@': resolve(import.meta.dirname, './src') },
  },
})
