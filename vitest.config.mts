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
  },
  resolve: {
    alias: { '@': resolve(import.meta.dirname, './src') },
  },
})
