# Fase 1A — Fondasi Teknis & Master Data: Rencana Implementasi

> **Untuk pekerja agentik:** SUB-SKILL WAJIB: Gunakan superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengeksekusi rencana ini tugas demi tugas. Langkah memakai sintaks checkbox (`- [ ]`) untuk pelacakan.

**Goal:** Membangun aplikasi ERP yang berjalan dengan autentikasi, RBAC, navigasi lengkap, dan seluruh master data akuntansi (Bagan Akun, Mitra Usaha, Pajak, Syarat Pembayaran, Jurnal, Mata Uang) dapat dikelola melalui antarmuka berbahasa Indonesia.

**Architecture:** Modular monolith Next.js App Router. UI memanggil Server Action, Action memanggil layanan (service), dan hanya layanan yang menyentuh repositori. Skema basis data didefinisikan sebagai kode Drizzle dengan migrasi terversi. Seluruh nilai uang diperlakukan sebagai string desimal, tidak pernah sebagai `number`.

**Tech Stack:** Next.js (App Router) · TypeScript · Drizzle ORM · PostgreSQL 18 · Auth.js v5 · shadcn/ui · Tailwind CSS · Vitest · decimal.js · Zod · pnpm

**Spec:** `docs/superpowers/specs/2026-09-08-fondasi-akuntansi-design.md`
**Acuan arsitektur:** `docs/superpowers/specs/2026-09-08-arsitektur-erp-design.md`

## Global Constraints

Persyaratan berikut berlaku untuk **setiap** tugas dalam rencana ini.

- **Bahasa antarmuka:** Seluruh label, pesan validasi, judul halaman, dan teks tombol berbahasa Indonesia dengan ejaan lengkap. Identifier kode (nama variabel, fungsi, tabel, kolom) juga berbahasa Indonesia untuk istilah domain; istilah teknis framework tetap dalam bentuk aslinya.
- **Presisi uang:** Uang tidak pernah disimpan atau dihitung sebagai `float` maupun `number` JavaScript. PostgreSQL memakai `numeric(18,2)` untuk IDR dan `numeric(18,6)` untuk mata uang asing serta kurs. TypeScript membawa nilai sebagai `string`; aritmatika hanya lewat `src/lib/uang.ts`.
- **Batas modul:** UI → Server Action → layanan → repositori. Komponen UI tidak boleh mengimpor repositori atau klien basis data secara langsung.
- **Mata uang fungsional:** `IDR`. Kurs bermakna jumlah IDR per satu unit mata uang asing.
- **Nama tabel:** snake_case dalam bahasa Inggris untuk tabel yang sudah ditetapkan di spec (`users`, `accounts`, `partners`, `journals`, dan seterusnya). Nama kolom domain memakai bahasa Indonesia sesuai spec.
- **Node runtime:** Node.js 24. Package manager: `pnpm`.
- **Basis data pengembangan:** PostgreSQL 18 lokal, socket `/var/run/postgresql:5432`.
- **TDD:** Setiap tugas menulis pengujian yang gagal lebih dulu, menjalankannya untuk memastikan gagal, baru menulis implementasi minimal.
- **Commit:** Setiap tugas diakhiri satu commit dengan pesan Conventional Commits berbahasa Indonesia.

---

## Struktur Berkas

Berkas yang dibuat pada Fase 1A, beserta tanggung jawab masing-masing.

```
drizzle.config.ts                     konfigurasi drizzle-kit
vitest.config.ts                      konfigurasi Vitest + globalSetup
.env.local / .env.test                URL basis data pengembangan dan pengujian

src/db/
  klien.ts                            koneksi postgres.js + instans Drizzle
  schema/
    index.ts                          re-export seluruh skema
    identitas.ts                      users, roles, permissions, relasi, audit_logs
    konfigurasi.ts                    company_settings, fiscal_years, sequences
    mata-uang.ts                      currencies, currency_rates
    akuntansi.ts                      accounts, partners, taxes, payment_terms, journals
    enum.ts                           seluruh pgEnum bersama

src/lib/
  uang.ts                             aritmatika desimal + format Rupiah
  izin.ts                             evaluasi kode permission dan wildcard
  navigasi.ts                         definisi tunggal seluruh menu sidebar
  sesi.ts                             pembacaan sesi + penjagaan izin di server

src/modules/akuntansi/
  repositori/                         akses basis data per entitas
  layanan/                            aturan bisnis; satu-satunya penulis ke repositori
  validasi/                           skema Zod per entitas

src/app/
  (auth)/masuk/page.tsx               halaman login
  (app)/layout.tsx                    kerangka aplikasi + sidebar
  (app)/akuntansi/konfigurasi/...     halaman master data
  api/auth/[...nextauth]/route.ts     handler Auth.js

src/components/
  tata-letak/sidebar.tsx              sidebar accordion
  tata-letak/palet-perintah.tsx       command palette Ctrl+K
  data/tabel-data.tsx                 tabel generik dapat dipakai ulang

tests/
  setup-global.ts                     menjalankan migrasi ke basis data pengujian
  bantuan/db.ts                       pembersihan tabel antar pengujian
```

---

## Task 1: Scaffolding Proyek, Koneksi Basis Data, dan Infrastruktur Pengujian

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `drizzle.config.ts`, `vitest.config.ts`
- Create: `src/db/klien.ts`, `src/db/schema/index.ts`
- Create: `tests/setup-global.ts`, `tests/bantuan/db.ts`
- Create: `.env.local`, `.env.test`, `.env.example`
- Test: `tests/db/koneksi.test.ts`

**Interfaces:**
- Consumes: — (tugas pertama)
- Produces:
  - `db` — instans Drizzle, diekspor dari `src/db/klien.ts`
  - `koneksi` — instans klien postgres.js mentah, diekspor dari `src/db/klien.ts`
  - `bersihkanTabel(namaTabel: string[]): Promise<void>` dari `tests/bantuan/db.ts`

- [ ] **Step 1: Scaffold Next.js**

Direktori sudah berisi `.git` dan `docs/`. Jalankan di akar proyek:

```bash
pnpm dlx create-next-app@latest . \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-pnpm --turbopack --yes
```

Bila create-next-app menolak karena direktori tidak kosong, jawab ya untuk melanjutkan — berkas `docs/` dan `.git` tidak akan disentuh.

- [ ] **Step 2: Pasang dependensi**

```bash
pnpm add drizzle-orm postgres decimal.js zod next-auth@beta bcryptjs
pnpm add -D drizzle-kit vitest @types/bcryptjs tsx dotenv
```

- [ ] **Step 3: Buat basis data pengembangan dan pengujian**

```bash
createdb furnierp_dev
createdb furnierp_test
```

Bila `createdb` gagal karena peran tidak ada, gunakan:
```bash
sudo -u postgres createuser -s "$USER" && createdb furnierp_dev && createdb furnierp_test
```

- [ ] **Step 4: Tulis berkas environment**

`.env.example` (di-commit):
```
DATABASE_URL=postgresql://localhost:5432/furnierp_dev
AUTH_SECRET=ganti-dengan-nilai-acak-panjang
SEED_ADMIN_EMAIL=admin@furni.local
SEED_ADMIN_PASSWORD=ganti-sebelum-produksi
```

Kedua berkas environment memakai nama variabel yang sama, `DATABASE_URL`, dan hanya berbeda basis data tujuannya. Vitest memuat `.env.test` dengan `override: true` sehingga selalu menunjuk basis data pengujian, tidak pernah pengembangan.

`.env.local` dan `.env.test` (tidak di-commit) diisi nilai nyata. Hasilkan `AUTH_SECRET` dengan:
```bash
pnpm dlx auth secret
```

Tambahkan ke `.gitignore` bila belum ada: `.env.local`, `.env.test`.

- [ ] **Step 5: Tulis konfigurasi Drizzle**

`drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit'
import 'dotenv/config'

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
})
```

- [ ] **Step 6: Tulis klien basis data**

`src/db/klien.ts`:
```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL belum diatur')

export const koneksi = postgres(url, { max: 10 })
export const db = drizzle(koneksi, { schema })
export type Basis = typeof db
```

`src/db/schema/index.ts` (sementara kosong, diisi tugas berikutnya):
```ts
export {}
```

- [ ] **Step 7: Tulis infrastruktur pengujian**

`tests/setup-global.ts`:
```ts
import { existsSync } from 'node:fs'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

config({ path: '.env.test', override: true })

export default async function setup() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL belum diatur di .env.test')

  // Sampai skema pertama dibuat pada Task 4, folder migrasi belum ada.
  if (!existsSync('./drizzle')) return

  const koneksi = postgres(url, { max: 1 })
  await migrate(drizzle(koneksi), { migrationsFolder: './drizzle' })
  await koneksi.end()
}
```

Catatan penting: `.env.test` harus menetapkan `DATABASE_URL` (bukan `DATABASE_URL_TEST`) agar `src/db/klien.ts` menunjuk basis data pengujian saat Vitest berjalan. Isi `.env.test`:
```
DATABASE_URL=postgresql://localhost:5432/furnierp_test
AUTH_SECRET=rahasia-pengujian
```

`tests/bantuan/db.ts`:
```ts
import { koneksi } from '@/db/klien'

export async function bersihkanTabel(namaTabel: string[]) {
  if (namaTabel.length === 0) return
  const daftar = namaTabel.map((n) => `"${n}"`).join(', ')
  await koneksi.unsafe(`TRUNCATE TABLE ${daftar} RESTART IDENTITY CASCADE`)
}

export async function tutupKoneksi() {
  await koneksi.end()
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globalSetup: ['./tests/setup-global.ts'],
    setupFiles: ['./tests/setup-env.ts'],
    environment: 'node',
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
```

`tests/setup-env.ts`:
```ts
import { config } from 'dotenv'
config({ path: '.env.test', override: true })
```

`singleFork: true` dipakai karena pengujian berbagi satu basis data; menjalankannya paralel akan saling menghapus data.

- [ ] **Step 8: Tulis pengujian koneksi yang gagal**

`tests/db/koneksi.test.ts`:
```ts
import { describe, it, expect, afterAll } from 'vitest'
import { koneksi } from '@/db/klien'
import { tutupKoneksi } from '../bantuan/db'

afterAll(async () => {
  await tutupKoneksi()
})

describe('koneksi basis data', () => {
  it('terhubung ke PostgreSQL dan menjalankan kueri', async () => {
    const hasil = await koneksi`SELECT 1 AS satu`
    expect(hasil[0].satu).toBe(1)
  })

  it('menunjuk basis data pengujian, bukan pengembangan', async () => {
    const hasil = await koneksi`SELECT current_database() AS nama`
    expect(hasil[0].nama).toBe('furnierp_test')
  })
})
```

Pengujian kedua adalah pengaman: bila suatu saat konfigurasi environment salah, pengujian akan gagal alih-alih diam-diam menghapus data pengembangan.

- [ ] **Step 9: Tambahkan skrip ke package.json**

Tambahkan ke bagian `"scripts"`:
```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx src/db/migrasi.ts",
  "db:studio": "drizzle-kit studio",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

`src/db/migrasi.ts`:
```ts
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

async function jalankan() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL belum diatur')
  const koneksi = postgres(url, { max: 1 })
  await migrate(drizzle(koneksi), { migrationsFolder: './drizzle' })
  await koneksi.end()
  console.log('Migrasi selesai.')
}

jalankan().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 10: Jalankan pengujian**

Folder `drizzle/` sengaja belum dibuat; `setup-global.ts` melewati migrasi selama folder itu belum ada, dan mulai menjalankannya sejak skema pertama dibuat pada Task 4. Jangan membuat berkas jurnal migrasi secara manual — drizzle-kit yang mengelolanya.

Run: `pnpm test`
Expected: KEDUA pengujian LULUS.

- [ ] **Step 11: Pasang shadcn/ui**

```bash
pnpm dlx shadcn@latest init -y -b neutral
pnpm dlx shadcn@latest add button input label table card badge separator \
  dialog dropdown-menu select checkbox switch tabs sonner command sheet \
  form textarea popover calendar
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffolding Next.js, Drizzle, PostgreSQL, dan infrastruktur pengujian

Menyiapkan proyek Next.js App Router dengan TypeScript dan Tailwind,
koneksi Drizzle ke PostgreSQL lokal, shadcn/ui, serta Vitest yang
berjalan terhadap basis data pengujian terpisah dengan migrasi otomatis."
```

---

## Task 2: Aritmatika Uang (`src/lib/uang.ts`)

Modul ini adalah satu-satunya tempat aritmatika uang boleh terjadi. Seluruh sistem bergantung padanya, sehingga dibangun lebih dulu dan diuji secara menyeluruh.

**Files:**
- Create: `src/lib/uang.ts`
- Test: `tests/lib/uang.test.ts`

**Interfaces:**
- Consumes: —
- Produces (dari `@/lib/uang`):
  - `type Uang = string`
  - `tambah(...nilai: Uang[]): Uang`
  - `kurang(a: Uang, b: Uang): Uang`
  - `kali(a: Uang, pengali: Uang | number): Uang`
  - `bagi(a: Uang, pembagi: Uang | number): Uang`
  - `negasi(a: Uang): Uang`
  - `bulatkan(nilai: Uang, desimal: number): Uang`
  - `bandingkan(a: Uang, b: Uang): -1 | 0 | 1`
  - `samaDengan(a: Uang, b: Uang): boolean`
  - `nol(desimal?: number): Uang`
  - `adalahNol(nilai: Uang): boolean`
  - `formatRupiah(nilai: Uang, desimal?: number): string`
  - `formatAngka(nilai: Uang, desimal?: number): string`
  - `uraiInput(teks: string): Uang` — mengubah input bergaya Indonesia (`1.234.567,89`) menjadi `Uang`

- [ ] **Step 1: Tulis pengujian yang gagal**

`tests/lib/uang.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  tambah, kurang, kali, bagi, negasi, bulatkan, bandingkan,
  samaDengan, nol, adalahNol, formatRupiah, formatAngka, uraiInput,
} from '@/lib/uang'

describe('uang — aritmatika bebas galat pembulatan biner', () => {
  it('menjumlahkan 0,1 dan 0,2 menjadi tepat 0,3', () => {
    expect(tambah('0.1', '0.2')).toBe('0.3')
  })

  it('menjumlahkan banyak nilai sekaligus', () => {
    expect(tambah('1000.05', '2000.10', '3000.85')).toBe('6001')
  })

  it('menjumlahkan daftar kosong menjadi nol', () => {
    expect(tambah()).toBe('0')
  })

  it('mengurangkan dengan presisi penuh', () => {
    expect(kurang('1000000000000.03', '0.01')).toBe('1000000000000.02')
  })

  it('mengalikan tanpa kehilangan presisi', () => {
    expect(kali('1234567.89', '0.11')).toBe('135802.4679')
  })

  it('menerima pengali berupa angka', () => {
    expect(kali('100', 3)).toBe('300')
  })

  it('membagi dan mempertahankan presisi tinggi', () => {
    expect(bulatkan(bagi('100', 3), 6)).toBe('33.333333')
  })

  it('menolak pembagian dengan nol', () => {
    expect(() => bagi('100', 0)).toThrow('Pembagian dengan nol')
  })

  it('menegasikan nilai', () => {
    expect(negasi('1500.50')).toBe('-1500.5')
    expect(negasi('-1500.50')).toBe('1500.5')
  })
})

describe('uang — pembulatan setengah ke atas', () => {
  it('membulatkan 0,5 ke atas', () => {
    expect(bulatkan('1234.565', 2)).toBe('1234.57')
  })

  it('membulatkan nilai negatif setengah menjauhi nol', () => {
    expect(bulatkan('-1234.565', 2)).toBe('-1234.57')
  })

  it('membulatkan ke nol desimal', () => {
    expect(bulatkan('1234.5', 0)).toBe('1235')
  })

  it('menambahkan desimal bila nilai lebih pendek', () => {
    expect(bulatkan('10', 2)).toBe('10.00')
  })
})

describe('uang — perbandingan', () => {
  it('membandingkan nilai yang secara tekstual berbeda tapi sama nilainya', () => {
    expect(samaDengan('10.00', '10')).toBe(true)
    expect(bandingkan('10.00', '10')).toBe(0)
  })

  it('mengurutkan dengan benar', () => {
    expect(bandingkan('9.99', '10')).toBe(-1)
    expect(bandingkan('10.01', '10')).toBe(1)
  })

  it('mengenali nol dalam berbagai bentuk', () => {
    expect(adalahNol('0')).toBe(true)
    expect(adalahNol('0.00')).toBe(true)
    expect(adalahNol('-0.00')).toBe(true)
    expect(adalahNol('0.01')).toBe(false)
  })

  it('menghasilkan nol dengan jumlah desimal tertentu', () => {
    expect(nol()).toBe('0')
    expect(nol(2)).toBe('0.00')
  })
})

describe('uang — format Indonesia', () => {
  it('memformat rupiah dengan pemisah ribuan titik dan desimal koma', () => {
    expect(formatRupiah('1234567.89')).toBe('Rp 1.234.567,89')
  })

  it('memformat nilai negatif dengan tanda di depan simbol', () => {
    expect(formatRupiah('-1234567.89')).toBe('-Rp 1.234.567,89')
  })

  it('memformat nilai kecil', () => {
    expect(formatRupiah('0')).toBe('Rp 0,00')
    expect(formatRupiah('999')).toBe('Rp 999,00')
    expect(formatRupiah('1000')).toBe('Rp 1.000,00')
  })

  it('memformat nilai sangat besar tanpa notasi ilmiah', () => {
    expect(formatRupiah('999999999999999.99')).toBe('Rp 999.999.999.999.999,99')
  })

  it('memformat angka tanpa simbol mata uang', () => {
    expect(formatAngka('1234567.891', 3)).toBe('1.234.567,891')
  })
})

describe('uang — penguraian input pengguna', () => {
  it('mengurai format Indonesia lengkap', () => {
    expect(uraiInput('1.234.567,89')).toBe('1234567.89')
  })

  it('mengurai angka polos', () => {
    expect(uraiInput('1000')).toBe('1000')
  })

  it('mengurai nilai negatif dan mengabaikan spasi', () => {
    expect(uraiInput(' -1.500,25 ')).toBe('-1500.25')
  })

  it('mengabaikan simbol Rp', () => {
    expect(uraiInput('Rp 2.500,00')).toBe('2500')
  })

  it('mengembalikan nol untuk teks kosong', () => {
    expect(uraiInput('')).toBe('0')
  })

  it('menolak teks yang bukan angka', () => {
    expect(() => uraiInput('abc')).toThrow('Nilai tidak valid')
  })
})
```

- [ ] **Step 2: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/lib/uang.test.ts`
Expected: GAGAL dengan `Failed to resolve import "@/lib/uang"`

- [ ] **Step 3: Tulis implementasi**

`src/lib/uang.ts`:
```ts
import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 40 })

/** Nilai uang selalu dibawa sebagai string desimal, tidak pernah sebagai number. */
export type Uang = string

function d(nilai: Uang | number): Decimal {
  return new Decimal(nilai)
}

export function tambah(...nilai: Uang[]): Uang {
  return nilai.reduce((total, n) => total.plus(d(n)), new Decimal(0)).toString()
}

export function kurang(a: Uang, b: Uang): Uang {
  return d(a).minus(d(b)).toString()
}

export function kali(a: Uang, pengali: Uang | number): Uang {
  return d(a).times(d(pengali)).toString()
}

export function bagi(a: Uang, pembagi: Uang | number): Uang {
  const p = d(pembagi)
  if (p.isZero()) throw new Error('Pembagian dengan nol tidak diizinkan')
  return d(a).dividedBy(p).toString()
}

export function negasi(a: Uang): Uang {
  return d(a).negated().toString()
}

export function bulatkan(nilai: Uang, desimal: number): Uang {
  return d(nilai).toFixed(desimal, Decimal.ROUND_HALF_UP)
}

export function bandingkan(a: Uang, b: Uang): -1 | 0 | 1 {
  return d(a).comparedTo(d(b)) as -1 | 0 | 1
}

export function samaDengan(a: Uang, b: Uang): boolean {
  return d(a).equals(d(b))
}

export function nol(desimal = 0): Uang {
  return new Decimal(0).toFixed(desimal)
}

export function adalahNol(nilai: Uang): boolean {
  return d(nilai).isZero()
}

export function formatAngka(nilai: Uang, desimal = 2): string {
  const tetap = d(nilai).toFixed(desimal, Decimal.ROUND_HALF_UP)
  const negatif = tetap.startsWith('-')
  const [bulat, pecahan] = tetap.replace('-', '').split('.')
  const bulatBerpemisah = bulat.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const hasil = pecahan ? `${bulatBerpemisah},${pecahan}` : bulatBerpemisah
  return negatif ? `-${hasil}` : hasil
}

export function formatRupiah(nilai: Uang, desimal = 2): string {
  const angka = formatAngka(nilai, desimal)
  return angka.startsWith('-') ? `-Rp ${angka.slice(1)}` : `Rp ${angka}`
}

export function uraiInput(teks: string): Uang {
  const bersih = teks
    .replace(/Rp/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
  if (bersih === '' || bersih === '-') return '0'
  if (!/^-?\d+(\.\d+)?$/.test(bersih)) {
    throw new Error(`Nilai tidak valid: ${teks}`)
  }
  return new Decimal(bersih).toString()
}
```

Pemformatan Rupiah dilakukan manual, bukan lewat `Intl.NumberFormat`, karena `Intl` memerlukan konversi ke `number` yang akan kehilangan presisi pada nilai besar — persis kasus yang diuji pada pengujian "nilai sangat besar".

- [ ] **Step 4: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/lib/uang.test.ts`
Expected: SELURUH pengujian LULUS

- [ ] **Step 5: Commit**

```bash
git add src/lib/uang.ts tests/lib/uang.test.ts
git commit -m "feat(lib): aritmatika uang berbasis desimal dengan format Indonesia

Menyediakan satu-satunya jalur aritmatika uang di sistem. Nilai dibawa
sebagai string desimal dan dihitung lewat decimal.js dengan pembulatan
setengah ke atas, sehingga bebas dari galat pembulatan biner. Pemformatan
Rupiah dilakukan manual agar presisi tetap terjaga pada nilai besar."
```

---

## Task 3: Evaluasi Izin dan Definisi Navigasi

**Files:**
- Create: `src/lib/izin.ts`
- Create: `src/lib/navigasi.ts`
- Test: `tests/lib/izin.test.ts`, `tests/lib/navigasi.test.ts`

**Interfaces:**
- Consumes: —
- Produces (dari `@/lib/izin`):
  - `const WILDCARD = '*'`
  - `punyaIzin(dimiliki: string[], diperlukan: string): boolean`
  - `punyaSalahSatuIzin(dimiliki: string[], diperlukan: string[]): boolean`
- Produces (dari `@/lib/navigasi`):
  - `type ItemMenu = { label: string; rute?: string; ikon?: string; izin?: string; fase: number; anak?: ItemMenu[] }`
  - `const NAVIGASI: ItemMenu[]`
  - `const FASE_AKTIF: number` — fase tertinggi yang sudah dibangun
  - `daftarKodeIzin(): string[]` — seluruh kode izin dari seluruh fase, untuk seed
  - `navigasiTerlihat(izinDimiliki: string[], faseAktif?: number): ItemMenu[]`

- [ ] **Step 1: Tulis pengujian izin yang gagal**

`tests/lib/izin.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { punyaIzin, punyaSalahSatuIzin } from '@/lib/izin'

describe('izin — pencocokan tepat', () => {
  it('mengizinkan bila kode persis sama', () => {
    expect(punyaIzin(['akuntansi.jurnal.lihat'], 'akuntansi.jurnal.lihat')).toBe(true)
  })

  it('menolak bila kode tidak ada', () => {
    expect(punyaIzin(['akuntansi.jurnal.lihat'], 'akuntansi.jurnal.posting')).toBe(false)
  })

  it('menolak bila daftar izin kosong', () => {
    expect(punyaIzin([], 'akuntansi.jurnal.lihat')).toBe(false)
  })
})

describe('izin — wildcard global', () => {
  it('mengizinkan apa pun bagi pemegang bintang', () => {
    expect(punyaIzin(['*'], 'akuntansi.jurnal.posting')).toBe(true)
    expect(punyaIzin(['*'], 'gudang.opname.kelola')).toBe(true)
  })
})

describe('izin — wildcard bersegmen', () => {
  it('mengizinkan seluruh kode di bawah prefiks', () => {
    expect(punyaIzin(['akuntansi.*'], 'akuntansi.jurnal.posting')).toBe(true)
    expect(punyaIzin(['akuntansi.jurnal.*'], 'akuntansi.jurnal.posting')).toBe(true)
  })

  it('tidak bocor ke modul lain yang berawalan mirip', () => {
    expect(punyaIzin(['akuntansi.*'], 'akuntansiX.jurnal.lihat')).toBe(false)
    expect(punyaIzin(['gudang.*'], 'akuntansi.jurnal.lihat')).toBe(false)
  })

  it('tidak mengizinkan prefiks itu sendiri tanpa segmen lanjutan', () => {
    expect(punyaIzin(['akuntansi.*'], 'akuntansi')).toBe(false)
  })
})

describe('izin — salah satu dari beberapa', () => {
  it('mengizinkan bila satu saja cocok', () => {
    expect(punyaSalahSatuIzin(['gudang.*'], ['akuntansi.coa.kelola', 'gudang.produk.lihat'])).toBe(true)
  })

  it('menolak bila tidak satu pun cocok', () => {
    expect(punyaSalahSatuIzin(['proyek.*'], ['akuntansi.coa.kelola', 'gudang.produk.lihat'])).toBe(false)
  })

  it('menolak bila daftar yang diperlukan kosong', () => {
    expect(punyaSalahSatuIzin(['*'], [])).toBe(false)
  })
})
```

- [ ] **Step 2: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/lib/izin.test.ts`
Expected: GAGAL dengan `Failed to resolve import "@/lib/izin"`

- [ ] **Step 3: Tulis implementasi izin**

`src/lib/izin.ts`:
```ts
export const WILDCARD = '*'

/**
 * Mengevaluasi apakah daftar izin yang dimiliki mencakup kode yang diperlukan.
 * Mendukung dua bentuk wildcard:
 *   '*'             — mencakup seluruh kode
 *   'akuntansi.*'   — mencakup seluruh kode di bawah segmen 'akuntansi'
 */
export function punyaIzin(dimiliki: string[], diperlukan: string): boolean {
  return dimiliki.some((izin) => {
    if (izin === WILDCARD) return true
    if (izin.endsWith('.*')) return diperlukan.startsWith(izin.slice(0, -1))
    return izin === diperlukan
  })
}

export function punyaSalahSatuIzin(dimiliki: string[], diperlukan: string[]): boolean {
  return diperlukan.some((kode) => punyaIzin(dimiliki, kode))
}
```

`izin.slice(0, -1)` pada `'akuntansi.*'` menghasilkan `'akuntansi.'` — titik ikut dipertahankan, sehingga `'akuntansiX.jurnal.lihat'` tidak cocok.

- [ ] **Step 4: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/lib/izin.test.ts`
Expected: SELURUH pengujian LULUS

- [ ] **Step 5: Tulis pengujian navigasi yang gagal**

`tests/lib/navigasi.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { NAVIGASI, daftarKodeIzin, navigasiTerlihat, type ItemMenu } from '@/lib/navigasi'

function ratakan(item: ItemMenu[]): ItemMenu[] {
  return item.flatMap((i) => [i, ...(i.anak ? ratakan(i.anak) : [])])
}

describe('navigasi — struktur', () => {
  it('memuat sembilan grup utama', () => {
    expect(NAVIGASI).toHaveLength(9)
  })

  it('menyusun grup sesuai alur bisnis', () => {
    expect(NAVIGASI.map((g) => g.label)).toEqual([
      'Dasbor', 'Kontak', 'Penjualan', 'Pembelian', 'Gudang',
      'Manufaktur', 'Akuntansi', 'Proyek', 'Pengaturan',
    ])
  })

  it('memberi setiap item berujung sebuah rute dan kode izin', () => {
    const berujung = ratakan(NAVIGASI).filter((i) => !i.anak)
    for (const item of berujung) {
      expect(item.rute, `rute hilang pada "${item.label}"`).toBeTruthy()
      expect(item.izin, `izin hilang pada "${item.label}"`).toBeTruthy()
    }
  })

  it('memberi setiap item sebuah nomor fase yang sah', () => {
    for (const item of ratakan(NAVIGASI)) {
      expect(item.fase).toBeGreaterThanOrEqual(1)
      expect(item.fase).toBeLessThanOrEqual(7)
    }
  })

  it('menggunakan rute yang unik', () => {
    const rute = ratakan(NAVIGASI).filter((i) => i.rute).map((i) => i.rute!)
    expect(new Set(rute).size).toBe(rute.length)
  })

  it('menggunakan kode izin bergaya modul.entitas.aksi', () => {
    for (const item of ratakan(NAVIGASI).filter((i) => i.izin)) {
      expect(item.izin, `format salah pada "${item.label}"`).toMatch(/^[a-z]+(\.[a-z-]+){1,3}$/)
    }
  })
})

describe('navigasi — daftar kode izin untuk seed', () => {
  it('mengumpulkan kode dari seluruh fase, bukan hanya yang aktif', () => {
    const kode = daftarKodeIzin()
    expect(kode).toContain('akuntansi.coa.kelola')
    expect(kode).toContain('gudang.opname.kelola')
    expect(kode).toContain('proyek.proyek.kelola')
  })

  it('tidak memuat duplikat', () => {
    const kode = daftarKodeIzin()
    expect(new Set(kode).size).toBe(kode.length)
  })
})

describe('navigasi — penyaringan tampilan', () => {
  it('menyembunyikan menu dari fase yang belum dibangun', () => {
    const terlihat = ratakan(navigasiTerlihat(['*'], 1))
    expect(terlihat.every((i) => i.fase <= 1)).toBe(true)
    expect(terlihat.some((i) => i.rute === '/akuntansi/konfigurasi/bagan-akun')).toBe(true)
  })

  it('menyembunyikan menu yang izinnya tidak dimiliki', () => {
    const terlihat = ratakan(navigasiTerlihat(['akuntansi.*'], 1))
    expect(terlihat.some((i) => i.rute === '/akuntansi/konfigurasi/bagan-akun')).toBe(true)
    expect(terlihat.some((i) => i.rute === '/pengaturan/pengguna')).toBe(false)
  })

  it('membuang grup yang seluruh anaknya tersembunyi', () => {
    const terlihat = navigasiTerlihat(['akuntansi.*'], 1)
    expect(terlihat.some((g) => g.label === 'Pengaturan')).toBe(false)
    expect(terlihat.some((g) => g.label === 'Akuntansi')).toBe(true)
  })

  it('mempertahankan seluruh menu bagi pemegang wildcard pada fase penuh', () => {
    const terlihat = ratakan(navigasiTerlihat(['*'], 7))
    expect(terlihat.length).toBe(ratakan(NAVIGASI).length)
  })
})
```

- [ ] **Step 6: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/lib/navigasi.test.ts`
Expected: GAGAL dengan `Failed to resolve import "@/lib/navigasi"`

- [ ] **Step 7: Tulis definisi navigasi**

`src/lib/navigasi.ts`:
```ts
import { punyaIzin } from './izin'

export type ItemMenu = {
  label: string
  rute?: string
  ikon?: string
  izin?: string
  fase: number
  anak?: ItemMenu[]
}

/** Fase tertinggi yang sudah dibangun. Naikkan saat fase berikutnya selesai. */
export const FASE_AKTIF = 1

export const NAVIGASI: ItemMenu[] = [
  {
    label: 'Dasbor', rute: '/dasbor', ikon: 'LayoutDashboard',
    izin: 'dasbor.ringkasan.lihat', fase: 1,
  },
  {
    label: 'Kontak', ikon: 'Users', fase: 1,
    anak: [
      { label: 'Semua Kontak', rute: '/kontak', izin: 'kontak.partner.lihat', fase: 1 },
      { label: 'Pelanggan', rute: '/kontak/pelanggan', izin: 'kontak.partner.lihat', fase: 1 },
      { label: 'Pemasok', rute: '/kontak/pemasok', izin: 'kontak.partner.lihat', fase: 1 },
    ],
  },
  {
    label: 'Penjualan', ikon: 'ShoppingCart', fase: 4,
    anak: [
      { label: 'Penawaran', rute: '/penjualan/penawaran', izin: 'penjualan.penawaran.lihat', fase: 4 },
      { label: 'Pesanan Penjualan', rute: '/penjualan/pesanan', izin: 'penjualan.pesanan.lihat', fase: 4 },
      { label: 'Laporan Penjualan', rute: '/penjualan/laporan', izin: 'penjualan.laporan.lihat', fase: 4 },
    ],
  },
  {
    label: 'Pembelian', ikon: 'ShoppingBag', fase: 3,
    anak: [
      { label: 'Permintaan Penawaran', rute: '/pembelian/permintaan', izin: 'pembelian.permintaan.lihat', fase: 3 },
      { label: 'Pesanan Pembelian', rute: '/pembelian/pesanan', izin: 'pembelian.pesanan.lihat', fase: 3 },
      { label: 'Laporan Pembelian', rute: '/pembelian/laporan', izin: 'pembelian.laporan.lihat', fase: 3 },
    ],
  },
  {
    label: 'Gudang', ikon: 'Warehouse', fase: 2,
    anak: [
      { label: 'Penerimaan Barang', rute: '/gudang/operasi/penerimaan', izin: 'gudang.penerimaan.kelola', fase: 2 },
      { label: 'Pengiriman', rute: '/gudang/operasi/pengiriman', izin: 'gudang.pengiriman.kelola', fase: 2 },
      { label: 'Packing List', rute: '/gudang/operasi/packing-list', izin: 'gudang.packing.kelola', fase: 2 },
      { label: 'Transfer Internal', rute: '/gudang/operasi/transfer', izin: 'gudang.transfer.kelola', fase: 2 },
      { label: 'Barang Rusak', rute: '/gudang/operasi/barang-rusak', izin: 'gudang.scrap.kelola', fase: 2 },
      { label: 'Stock Opname', rute: '/gudang/operasi/opname', izin: 'gudang.opname.kelola', fase: 2 },
      { label: 'Produk', rute: '/gudang/produk', izin: 'gudang.produk.lihat', fase: 2 },
      { label: 'Kategori Produk', rute: '/gudang/produk/kategori', izin: 'gudang.kategori.kelola', fase: 2 },
      { label: 'Satuan', rute: '/gudang/produk/satuan', izin: 'gudang.satuan.kelola', fase: 2 },
      { label: 'Kartu Stok', rute: '/gudang/laporan/kartu-stok', izin: 'gudang.laporan.kartu-stok', fase: 2 },
      { label: 'Stok Tersedia', rute: '/gudang/laporan/stok-tersedia', izin: 'gudang.laporan.stok', fase: 2 },
      { label: 'Valuasi Persediaan', rute: '/gudang/laporan/valuasi', izin: 'gudang.laporan.valuasi', fase: 2 },
      { label: 'Gudang & Lokasi', rute: '/gudang/konfigurasi/lokasi', izin: 'gudang.lokasi.kelola', fase: 2 },
    ],
  },
  {
    label: 'Manufaktur', ikon: 'Factory', fase: 5,
    anak: [
      { label: 'Perintah Produksi', rute: '/manufaktur/perintah-produksi', izin: 'manufaktur.mo.lihat', fase: 5 },
      { label: 'Bill of Materials', rute: '/manufaktur/bom', izin: 'manufaktur.bom.lihat', fase: 5 },
      { label: 'Analisis HPP Produksi', rute: '/manufaktur/laporan/hpp', izin: 'manufaktur.laporan.hpp', fase: 5 },
    ],
  },
  {
    label: 'Akuntansi', ikon: 'BookOpen', fase: 1,
    anak: [
      { label: 'Dasbor Akuntansi', rute: '/akuntansi', izin: 'akuntansi.dasbor.lihat', fase: 1 },
      { label: 'Faktur Penjualan', rute: '/akuntansi/pelanggan/faktur', izin: 'akuntansi.faktur.lihat', fase: 4 },
      { label: 'Nota Kredit', rute: '/akuntansi/pelanggan/nota-kredit', izin: 'akuntansi.nota-kredit.lihat', fase: 4 },
      { label: 'Pembayaran Masuk', rute: '/akuntansi/pelanggan/pembayaran', izin: 'akuntansi.pembayaran-masuk.lihat', fase: 4 },
      { label: 'Tagihan Pembelian', rute: '/akuntansi/pemasok/tagihan', izin: 'akuntansi.tagihan.lihat', fase: 3 },
      { label: 'Nota Debit', rute: '/akuntansi/pemasok/nota-debit', izin: 'akuntansi.nota-debit.lihat', fase: 3 },
      { label: 'Pembayaran Keluar', rute: '/akuntansi/pemasok/pembayaran', izin: 'akuntansi.pembayaran-keluar.lihat', fase: 3 },
      { label: 'Entri Jurnal', rute: '/akuntansi/jurnal/entri', izin: 'akuntansi.jurnal.lihat', fase: 1 },
      { label: 'Item Jurnal', rute: '/akuntansi/jurnal/item', izin: 'akuntansi.jurnal.lihat', fase: 1 },
      { label: 'Rekonsiliasi', rute: '/akuntansi/jurnal/rekonsiliasi', izin: 'akuntansi.rekonsiliasi.kelola', fase: 3 },
      { label: 'Daftar Aset', rute: '/akuntansi/aset', izin: 'akuntansi.aset.lihat', fase: 6 },
      { label: 'Jadwal Depresiasi', rute: '/akuntansi/aset/depresiasi', izin: 'akuntansi.depresiasi.lihat', fase: 6 },
      { label: 'Laba Rugi', rute: '/akuntansi/laporan/laba-rugi', izin: 'akuntansi.laporan.laba-rugi', fase: 1 },
      { label: 'Neraca', rute: '/akuntansi/laporan/neraca', izin: 'akuntansi.laporan.neraca', fase: 1 },
      { label: 'Arus Kas', rute: '/akuntansi/laporan/arus-kas', izin: 'akuntansi.laporan.arus-kas', fase: 1 },
      { label: 'Buku Besar', rute: '/akuntansi/laporan/buku-besar', izin: 'akuntansi.laporan.buku-besar', fase: 1 },
      { label: 'Neraca Saldo', rute: '/akuntansi/laporan/neraca-saldo', izin: 'akuntansi.laporan.neraca-saldo', fase: 1 },
      { label: 'Buku Besar Pembantu', rute: '/akuntansi/laporan/buku-pembantu', izin: 'akuntansi.laporan.buku-pembantu', fase: 1 },
      { label: 'Umur Piutang & Utang', rute: '/akuntansi/laporan/umur', izin: 'akuntansi.laporan.umur', fase: 1 },
      { label: 'Laporan Pajak', rute: '/akuntansi/laporan/pajak', izin: 'akuntansi.laporan.pajak', fase: 1 },
      { label: 'Bagan Akun', rute: '/akuntansi/konfigurasi/bagan-akun', izin: 'akuntansi.coa.kelola', fase: 1 },
      { label: 'Jurnal', rute: '/akuntansi/konfigurasi/jurnal', izin: 'akuntansi.jurnal-master.kelola', fase: 1 },
      { label: 'Pajak', rute: '/akuntansi/konfigurasi/pajak', izin: 'akuntansi.pajak.kelola', fase: 1 },
      { label: 'Mata Uang & Kurs', rute: '/akuntansi/konfigurasi/mata-uang', izin: 'akuntansi.mata-uang.kelola', fase: 1 },
      { label: 'Syarat Pembayaran', rute: '/akuntansi/konfigurasi/syarat-pembayaran', izin: 'akuntansi.syarat-bayar.kelola', fase: 1 },
      { label: 'Tahun Buku & Penguncian', rute: '/akuntansi/konfigurasi/tahun-buku', izin: 'akuntansi.tahun-buku.kelola', fase: 1 },
    ],
  },
  {
    label: 'Proyek', ikon: 'FolderKanban', fase: 7,
    anak: [
      { label: 'Proyek', rute: '/proyek', izin: 'proyek.proyek.kelola', fase: 7 },
      { label: 'Tugas', rute: '/proyek/tugas', izin: 'proyek.tugas.kelola', fase: 7 },
      { label: 'Timesheet', rute: '/proyek/timesheet', izin: 'proyek.timesheet.kelola', fase: 7 },
      { label: 'Profitabilitas Proyek', rute: '/proyek/laporan/profitabilitas', izin: 'proyek.laporan.profitabilitas', fase: 7 },
    ],
  },
  {
    label: 'Pengaturan', ikon: 'Settings', fase: 1,
    anak: [
      { label: 'Profil Perusahaan', rute: '/pengaturan/perusahaan', izin: 'pengaturan.perusahaan.kelola', fase: 1 },
      { label: 'Pengguna', rute: '/pengaturan/pengguna', izin: 'pengaturan.pengguna.kelola', fase: 1 },
      { label: 'Peran & Hak Akses', rute: '/pengaturan/peran', izin: 'pengaturan.peran.kelola', fase: 1 },
      { label: 'Penomoran Dokumen', rute: '/pengaturan/penomoran', izin: 'pengaturan.penomoran.kelola', fase: 1 },
      { label: 'Log Aktivitas', rute: '/pengaturan/log-aktivitas', izin: 'pengaturan.log.lihat', fase: 1 },
    ],
  },
]

function ratakan(item: ItemMenu[]): ItemMenu[] {
  return item.flatMap((i) => [i, ...(i.anak ? ratakan(i.anak) : [])])
}

/**
 * Seluruh kode izin dari SELURUH fase, termasuk yang belum dibangun.
 * Izin sengaja di-seed lebih dulu agar pemetaan peran dapat disiapkan
 * tanpa menunggu fiturnya selesai.
 */
export function daftarKodeIzin(): string[] {
  const kode = ratakan(NAVIGASI).map((i) => i.izin).filter((k): k is string => Boolean(k))
  return [...new Set(kode)]
}

export function navigasiTerlihat(izinDimiliki: string[], faseAktif: number = FASE_AKTIF): ItemMenu[] {
  function saring(daftar: ItemMenu[]): ItemMenu[] {
    return daftar.reduce<ItemMenu[]>((hasil, item) => {
      if (item.fase > faseAktif) return hasil
      if (item.anak) {
        const anak = saring(item.anak)
        if (anak.length > 0) hasil.push({ ...item, anak })
        return hasil
      }
      if (item.izin && punyaIzin(izinDimiliki, item.izin)) hasil.push(item)
      return hasil
    }, [])
  }
  return saring(NAVIGASI)
}
```

Perhatikan bahwa beberapa item di dalam grup Akuntansi memiliki `fase` lebih tinggi daripada grupnya. Ini disengaja: grup Akuntansi aktif sejak Fase 1, tetapi Faktur dan Tagihan baru muncul pada Fase 3 dan 4.

- [ ] **Step 8: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/lib/navigasi.test.ts`
Expected: SELURUH pengujian LULUS

- [ ] **Step 9: Jalankan seluruh pengujian**

Run: `pnpm test`
Expected: SELURUH berkas pengujian LULUS

- [ ] **Step 10: Commit**

```bash
git add src/lib/izin.ts src/lib/navigasi.ts tests/lib/izin.test.ts tests/lib/navigasi.test.ts
git commit -m "feat(lib): evaluasi izin dan definisi navigasi tunggal

Menetapkan sumber tunggal struktur menu sembilan grup beserta kode izin
untuk seluruh tujuh fase. Kode izin di-seed lebih awal agar pemetaan peran
dapat disiapkan tanpa menunggu fiturnya selesai. Evaluasi izin mendukung
wildcard global dan wildcard bersegmen per modul."
```

---

## Task 4: Skema Identitas & Akses

**Files:**
- Create: `src/db/schema/enum.ts`, `src/db/schema/identitas.ts`
- Modify: `src/db/schema/index.ts`
- Create: `src/modules/identitas/repositori/pengguna.ts`
- Create: `src/modules/identitas/layanan/kata-sandi.ts`
- Test: `tests/identitas/skema.test.ts`, `tests/identitas/kata-sandi.test.ts`

**Interfaces:**
- Consumes: `db` dari `@/db/klien`; `bersihkanTabel`, `tutupKoneksi` dari `tests/bantuan/db`
- Produces:
  - Tabel `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs` dari `@/db/schema/identitas`
  - `hashKataSandi(kataSandi: string): Promise<string>` dari `@/modules/identitas/layanan/kata-sandi`
  - `cocokKataSandi(kataSandi: string, hash: string): Promise<boolean>` dari modul yang sama
  - `cariPenggunaLewatEmail(email: string): Promise<PenggunaDenganIzin | null>` dari `@/modules/identitas/repositori/pengguna`
  - `type PenggunaDenganIzin = { id: string; email: string; nama: string; passwordHash: string; isActive: boolean; izin: string[] }`

- [ ] **Step 1: Tulis enum bersama**

`src/db/schema/enum.ts`:
```ts
import { pgEnum } from 'drizzle-orm/pg-core'

export const tipePartnerEnum = pgEnum('tipe_partner', ['perorangan', 'badan'])

export const tipeAkunEnum = pgEnum('tipe_akun', [
  'aset_kas', 'aset_bank', 'aset_piutang', 'aset_persediaan', 'aset_lancar_lain',
  'aset_tetap', 'aset_akumulasi_depresiasi', 'aset_tidak_lancar_lain',
  'liabilitas_utang_usaha', 'liabilitas_pajak',
  'liabilitas_jangka_pendek', 'liabilitas_jangka_panjang',
  'ekuitas', 'ekuitas_laba_ditahan', 'ekuitas_laba_berjalan',
  'pendapatan', 'pendapatan_lain',
  'beban_hpp', 'beban_operasional', 'beban_depresiasi', 'beban_lain', 'beban_pajak',
])

export const tipeJurnalEnum = pgEnum('tipe_jurnal', [
  'penjualan', 'pembelian', 'kas', 'bank', 'umum',
])

export const ruangLingkupPajakEnum = pgEnum('ruang_lingkup_pajak', ['penjualan', 'pembelian'])

export const statusTahunBukuEnum = pgEnum('status_tahun_buku', ['terbuka', 'ditutup'])

export const resetUrutanEnum = pgEnum('reset_urutan', ['tidak_pernah', 'tahunan', 'bulanan'])

export const aksiAuditEnum = pgEnum('aksi_audit', ['buat', 'ubah', 'hapus', 'posting', 'balik', 'masuk'])
```

Enum `status_entri_jurnal` sengaja belum dibuat di sini; ia menjadi bagian Fase 1B bersama tabel jurnalnya.

- [ ] **Step 2: Tulis skema identitas**

`src/db/schema/identitas.ts`:
```ts
import {
  pgTable, uuid, text, boolean, timestamp, jsonb, index, uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { aksiAuditEnum } from './enum'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  nama: text('nama').notNull(),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('users_email_unik').on(t.email)])

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('roles_kode_unik').on(t.kode)])

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  modul: text('modul').notNull(),
  deskripsi: text('deskripsi'),
}, (t) => [
  uniqueIndex('permissions_kode_unik').on(t.kode),
  index('permissions_modul_idx').on(t.modul),
])

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })])

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.userId, t.roleId] })])

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  entitas: text('entitas').notNull(),
  entitasId: text('entitas_id'),
  aksi: aksiAuditEnum('aksi').notNull(),
  dataLama: jsonb('data_lama'),
  dataBaru: jsonb('data_baru'),
  alamatIp: text('alamat_ip'),
  waktu: timestamp('waktu', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('audit_logs_entitas_idx').on(t.entitas, t.entitasId),
  index('audit_logs_waktu_idx').on(t.waktu),
])

export const usersRelations = relations(users, ({ many }) => ({
  peran: many(userRoles),
}))

export const rolesRelations = relations(roles, ({ many }) => ({
  pengguna: many(userRoles),
  izin: many(rolePermissions),
}))

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  pengguna: one(users, { fields: [userRoles.userId], references: [users.id] }),
  peran: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}))

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  peran: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  izin: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}))
```

- [ ] **Step 3: Ekspor skema**

`src/db/schema/index.ts`:
```ts
export * from './enum'
export * from './identitas'
```

- [ ] **Step 4: Hasilkan dan jalankan migrasi**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: satu berkas SQL baru muncul di `drizzle/`, dan migrasi selesai tanpa galat.

- [ ] **Step 5: Tulis pengujian kata sandi yang gagal**

`tests/identitas/kata-sandi.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { hashKataSandi, cocokKataSandi } from '@/modules/identitas/layanan/kata-sandi'

describe('kata sandi', () => {
  it('menghasilkan hash yang berbeda dari teks aslinya', async () => {
    const hash = await hashKataSandi('rahasia123')
    expect(hash).not.toBe('rahasia123')
    expect(hash.length).toBeGreaterThan(20)
  })

  it('menghasilkan hash berbeda untuk kata sandi yang sama', async () => {
    const a = await hashKataSandi('rahasia123')
    const b = await hashKataSandi('rahasia123')
    expect(a).not.toBe(b)
  })

  it('mencocokkan kata sandi yang benar', async () => {
    const hash = await hashKataSandi('rahasia123')
    expect(await cocokKataSandi('rahasia123', hash)).toBe(true)
  })

  it('menolak kata sandi yang salah', async () => {
    const hash = await hashKataSandi('rahasia123')
    expect(await cocokKataSandi('rahasia124', hash)).toBe(false)
  })

  it('menolak kata sandi lebih pendek dari delapan karakter', async () => {
    await expect(hashKataSandi('pendek')).rejects.toThrow('minimal 8 karakter')
  })
})
```

- [ ] **Step 6: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/identitas/kata-sandi.test.ts`
Expected: GAGAL dengan galat resolusi impor

- [ ] **Step 7: Tulis layanan kata sandi**

`src/modules/identitas/layanan/kata-sandi.ts`:
```ts
import bcrypt from 'bcryptjs'

const PUTARAN = 12
export const PANJANG_MINIMAL = 8

export async function hashKataSandi(kataSandi: string): Promise<string> {
  if (kataSandi.length < PANJANG_MINIMAL) {
    throw new Error(`Kata sandi minimal ${PANJANG_MINIMAL} karakter`)
  }
  return bcrypt.hash(kataSandi, PUTARAN)
}

export async function cocokKataSandi(kataSandi: string, hash: string): Promise<boolean> {
  return bcrypt.compare(kataSandi, hash)
}
```

- [ ] **Step 8: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/identitas/kata-sandi.test.ts`
Expected: SELURUH pengujian LULUS

- [ ] **Step 9: Tulis pengujian repositori pengguna yang gagal**

`tests/identitas/skema.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { users, roles, permissions, rolePermissions, userRoles } from '@/db/schema'
import { hashKataSandi } from '@/modules/identitas/layanan/kata-sandi'
import { cariPenggunaLewatEmail } from '@/modules/identitas/repositori/pengguna'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const TABEL = ['user_roles', 'role_permissions', 'permissions', 'roles', 'users', 'audit_logs']

async function buatPenggunaBerizin(email: string, kodeIzin: string[]) {
  const [pengguna] = await db.insert(users).values({
    email, nama: 'Uji Coba', passwordHash: await hashKataSandi('rahasia123'),
  }).returning()
  const [peran] = await db.insert(roles).values({ kode: 'uji', nama: 'Uji' }).returning()
  await db.insert(userRoles).values({ userId: pengguna.id, roleId: peran.id })
  for (const kode of kodeIzin) {
    const [izin] = await db.insert(permissions).values({ kode, modul: kode.split('.')[0] }).returning()
    await db.insert(rolePermissions).values({ roleId: peran.id, permissionId: izin.id })
  }
  return pengguna
}

beforeEach(async () => { await bersihkanTabel(TABEL) })
afterAll(async () => { await tutupKoneksi() })

describe('skema identitas', () => {
  it('menolak email ganda', async () => {
    await db.insert(users).values({ email: 'a@b.c', nama: 'A', passwordHash: 'x' })
    await expect(
      db.insert(users).values({ email: 'a@b.c', nama: 'B', passwordHash: 'y' }),
    ).rejects.toThrow()
  })

  it('menolak kode peran ganda', async () => {
    await db.insert(roles).values({ kode: 'superuser', nama: 'Superuser' })
    await expect(
      db.insert(roles).values({ kode: 'superuser', nama: 'Lain' }),
    ).rejects.toThrow()
  })

  it('menghapus penugasan peran saat pengguna dihapus', async () => {
    const pengguna = await buatPenggunaBerizin('hapus@uji.id', ['akuntansi.coa.kelola'])
    await db.delete(users).where(eq(users.id, pengguna.id))
    const sisa = await db.select().from(userRoles)
    expect(sisa).toHaveLength(0)
  })
})

describe('cariPenggunaLewatEmail', () => {
  it('mengembalikan null bila email tidak terdaftar', async () => {
    expect(await cariPenggunaLewatEmail('tidak-ada@uji.id')).toBeNull()
  })

  it('mengumpulkan izin dari peran yang dimiliki', async () => {
    await buatPenggunaBerizin('akuntan@uji.id', ['akuntansi.coa.kelola', 'akuntansi.jurnal.lihat'])
    const hasil = await cariPenggunaLewatEmail('akuntan@uji.id')
    expect(hasil).not.toBeNull()
    expect(hasil!.izin.sort()).toEqual(['akuntansi.coa.kelola', 'akuntansi.jurnal.lihat'])
  })

  it('mengembalikan daftar izin kosong bila peran tidak punya izin', async () => {
    await buatPenggunaBerizin('kosong@uji.id', [])
    const hasil = await cariPenggunaLewatEmail('kosong@uji.id')
    expect(hasil!.izin).toEqual([])
  })

  it('mencari tanpa membedakan huruf besar-kecil', async () => {
    await buatPenggunaBerizin('Kapital@Uji.ID', [])
    expect(await cariPenggunaLewatEmail('kapital@uji.id')).not.toBeNull()
  })

  it('tetap mengembalikan pengguna nonaktif agar lapisan atas yang memutuskan', async () => {
    const pengguna = await buatPenggunaBerizin('nonaktif@uji.id', [])
    await db.update(users).set({ isActive: false }).where(eq(users.id, pengguna.id))
    const hasil = await cariPenggunaLewatEmail('nonaktif@uji.id')
    expect(hasil!.isActive).toBe(false)
  })
})
```

- [ ] **Step 10: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/identitas/skema.test.ts`
Expected: GAGAL pada impor `cariPenggunaLewatEmail`

- [ ] **Step 11: Tulis repositori pengguna**

`src/modules/identitas/repositori/pengguna.ts`:
```ts
import { sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import { users, userRoles, rolePermissions, permissions } from '@/db/schema'

export type PenggunaDenganIzin = {
  id: string
  email: string
  nama: string
  passwordHash: string
  isActive: boolean
  izin: string[]
}

export async function cariPenggunaLewatEmail(email: string): Promise<PenggunaDenganIzin | null> {
  const baris = await db
    .select({
      id: users.id,
      email: users.email,
      nama: users.nama,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
      kodeIzin: permissions.kode,
    })
    .from(users)
    .leftJoin(userRoles, sql`${userRoles.userId} = ${users.id}`)
    .leftJoin(rolePermissions, sql`${rolePermissions.roleId} = ${userRoles.roleId}`)
    .leftJoin(permissions, sql`${permissions.id} = ${rolePermissions.permissionId}`)
    .where(sql`lower(${users.email}) = lower(${email})`)

  if (baris.length === 0) return null

  const { id, nama, passwordHash, isActive, email: emailTersimpan } = baris[0]
  const izin = [...new Set(baris.map((b) => b.kodeIzin).filter((k): k is string => Boolean(k)))]
  return { id, email: emailTersimpan, nama, passwordHash, isActive, izin }
}
```

Repositori sengaja mengembalikan pengguna nonaktif alih-alih menyaringnya. Keputusan menolak login adalah aturan bisnis dan menjadi tanggung jawab lapisan layanan, bukan lapisan akses data.

- [ ] **Step 12: Jalankan seluruh pengujian**

Run: `pnpm test`
Expected: SELURUH pengujian LULUS

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(identitas): skema pengguna, peran, izin, dan log aktivitas

Menambahkan enam tabel identitas beserta migrasi terversi, hashing kata
sandi berbasis bcrypt, dan repositori pencarian pengguna yang mengumpulkan
kode izin dari seluruh peran yang dimiliki. Pencarian email tidak
membedakan huruf besar-kecil."
```

---

## Task 5: Autentikasi dan Penjagaan Rute

**Files:**
- Create: `src/auth.config.ts`, `src/auth.ts`, `src/middleware.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/lib/sesi.ts`
- Create: `src/modules/identitas/layanan/autentikasi.ts`
- Create: `src/app/(auth)/masuk/page.tsx`, `src/app/(auth)/masuk/formulir.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/types/next-auth.d.ts`
- Test: `tests/identitas/autentikasi.test.ts`

**Interfaces:**
- Consumes: `cariPenggunaLewatEmail`, `PenggunaDenganIzin`, `cocokKataSandi` dari Task 4
- Produces:
  - `verifikasiKredensial(email: string, kataSandi: string): Promise<PenggunaDenganIzin>` dari `@/modules/identitas/layanan/autentikasi` — melempar `GagalMasukError` bila gagal
  - `class GagalMasukError extends Error` dari modul yang sama
  - `auth`, `signIn`, `signOut`, `handlers` dari `@/auth`
  - `ambilSesi(): Promise<Sesi>` dan `wajibIzin(kode: string): Promise<Sesi>` dari `@/lib/sesi`
  - `type Sesi = { penggunaId: string; nama: string; email: string; izin: string[] }`

- [ ] **Step 1: Tulis pengujian verifikasi kredensial yang gagal**

`tests/identitas/autentikasi.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { users, roles, permissions, rolePermissions, userRoles } from '@/db/schema'
import { hashKataSandi } from '@/modules/identitas/layanan/kata-sandi'
import { verifikasiKredensial, GagalMasukError } from '@/modules/identitas/layanan/autentikasi'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const TABEL = ['user_roles', 'role_permissions', 'permissions', 'roles', 'users', 'audit_logs']

async function buatSuperuser() {
  const [pengguna] = await db.insert(users).values({
    email: 'admin@furni.local', nama: 'Administrator',
    passwordHash: await hashKataSandi('rahasia123'),
  }).returning()
  const [peran] = await db.insert(roles).values({
    kode: 'superuser', nama: 'Superuser', isSystem: true,
  }).returning()
  const [izin] = await db.insert(permissions).values({
    kode: '*', modul: 'sistem', deskripsi: 'Akses penuh',
  }).returning()
  await db.insert(userRoles).values({ userId: pengguna.id, roleId: peran.id })
  await db.insert(rolePermissions).values({ roleId: peran.id, permissionId: izin.id })
  return pengguna
}

beforeEach(async () => { await bersihkanTabel(TABEL) })
afterAll(async () => { await tutupKoneksi() })

describe('verifikasiKredensial', () => {
  it('mengembalikan pengguna beserta izin bila kredensial benar', async () => {
    await buatSuperuser()
    const hasil = await verifikasiKredensial('admin@furni.local', 'rahasia123')
    expect(hasil.nama).toBe('Administrator')
    expect(hasil.izin).toEqual(['*'])
  })

  it('menolak kata sandi yang salah', async () => {
    await buatSuperuser()
    await expect(verifikasiKredensial('admin@furni.local', 'salah123'))
      .rejects.toBeInstanceOf(GagalMasukError)
  })

  it('menolak email yang tidak terdaftar', async () => {
    await expect(verifikasiKredensial('hantu@furni.local', 'rahasia123'))
      .rejects.toBeInstanceOf(GagalMasukError)
  })

  it('memberi pesan galat yang sama untuk email salah maupun kata sandi salah', async () => {
    await buatSuperuser()
    const galatEmail = await verifikasiKredensial('hantu@furni.local', 'rahasia123').catch((e) => e)
    const galatSandi = await verifikasiKredensial('admin@furni.local', 'salah123').catch((e) => e)
    expect(galatEmail.message).toBe(galatSandi.message)
  })

  it('menolak pengguna nonaktif dengan pesan berbeda', async () => {
    const pengguna = await buatSuperuser()
    await db.update(users).set({ isActive: false }).where(eq(users.id, pengguna.id))
    await expect(verifikasiKredensial('admin@furni.local', 'rahasia123'))
      .rejects.toThrow('dinonaktifkan')
  })

  it('memperbarui waktu masuk terakhir', async () => {
    await buatSuperuser()
    await verifikasiKredensial('admin@furni.local', 'rahasia123')
    const [pengguna] = await db.select().from(users).where(eq(users.email, 'admin@furni.local'))
    expect(pengguna.lastLoginAt).not.toBeNull()
  })
})
```

Pengujian "pesan galat yang sama" mencegah kebocoran informasi: pesan berbeda memungkinkan penyerang menebak email mana yang terdaftar.

- [ ] **Step 2: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/identitas/autentikasi.test.ts`
Expected: GAGAL pada impor `verifikasiKredensial`

- [ ] **Step 3: Tulis layanan autentikasi**

`src/modules/identitas/layanan/autentikasi.ts`:
```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { users } from '@/db/schema'
import { cariPenggunaLewatEmail, type PenggunaDenganIzin } from '../repositori/pengguna'
import { cocokKataSandi } from './kata-sandi'

export class GagalMasukError extends Error {
  constructor(pesan = 'Email atau kata sandi salah') {
    super(pesan)
    this.name = 'GagalMasukError'
  }
}

export async function verifikasiKredensial(
  email: string,
  kataSandi: string,
): Promise<PenggunaDenganIzin> {
  const pengguna = await cariPenggunaLewatEmail(email)
  if (!pengguna) throw new GagalMasukError()

  const cocok = await cocokKataSandi(kataSandi, pengguna.passwordHash)
  if (!cocok) throw new GagalMasukError()

  if (!pengguna.isActive) {
    throw new GagalMasukError('Akun Anda telah dinonaktifkan. Hubungi administrator.')
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, pengguna.id))
  return pengguna
}
```

- [ ] **Step 4: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/identitas/autentikasi.test.ts`
Expected: SELURUH pengujian LULUS

- [ ] **Step 5: Tulis konfigurasi Auth.js**

Konfigurasi dipecah dua berkas. `auth.config.ts` bebas dari basis data sehingga aman dipakai middleware; `auth.ts` memuat provider yang mengakses basis data.

`src/auth.config.ts`:
```ts
import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: {
    signIn: '/masuk',
  },
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const sudahMasuk = Boolean(auth?.user)
      const diHalamanMasuk = request.nextUrl.pathname.startsWith('/masuk')
      if (diHalamanMasuk) {
        return sudahMasuk ? Response.redirect(new URL('/dasbor', request.nextUrl)) : true
      }
      return sudahMasuk
    },
    jwt({ token, user }) {
      if (user) {
        token.penggunaId = user.id as string
        token.izin = (user as { izin?: string[] }).izin ?? []
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.penggunaId as string
      session.user.izin = (token.izin as string[]) ?? []
      return session
    },
  },
} satisfies NextAuthConfig
```

`src/auth.ts`:
```ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { authConfig } from './auth.config'
import { verifikasiKredensial } from './modules/identitas/layanan/autentikasi'

const skemaMasuk = z.object({
  email: z.string().email(),
  kataSandi: z.string().min(1),
})

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, kataSandi: {} },
      async authorize(kredensial) {
        const hasil = skemaMasuk.safeParse(kredensial)
        if (!hasil.success) return null
        try {
          const pengguna = await verifikasiKredensial(hasil.data.email, hasil.data.kataSandi)
          return {
            id: pengguna.id,
            email: pengguna.email,
            name: pengguna.nama,
            izin: pengguna.izin,
          }
        } catch {
          return null
        }
      },
    }),
  ],
})
```

`src/types/next-auth.d.ts`:
```ts
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: { id: string; izin: string[] } & DefaultSession['user']
  }
  interface User {
    izin?: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    penggunaId?: string
    izin?: string[]
  }
}
```

`src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from '@/auth'

export const { GET, POST } = handlers
```

`src/middleware.ts`:
```ts
import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

Middleware hanya memeriksa keberadaan sesi lewat JWT; pemeriksaan izin yang sesungguhnya dilakukan di komponen server dan Server Action. Pemisahan ini menghindari akses basis data di lapisan middleware.

- [ ] **Step 6: Tulis pembantu sesi**

`src/lib/sesi.ts`:
```ts
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { punyaIzin } from './izin'

export type Sesi = {
  penggunaId: string
  nama: string
  email: string
  izin: string[]
}

export async function ambilSesi(): Promise<Sesi> {
  const sesi = await auth()
  if (!sesi?.user?.id) redirect('/masuk')
  return {
    penggunaId: sesi.user.id,
    nama: sesi.user.name ?? '',
    email: sesi.user.email ?? '',
    izin: sesi.user.izin ?? [],
  }
}

export class TanpaIzinError extends Error {
  constructor(kode: string) {
    super(`Anda tidak memiliki izin untuk tindakan ini (${kode})`)
    this.name = 'TanpaIzinError'
  }
}

/** Dipakai di komponen server dan Server Action sebelum mengakses data. */
export async function wajibIzin(kode: string): Promise<Sesi> {
  const sesi = await ambilSesi()
  if (!punyaIzin(sesi.izin, kode)) throw new TanpaIzinError(kode)
  return sesi
}
```

- [ ] **Step 7: Tulis halaman masuk**

`src/app/(auth)/layout.tsx`:
```tsx
export default function TataLetakAuth({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      {children}
    </div>
  )
}
```

`src/app/(auth)/masuk/page.tsx`:
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormulirMasuk } from './formulir'

export const metadata = { title: 'Masuk · ERP Furni' }

export default function HalamanMasuk() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Masuk ke ERP Furni</CardTitle>
        <CardDescription>Gunakan akun yang diberikan administrator.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormulirMasuk />
      </CardContent>
    </Card>
  )
}
```

`src/app/(auth)/masuk/formulir.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { aksiMasuk, type StatusMasuk } from './aksi'

const awal: StatusMasuk = { galat: null }

export function FormulirMasuk() {
  const [status, kirim, sedangKirim] = useActionState(aksiMasuk, awal)

  return (
    <form action={kirim} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kataSandi">Kata Sandi</Label>
        <Input id="kataSandi" name="kataSandi" type="password" required autoComplete="current-password" />
      </div>
      {status.galat && (
        <p role="alert" className="text-sm text-destructive">{status.galat}</p>
      )}
      <Button type="submit" className="w-full" disabled={sedangKirim}>
        {sedangKirim ? 'Memproses…' : 'Masuk'}
      </Button>
    </form>
  )
}
```

`src/app/(auth)/masuk/aksi.ts`:
```ts
'use server'

import { AuthError } from 'next-auth'
import { signIn } from '@/auth'

export type StatusMasuk = { galat: string | null }

export async function aksiMasuk(_sebelumnya: StatusMasuk, data: FormData): Promise<StatusMasuk> {
  try {
    await signIn('credentials', {
      email: String(data.get('email') ?? ''),
      kataSandi: String(data.get('kataSandi') ?? ''),
      redirectTo: '/dasbor',
    })
    return { galat: null }
  } catch (galat) {
    if (galat instanceof AuthError) {
      return { galat: 'Email atau kata sandi salah' }
    }
    throw galat
  }
}
```

`signIn` melempar pengalihan sebagai exception saat berhasil, sehingga `throw galat` di cabang terakhir wajib ada — tanpa itu, pengalihan setelah login berhasil akan tertelan.

- [ ] **Step 8: Jalankan seluruh pengujian dan periksa tipe**

Run: `pnpm test && pnpm exec tsc --noEmit`
Expected: pengujian LULUS dan tidak ada galat tipe

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(identitas): autentikasi kredensial dan penjagaan rute

Menambahkan Auth.js dengan strategi JWT dan konfigurasi terpisah agar
middleware bebas dari akses basis data. Pesan galat login disamakan untuk
email salah maupun kata sandi salah agar tidak membocorkan email mana yang
terdaftar. Menyediakan pembantu wajibIzin() untuk komponen server."
```

---

## Task 6: Kerangka Aplikasi, Sidebar Accordion, dan Palet Perintah

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/dasbor/page.tsx`
- Create: `src/components/tata-letak/sidebar.tsx`
- Create: `src/components/tata-letak/bilah-atas.tsx`
- Create: `src/components/tata-letak/palet-perintah.tsx`
- Create: `src/components/tata-letak/aksi-keluar.ts`
- Modify: `src/app/layout.tsx` (bahasa dokumen dan Toaster)
- Modify: `src/app/page.tsx` (alihkan ke dasbor)
- Test: `tests/lib/navigasi-ikon.test.ts`

**Interfaces:**
- Consumes: `navigasiTerlihat`, `ItemMenu`, `FASE_AKTIF` dari Task 3; `ambilSesi` dari Task 5
- Produces:
  - `<Sidebar item={ItemMenu[]} />` dari `@/components/tata-letak/sidebar`
  - `<PaletPerintah item={ItemMenu[]} />` dari `@/components/tata-letak/palet-perintah`
  - `aksiKeluar(): Promise<void>` dari `@/components/tata-letak/aksi-keluar`

- [ ] **Step 1: Tulis pengujian ikon yang gagal**

Nama ikon di `navigasi.ts` adalah string yang harus benar-benar ada di `lucide-react`. Salah ketik hanya akan terlihat saat halaman dibuka, jadi diuji lebih awal.

`tests/lib/navigasi-ikon.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import * as ikon from 'lucide-react'
import { NAVIGASI } from '@/lib/navigasi'

describe('ikon navigasi', () => {
  it('setiap grup utama memiliki nama ikon', () => {
    for (const grup of NAVIGASI) {
      expect(grup.ikon, `ikon hilang pada grup "${grup.label}"`).toBeTruthy()
    }
  })

  it('setiap nama ikon benar-benar tersedia di lucide-react', () => {
    for (const grup of NAVIGASI) {
      expect(
        Object.prototype.hasOwnProperty.call(ikon, grup.ikon!),
        `ikon "${grup.ikon}" pada grup "${grup.label}" tidak ada di lucide-react`,
      ).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Jalankan pengujian untuk memastikan gagal atau lulus**

Run: `pnpm vitest run tests/lib/navigasi-ikon.test.ts`
Expected: LULUS bila seluruh nama ikon di Task 3 benar. Bila ada yang GAGAL, perbaiki nama ikon di `src/lib/navigasi.ts` sampai lulus sebelum melanjutkan.

- [ ] **Step 3: Tulis peta ikon dan sidebar**

`src/components/tata-letak/sidebar.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import * as Ikon from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ItemMenu } from '@/lib/navigasi'

function IkonDinamis({ nama, className }: { nama?: string; className?: string }) {
  if (!nama) return null
  const Komponen = (Ikon as unknown as Record<string, React.ComponentType<{ className?: string }>>)[nama]
  return Komponen ? <Komponen className={className} /> : null
}

function grupYangMemuat(item: ItemMenu[], jalur: string): string | null {
  for (const grup of item) {
    if (grup.rute === jalur) return grup.label
    if (grup.anak?.some((a) => a.rute && jalur.startsWith(a.rute))) return grup.label
  }
  return null
}

export function Sidebar({ item }: { item: ItemMenu[] }) {
  const jalur = usePathname()
  const [terbuka, setTerbuka] = useState<string | null>(() => grupYangMemuat(item, jalur))

  return (
    <nav aria-label="Navigasi utama" className="flex h-full w-64 shrink-0 flex-col border-r bg-background">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Ikon.Armchair className="h-5 w-5 text-primary" />
        <span className="font-semibold tracking-tight">ERP Furni</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {item.map((grup) => {
          const aktif = grup.rute ? jalur === grup.rute : grup.label === terbuka

          if (!grup.anak) {
            return (
              <Link
                key={grup.label}
                href={grup.rute!}
                className={cn(
                  'mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  jalur === grup.rute ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-accent/50',
                )}
              >
                <IkonDinamis nama={grup.ikon} className="h-4 w-4" />
                {grup.label}
              </Link>
            )
          }

          return (
            <div key={grup.label} className="mb-1">
              <button
                type="button"
                aria-expanded={aktif}
                onClick={() => setTerbuka(aktif ? null : grup.label)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent/50"
              >
                <IkonDinamis nama={grup.ikon} className="h-4 w-4" />
                <span className="flex-1 text-left">{grup.label}</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', aktif && 'rotate-180')} />
              </button>

              {aktif && (
                <ul className="mt-1 space-y-0.5 border-l pl-4 ml-4">
                  {grup.anak.map((anak) => (
                    <li key={anak.rute}>
                      <Link
                        href={anak.rute!}
                        className={cn(
                          'block rounded-md px-3 py-1.5 text-sm transition-colors',
                          jalur === anak.rute
                            ? 'bg-accent font-medium text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                        )}
                      >
                        {anak.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
```

Hanya satu grup terbuka pada satu waktu, sesuai keputusan desain. Grup yang memuat halaman aktif terbuka otomatis saat pertama dirender.

- [ ] **Step 4: Tulis palet perintah**

`src/components/tata-letak/palet-perintah.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import type { ItemMenu } from '@/lib/navigasi'

export function PaletPerintah({ item }: { item: ItemMenu[] }) {
  const [terbuka, setTerbuka] = useState(false)
  const router = useRouter()

  useEffect(() => {
    function tekan(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setTerbuka((t) => !t)
      }
    }
    document.addEventListener('keydown', tekan)
    return () => document.removeEventListener('keydown', tekan)
  }, [])

  function buka(rute: string) {
    setTerbuka(false)
    router.push(rute)
  }

  return (
    <CommandDialog open={terbuka} onOpenChange={setTerbuka}>
      <CommandInput placeholder="Cari menu…" />
      <CommandList>
        <CommandEmpty>Menu tidak ditemukan.</CommandEmpty>
        {item.map((grup) => (
          <CommandGroup key={grup.label} heading={grup.label}>
            {grup.anak
              ? grup.anak.map((anak) => (
                  <CommandItem key={anak.rute} value={`${grup.label} ${anak.label}`} onSelect={() => buka(anak.rute!)}>
                    {anak.label}
                  </CommandItem>
                ))
              : (
                  <CommandItem value={grup.label} onSelect={() => buka(grup.rute!)}>
                    {grup.label}
                  </CommandItem>
                )}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
```

- [ ] **Step 5: Tulis bilah atas dan aksi keluar**

`src/components/tata-letak/aksi-keluar.ts`:
```ts
'use server'

import { signOut } from '@/auth'

export async function aksiKeluar() {
  await signOut({ redirectTo: '/masuk' })
}
```

`src/components/tata-letak/bilah-atas.tsx`:
```tsx
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { aksiKeluar } from './aksi-keluar'

export function BilahAtas({ nama, email }: { nama: string; email: string }) {
  const inisial = nama.split(' ').map((k) => k[0]).slice(0, 2).join('').toUpperCase()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Search className="h-4 w-4" />
        Tekan <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Ctrl</kbd>
        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">K</kbd> untuk mencari menu
      </p>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {inisial}
            </span>
            <span className="hidden sm:inline">{nama}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="font-medium">{nama}</p>
            <p className="text-xs font-normal text-muted-foreground">{email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form action={aksiKeluar}>
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full cursor-pointer text-left">Keluar</button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

- [ ] **Step 6: Tulis kerangka aplikasi**

`src/app/(app)/layout.tsx`:
```tsx
import { ambilSesi } from '@/lib/sesi'
import { navigasiTerlihat } from '@/lib/navigasi'
import { Sidebar } from '@/components/tata-letak/sidebar'
import { BilahAtas } from '@/components/tata-letak/bilah-atas'
import { PaletPerintah } from '@/components/tata-letak/palet-perintah'

export default async function TataLetakAplikasi({ children }: { children: React.ReactNode }) {
  const sesi = await ambilSesi()
  const menu = navigasiTerlihat(sesi.izin)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar item={menu} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <BilahAtas nama={sesi.nama} email={sesi.email} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <PaletPerintah item={menu} />
    </div>
  )
}
```

Menu disaring di server berdasarkan izin sesi. Rute yang tidak boleh diakses tidak pernah dikirim ke peramban.

`src/app/(app)/dasbor/page.tsx`:
```tsx
import { wajibIzin } from '@/lib/sesi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Dasbor · ERP Furni' }

export default async function HalamanDasbor() {
  const sesi = await wajibIzin('dasbor.ringkasan.lihat')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dasbor</h1>
        <p className="text-muted-foreground">Selamat datang kembali, {sesi.nama}.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Keuangan</CardTitle>
          <CardDescription>
            Ringkasan akan terisi setelah mesin jurnal aktif pada Fase 1B.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Mulailah dengan menyiapkan Bagan Akun dan Mitra Usaha melalui menu Akuntansi.
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 7: Sesuaikan layout akar dan halaman awal**

`src/app/layout.tsx` — ubah atribut bahasa menjadi `id`, tetapkan metadata, dan pasang Toaster:
```tsx
import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'ERP Furni', template: '%s · ERP Furni' },
  description: 'Sistem ERP manufaktur furnitur',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
```

Pertahankan pemuatan font bawaan create-next-app bila ada; hanya ubah `lang`, metadata, dan tambahkan `<Toaster />`.

`src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default function Beranda() {
  redirect('/dasbor')
}
```

- [ ] **Step 8: Verifikasi manual di peramban**

```bash
pnpm dev
```

Periksa berurutan:
1. Membuka `http://localhost:3000` mengalihkan ke `/masuk`
2. Halaman masuk tampil dalam bahasa Indonesia
3. Login dengan kredensial salah menampilkan "Email atau kata sandi salah"
4. Login benar mengalihkan ke `/dasbor`. Pengguna administrator baru dibuat oleh seed pada Task 14; untuk memverifikasi sekarang, buat satu pengguna sementara lewat `psql` atau lewati langkah 4 sampai 8 dan ulangi setelah Task 14
5. Sidebar hanya menampilkan grup fase 1: Dasbor, Kontak, Akuntansi, Pengaturan
6. Membuka satu grup menutup grup lain
7. `Ctrl+K` membuka palet perintah dan mengetik "neraca" memunculkan menu terkait
8. Menu Keluar mengembalikan ke halaman masuk

- [ ] **Step 9: Jalankan pengujian dan periksa tipe**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: seluruhnya berhasil tanpa galat

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(tata-letak): kerangka aplikasi, sidebar accordion, dan palet perintah

Menyusun kerangka aplikasi dengan sidebar sembilan grup yang hanya membuka
satu grup pada satu waktu, bilah atas dengan menu pengguna, serta palet
perintah Ctrl+K. Menu disaring di server berdasarkan izin sesi sehingga
rute yang tidak diizinkan tidak pernah dikirim ke peramban."
```

---

## Task 7: Konfigurasi Perusahaan, Tahun Buku, dan Layanan Penomoran

**Files:**
- Create: `src/db/schema/konfigurasi.ts`
- Modify: `src/db/schema/index.ts`
- Create: `src/modules/akuntansi/layanan/urutan.ts`
- Create: `src/modules/akuntansi/layanan/penguncian.ts`
- Test: `tests/akuntansi/urutan.test.ts`, `tests/akuntansi/penguncian.test.ts`

**Interfaces:**
- Consumes: `db` dari `@/db/klien`
- Produces:
  - Tabel `companySettings`, `fiscalYears`, `sequences` dari `@/db/schema/konfigurasi`
  - `ambilNomorBerikut(tx: Transaksi, kodeUrutan: string, tanggal: Date): Promise<string>` dari `@/modules/akuntansi/layanan/urutan`
  - `type Transaksi` — tipe transaksi Drizzle, diekspor dari `@/db/klien`
  - `periodeTerkunci(tanggal: Date): Promise<boolean>` dan `wajibPeriodeTerbuka(tanggal: Date): Promise<void>` dari `@/modules/akuntansi/layanan/penguncian`
  - `class PeriodeTerkunciError extends Error` dari modul yang sama

- [ ] **Step 1: Tulis skema konfigurasi**

`src/db/schema/konfigurasi.ts`:
```ts
import {
  pgTable, uuid, text, integer, date, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core'
import { statusTahunBukuEnum, resetUrutanEnum } from './enum'

export const companySettings = pgTable('company_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  nama: text('nama').notNull(),
  npwp: text('npwp'),
  alamat: text('alamat'),
  kota: text('kota'),
  provinsi: text('provinsi'),
  kodePos: text('kode_pos'),
  telepon: text('telepon'),
  email: text('email'),
  logoUrl: text('logo_url'),
  mataUangFungsional: text('mata_uang_fungsional').notNull().default('IDR'),
  bulanAwalTahunBuku: integer('bulan_awal_tahun_buku').notNull().default(1),
  tanggalKunciBuku: date('tanggal_kunci_buku'),
  tanggalKunciPajak: date('tanggal_kunci_pajak'),
  akunLabaDitahanId: uuid('akun_laba_ditahan_id'),
  akunSelisihKursUntungId: uuid('akun_selisih_kurs_untung_id'),
  akunSelisihKursRugiId: uuid('akun_selisih_kurs_rugi_id'),
  akunPembulatanId: uuid('akun_pembulatan_id'),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
})

export const fiscalYears = pgTable('fiscal_years', {
  id: uuid('id').primaryKey().defaultRandom(),
  nama: text('nama').notNull(),
  tanggalMulai: date('tanggal_mulai').notNull(),
  tanggalSelesai: date('tanggal_selesai').notNull(),
  status: statusTahunBukuEnum('status').notNull().default('terbuka'),
  entryPenutupId: uuid('entry_penutup_id'),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('fiscal_years_nama_unik').on(t.nama)])

export const sequences = pgTable('sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  prefix: text('prefix').notNull(),
  panjangDigit: integer('panjang_digit').notNull().default(4),
  nomorBerikut: integer('nomor_berikut').notNull().default(1),
  reset: resetUrutanEnum('reset').notNull().default('tahunan'),
  tahunTerakhir: integer('tahun_terakhir'),
  bulanTerakhir: integer('bulan_terakhir'),
}, (t) => [uniqueIndex('sequences_kode_unik').on(t.kode)])
```

Kolom akun default pada `company_settings` sengaja tidak memakai `references()` karena tabel `accounts` baru dibuat pada Task 9. Kunci asing ditambahkan pada Task 9 setelah tabel tujuannya ada.

- [ ] **Step 2: Ekspor skema, hasilkan dan jalankan migrasi**

Tambahkan ke `src/db/schema/index.ts`:
```ts
export * from './konfigurasi'
```

```bash
pnpm db:generate && pnpm db:migrate
```

- [ ] **Step 3: Ekspor tipe transaksi dari klien**

Tambahkan ke akhir `src/db/klien.ts`:
```ts
export type Transaksi = Parameters<Parameters<typeof db.transaction>[0]>[0]
```

- [ ] **Step 4: Tulis pengujian penomoran yang gagal**

`tests/akuntansi/urutan.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { sequences } from '@/db/schema'
import { ambilNomorBerikut } from '@/modules/akuntansi/layanan/urutan'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

beforeEach(async () => { await bersihkanTabel(['sequences']) })
afterAll(async () => { await tutupKoneksi() })

async function buatUrutan(ubah: Partial<typeof sequences.$inferInsert> = {}) {
  await db.insert(sequences).values({
    kode: 'jurnal_umum', prefix: 'JU', panjangDigit: 4, nomorBerikut: 1, reset: 'tahunan',
    ...ubah,
  })
}

describe('ambilNomorBerikut — pembentukan format', () => {
  it('menyusun nomor tahunan sebagai PREFIX/TAHUN/NOMOR', async () => {
    await buatUrutan()
    const nomor = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2026-09-08')))
    expect(nomor).toBe('JU/2026/0001')
  })

  it('menyusun nomor bulanan sebagai PREFIX/TAHUN/BULAN/NOMOR', async () => {
    await buatUrutan({ reset: 'bulanan' })
    const nomor = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2026-09-08')))
    expect(nomor).toBe('JU/2026/09/0001')
  })

  it('menyusun nomor tanpa reset sebagai PREFIX/NOMOR', async () => {
    await buatUrutan({ reset: 'tidak_pernah' })
    const nomor = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2026-09-08')))
    expect(nomor).toBe('JU/0001')
  })

  it('menghormati panjang digit yang ditetapkan', async () => {
    await buatUrutan({ panjangDigit: 6, nomorBerikut: 42 })
    const nomor = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2026-09-08')))
    expect(nomor).toBe('JU/2026/000042')
  })

  it('tidak memotong nomor yang melampaui panjang digit', async () => {
    await buatUrutan({ panjangDigit: 2, nomorBerikut: 12345 })
    const nomor = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2026-09-08')))
    expect(nomor).toBe('JU/2026/12345')
  })
})

describe('ambilNomorBerikut — pencacahan dan reset', () => {
  it('menaikkan nomor pada pemanggilan berikutnya', async () => {
    await buatUrutan()
    const a = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2026-09-08')))
    const b = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2026-09-09')))
    expect([a, b]).toEqual(['JU/2026/0001', 'JU/2026/0002'])
  })

  it('mengulang dari satu saat tahun berganti', async () => {
    await buatUrutan()
    await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2026-12-31')))
    const baru = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2027-01-01')))
    expect(baru).toBe('JU/2027/0001')
  })

  it('mengulang dari satu saat bulan berganti pada reset bulanan', async () => {
    await buatUrutan({ reset: 'bulanan' })
    await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2026-09-30')))
    const baru = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2026-10-01')))
    expect(baru).toBe('JU/2026/10/0001')
  })

  it('tidak mengulang saat tahun berganti bila reset tidak pernah', async () => {
    await buatUrutan({ reset: 'tidak_pernah' })
    await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2026-12-31')))
    const baru = await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2027-01-01')))
    expect(baru).toBe('JU/0002')
  })

  it('menyimpan kembali penanda periode ke basis data', async () => {
    await buatUrutan({ reset: 'bulanan' })
    await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', new Date('2026-09-08')))
    const [baris] = await db.select().from(sequences).where(eq(sequences.kode, 'jurnal_umum'))
    expect(baris.tahunTerakhir).toBe(2026)
    expect(baris.bulanTerakhir).toBe(9)
    expect(baris.nomorBerikut).toBe(2)
  })
})

describe('ambilNomorBerikut — kegagalan', () => {
  it('menolak kode urutan yang tidak terdaftar', async () => {
    await expect(
      db.transaction((tx) => ambilNomorBerikut(tx, 'tidak_ada', new Date('2026-09-08'))),
    ).rejects.toThrow('tidak ditemukan')
  })
})

describe('ambilNomorBerikut — keserempakan', () => {
  it('tidak menghasilkan nomor kembar saat dua puluh transaksi berjalan bersamaan', async () => {
    await buatUrutan()
    const tanggal = new Date('2026-09-08')
    const hasil = await Promise.all(
      Array.from({ length: 20 }, () =>
        db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal_umum', tanggal)),
      ),
    )
    expect(new Set(hasil).size).toBe(20)
    expect(hasil.sort()).toContain('JU/2026/0020')
  })
})
```

Pengujian keserempakan adalah alasan utama layanan ini ada. Tanpa penguncian baris, dua posting bersamaan akan membaca `nomorBerikut` yang sama dan menghasilkan nomor jurnal kembar.

- [ ] **Step 5: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/akuntansi/urutan.test.ts`
Expected: GAGAL pada impor `ambilNomorBerikut`

- [ ] **Step 6: Tulis layanan penomoran**

`src/modules/akuntansi/layanan/urutan.ts`:
```ts
import { sql } from 'drizzle-orm'
import type { Transaksi } from '@/db/klien'
import { sequences } from '@/db/schema'

type BarisUrutan = {
  id: string
  prefix: string
  panjang_digit: number
  nomor_berikut: number
  reset: 'tidak_pernah' | 'tahunan' | 'bulanan'
  tahun_terakhir: number | null
  bulan_terakhir: number | null
}

/**
 * Mengambil nomor dokumen berikutnya dan menaikkannya dalam satu transaksi.
 * Baris urutan dikunci dengan FOR UPDATE sehingga transaksi lain menunggu
 * sampai penomoran ini selesai — tanpa itu, posting serempak akan
 * menghasilkan nomor kembar.
 */
export async function ambilNomorBerikut(
  tx: Transaksi,
  kodeUrutan: string,
  tanggal: Date,
): Promise<string> {
  const hasil = await tx.execute<BarisUrutan>(sql`
    SELECT id, prefix, panjang_digit, nomor_berikut, reset, tahun_terakhir, bulan_terakhir
    FROM ${sequences}
    WHERE kode = ${kodeUrutan}
    FOR UPDATE
  `)

  const baris = hasil[0] as BarisUrutan | undefined
  if (!baris) throw new Error(`Urutan penomoran "${kodeUrutan}" tidak ditemukan`)

  const tahun = tanggal.getFullYear()
  const bulan = tanggal.getMonth() + 1

  const perluReset =
    (baris.reset === 'tahunan' && baris.tahun_terakhir !== null && baris.tahun_terakhir !== tahun) ||
    (baris.reset === 'bulanan' &&
      ((baris.tahun_terakhir !== null && baris.tahun_terakhir !== tahun) ||
        (baris.bulan_terakhir !== null && baris.bulan_terakhir !== bulan)))

  const nomor = perluReset ? 1 : baris.nomor_berikut

  await tx.execute(sql`
    UPDATE ${sequences}
    SET nomor_berikut = ${nomor + 1},
        tahun_terakhir = ${tahun},
        bulan_terakhir = ${bulan}
    WHERE id = ${baris.id}
  `)

  const berpadding = String(nomor).padStart(baris.panjang_digit, '0')

  switch (baris.reset) {
    case 'bulanan':
      return `${baris.prefix}/${tahun}/${String(bulan).padStart(2, '0')}/${berpadding}`
    case 'tahunan':
      return `${baris.prefix}/${tahun}/${berpadding}`
    default:
      return `${baris.prefix}/${berpadding}`
  }
}
```

`String.padStart` tidak memotong nilai yang lebih panjang dari target, sehingga nomor ke-12345 pada urutan berpanjang dua digit tetap utuh.

- [ ] **Step 7: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/akuntansi/urutan.test.ts`
Expected: SELURUH pengujian LULUS, termasuk pengujian keserempakan

- [ ] **Step 8: Tulis pengujian penguncian periode yang gagal**

`tests/akuntansi/penguncian.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/klien'
import { companySettings } from '@/db/schema'
import {
  periodeTerkunci, wajibPeriodeTerbuka, PeriodeTerkunciError,
} from '@/modules/akuntansi/layanan/penguncian'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

beforeEach(async () => { await bersihkanTabel(['company_settings']) })
afterAll(async () => { await tutupKoneksi() })

async function aturKunci(tanggalKunci: string | null) {
  await db.insert(companySettings).values({
    nama: 'PT Furni Nusantara',
    tanggalKunciBuku: tanggalKunci,
  })
}

describe('penguncian periode', () => {
  it('menganggap periode terbuka bila tanggal kunci belum diatur', async () => {
    await aturKunci(null)
    expect(await periodeTerkunci(new Date('2020-01-01'))).toBe(false)
  })

  it('menganggap periode terbuka bila pengaturan perusahaan belum ada', async () => {
    expect(await periodeTerkunci(new Date('2020-01-01'))).toBe(false)
  })

  it('mengunci tanggal sebelum tanggal kunci', async () => {
    await aturKunci('2026-08-31')
    expect(await periodeTerkunci(new Date('2026-08-30'))).toBe(true)
  })

  it('mengunci tepat pada tanggal kunci', async () => {
    await aturKunci('2026-08-31')
    expect(await periodeTerkunci(new Date('2026-08-31'))).toBe(true)
  })

  it('membiarkan tanggal setelah tanggal kunci terbuka', async () => {
    await aturKunci('2026-08-31')
    expect(await periodeTerkunci(new Date('2026-09-01'))).toBe(false)
  })

  it('melempar galat bermakna saat periode terkunci', async () => {
    await aturKunci('2026-08-31')
    await expect(wajibPeriodeTerbuka(new Date('2026-08-15')))
      .rejects.toBeInstanceOf(PeriodeTerkunciError)
    await expect(wajibPeriodeTerbuka(new Date('2026-08-15')))
      .rejects.toThrow('31 Agustus 2026')
  })

  it('tidak melempar galat saat periode terbuka', async () => {
    await aturKunci('2026-08-31')
    await expect(wajibPeriodeTerbuka(new Date('2026-09-01'))).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 9: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/akuntansi/penguncian.test.ts`
Expected: GAGAL pada impor modul penguncian

- [ ] **Step 10: Tulis layanan penguncian periode**

`src/modules/akuntansi/layanan/penguncian.ts`:
```ts
import { db } from '@/db/klien'
import { companySettings } from '@/db/schema'

const BULAN_INDONESIA = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function formatTanggalIndonesia(tanggal: Date): string {
  return `${tanggal.getDate()} ${BULAN_INDONESIA[tanggal.getMonth()]} ${tanggal.getFullYear()}`
}

export class PeriodeTerkunciError extends Error {
  constructor(tanggalKunci: Date) {
    super(
      `Periode akuntansi terkunci sampai ${formatTanggalIndonesia(tanggalKunci)}. ` +
      'Transaksi pada tanggal tersebut atau sebelumnya tidak dapat dibuat, diubah, maupun dihapus.',
    )
    this.name = 'PeriodeTerkunciError'
  }
}

async function ambilTanggalKunci(): Promise<Date | null> {
  const [pengaturan] = await db.select().from(companySettings).limit(1)
  if (!pengaturan?.tanggalKunciBuku) return null
  return new Date(`${pengaturan.tanggalKunciBuku}T00:00:00Z`)
}

function keHariUtc(tanggal: Date): number {
  return Date.UTC(tanggal.getUTCFullYear(), tanggal.getUTCMonth(), tanggal.getUTCDate())
}

export async function periodeTerkunci(tanggal: Date): Promise<boolean> {
  const kunci = await ambilTanggalKunci()
  if (!kunci) return false
  return keHariUtc(tanggal) <= keHariUtc(kunci)
}

export async function wajibPeriodeTerbuka(tanggal: Date): Promise<void> {
  const kunci = await ambilTanggalKunci()
  if (!kunci) return
  if (keHariUtc(tanggal) <= keHariUtc(kunci)) throw new PeriodeTerkunciError(kunci)
}
```

Perbandingan dilakukan pada tingkat hari dalam UTC, bukan pada nilai waktu penuh. Tanpa normalisasi ini, transaksi pukul 10.00 pada tanggal kunci akan lolos padahal seharusnya ditolak.

- [ ] **Step 11: Jalankan seluruh pengujian**

Run: `pnpm test`
Expected: SELURUH pengujian LULUS

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(akuntansi): konfigurasi perusahaan, tahun buku, dan layanan penomoran

Menambahkan tabel pengaturan perusahaan, tahun buku, dan urutan penomoran.
Layanan penomoran mengunci baris dengan FOR UPDATE sehingga posting serempak
tidak menghasilkan nomor kembar, diverifikasi dengan pengujian dua puluh
transaksi paralel. Penguncian periode membandingkan tanggal pada tingkat
hari UTC agar transaksi tengah hari pada tanggal kunci tetap ditolak."
```

---

## Task 8: Mata Uang dan Layanan Kurs

**Files:**
- Create: `src/db/schema/mata-uang.ts`
- Modify: `src/db/schema/index.ts`
- Create: `src/modules/akuntansi/layanan/kurs.ts`
- Test: `tests/akuntansi/kurs.test.ts`

**Interfaces:**
- Consumes: `db` dari `@/db/klien`; `Uang`, `kali`, `bulatkan` dari `@/lib/uang`
- Produces:
  - Tabel `currencies`, `currencyRates` dari `@/db/schema/mata-uang`
  - `const MATA_UANG_FUNGSIONAL = 'IDR'` dari `@/modules/akuntansi/layanan/kurs`
  - `ambilKurs(kodeMataUang: string, tanggal: Date): Promise<Uang>`
  - `konversiKeIdr(nilai: Uang, kodeMataUang: string, tanggal: Date): Promise<Uang>`
  - `class KursTidakDitemukanError extends Error`

- [ ] **Step 1: Tulis skema mata uang**

`src/db/schema/mata-uang.ts`:
```ts
import {
  pgTable, uuid, text, integer, boolean, date, numeric, uniqueIndex, index,
} from 'drizzle-orm/pg-core'

export const currencies = pgTable('currencies', {
  kode: text('kode').primaryKey(),
  nama: text('nama').notNull(),
  simbol: text('simbol').notNull(),
  desimal: integer('desimal').notNull().default(2),
  isActive: boolean('is_active').notNull().default(true),
})

export const currencyRates = pgTable('currency_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  kodeMataUang: text('kode_mata_uang').notNull().references(() => currencies.kode, { onDelete: 'cascade' }),
  tanggal: date('tanggal').notNull(),
  kurs: numeric('kurs', { precision: 18, scale: 6 }).notNull(),
}, (t) => [
  uniqueIndex('currency_rates_unik').on(t.kodeMataUang, t.tanggal),
  index('currency_rates_pencarian_idx').on(t.kodeMataUang, t.tanggal),
])
```

- [ ] **Step 2: Ekspor skema, hasilkan dan jalankan migrasi**

Tambahkan ke `src/db/schema/index.ts`:
```ts
export * from './mata-uang'
```

```bash
pnpm db:generate && pnpm db:migrate
```

- [ ] **Step 3: Tulis pengujian kurs yang gagal**

`tests/akuntansi/kurs.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/klien'
import { currencies, currencyRates } from '@/db/schema'
import {
  ambilKurs, konversiKeIdr, MATA_UANG_FUNGSIONAL, KursTidakDitemukanError,
} from '@/modules/akuntansi/layanan/kurs'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

beforeEach(async () => {
  await bersihkanTabel(['currency_rates', 'currencies'])
  await db.insert(currencies).values([
    { kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 },
    { kode: 'USD', nama: 'Dolar Amerika Serikat', simbol: '$', desimal: 2 },
    { kode: 'EUR', nama: 'Euro', simbol: '€', desimal: 2 },
  ])
})
afterAll(async () => { await tutupKoneksi() })

describe('ambilKurs', () => {
  it('mengembalikan satu untuk mata uang fungsional tanpa menyentuh basis data', async () => {
    expect(await ambilKurs(MATA_UANG_FUNGSIONAL, new Date('2026-09-08'))).toBe('1')
  })

  it('mengembalikan kurs pada tanggal yang tepat', async () => {
    await db.insert(currencyRates).values({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '16250.000000' })
    expect(await ambilKurs('USD', new Date('2026-09-08'))).toBe('16250')
  })

  it('memakai kurs terakhir sebelum tanggal transaksi bila tanggal persisnya tidak ada', async () => {
    await db.insert(currencyRates).values([
      { kodeMataUang: 'USD', tanggal: '2026-09-01', kurs: '16000.000000' },
      { kodeMataUang: 'USD', tanggal: '2026-09-05', kurs: '16250.000000' },
    ])
    expect(await ambilKurs('USD', new Date('2026-09-08'))).toBe('16250')
  })

  it('tidak memakai kurs yang tanggalnya melampaui tanggal transaksi', async () => {
    await db.insert(currencyRates).values([
      { kodeMataUang: 'USD', tanggal: '2026-09-01', kurs: '16000.000000' },
      { kodeMataUang: 'USD', tanggal: '2026-09-30', kurs: '17000.000000' },
    ])
    expect(await ambilKurs('USD', new Date('2026-09-08'))).toBe('16000')
  })

  it('memisahkan kurs antar mata uang', async () => {
    await db.insert(currencyRates).values([
      { kodeMataUang: 'USD', tanggal: '2026-09-01', kurs: '16000.000000' },
      { kodeMataUang: 'EUR', tanggal: '2026-09-01', kurs: '17500.000000' },
    ])
    expect(await ambilKurs('EUR', new Date('2026-09-08'))).toBe('17500')
  })

  it('melempar galat bila tidak ada kurs pada atau sebelum tanggal transaksi', async () => {
    await db.insert(currencyRates).values({ kodeMataUang: 'USD', tanggal: '2026-09-30', kurs: '17000.000000' })
    await expect(ambilKurs('USD', new Date('2026-09-08')))
      .rejects.toBeInstanceOf(KursTidakDitemukanError)
  })

  it('menyebutkan mata uang dan tanggal dalam pesan galat', async () => {
    await expect(ambilKurs('USD', new Date('2026-09-08')))
      .rejects.toThrow(/USD.*8 September 2026/)
  })
})

describe('konversiKeIdr', () => {
  it('mengembalikan nilai apa adanya untuk mata uang fungsional', async () => {
    expect(await konversiKeIdr('1500.55', 'IDR', new Date('2026-09-08'))).toBe('1500.55')
  })

  it('mengalikan nilai asing dengan kurs lalu membulatkan ke dua desimal', async () => {
    await db.insert(currencyRates).values({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '16250.000000' })
    expect(await konversiKeIdr('100.50', 'USD', new Date('2026-09-08'))).toBe('1633125.00')
  })

  it('membulatkan setengah ke atas pada hasil konversi', async () => {
    await db.insert(currencyRates).values({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '15000.005000' })
    expect(await konversiKeIdr('0.01', 'USD', new Date('2026-09-08'))).toBe('150.00')
  })

  it('mempertahankan presisi pada nilai besar', async () => {
    await db.insert(currencyRates).values({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '16250.000000' })
    expect(await konversiKeIdr('1000000.01', 'USD', new Date('2026-09-08'))).toBe('16250000162.50')
  })
})
```

- [ ] **Step 4: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/akuntansi/kurs.test.ts`
Expected: GAGAL pada impor modul kurs

- [ ] **Step 5: Tulis layanan kurs**

`src/modules/akuntansi/layanan/kurs.ts`:
```ts
import { and, desc, eq, lte } from 'drizzle-orm'
import { db } from '@/db/klien'
import { currencyRates } from '@/db/schema'
import { bulatkan, kali, type Uang } from '@/lib/uang'
import { formatTanggalIndonesia } from './penguncian'

export const MATA_UANG_FUNGSIONAL = 'IDR'
const DESIMAL_IDR = 2

export class KursTidakDitemukanError extends Error {
  constructor(kodeMataUang: string, tanggal: Date) {
    super(
      `Kurs ${kodeMataUang} untuk tanggal ${formatTanggalIndonesia(tanggal)} belum tersedia. ` +
      'Masukkan kurs melalui menu Mata Uang & Kurs terlebih dahulu.',
    )
    this.name = 'KursTidakDitemukanError'
  }
}

function keTanggalIso(tanggal: Date): string {
  return tanggal.toISOString().slice(0, 10)
}

/**
 * Kurs bermakna jumlah IDR per satu unit mata uang asing.
 * Bila tanggal persisnya tidak tercatat, dipakai kurs terakhir yang
 * berlaku sebelum tanggal transaksi — kurs masa depan tidak pernah dipakai.
 */
export async function ambilKurs(kodeMataUang: string, tanggal: Date): Promise<Uang> {
  if (kodeMataUang === MATA_UANG_FUNGSIONAL) return '1'

  const [baris] = await db
    .select({ kurs: currencyRates.kurs })
    .from(currencyRates)
    .where(and(
      eq(currencyRates.kodeMataUang, kodeMataUang),
      lte(currencyRates.tanggal, keTanggalIso(tanggal)),
    ))
    .orderBy(desc(currencyRates.tanggal))
    .limit(1)

  if (!baris) throw new KursTidakDitemukanError(kodeMataUang, tanggal)

  return String(Number(baris.kurs))
}

export async function konversiKeIdr(
  nilai: Uang,
  kodeMataUang: string,
  tanggal: Date,
): Promise<Uang> {
  if (kodeMataUang === MATA_UANG_FUNGSIONAL) return nilai
  const kurs = await ambilKurs(kodeMataUang, tanggal)
  return bulatkan(kali(nilai, kurs), DESIMAL_IDR)
}
```

Catatan pada `String(Number(baris.kurs))`: PostgreSQL mengembalikan `numeric` sebagai string berpadding nol seperti `'16250.000000'`, sementara pengujian mengharapkan `'16250'`. Konversi ini hanya membuang nol di belakang dan aman untuk rentang nilai kurs; nilai uang itu sendiri tidak pernah melewati `Number`.

- [ ] **Step 6: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/akuntansi/kurs.test.ts`
Expected: SELURUH pengujian LULUS

- [ ] **Step 7: Jalankan seluruh pengujian**

Run: `pnpm test`
Expected: SELURUH pengujian LULUS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(akuntansi): mata uang dan layanan kurs

Menambahkan tabel mata uang beserta kurs harian. Pencarian kurs memakai
tanggal terakhir yang berlaku sebelum tanggal transaksi dan tidak pernah
memakai kurs bertanggal setelahnya, sehingga jurnal lama tidak berubah
saat kurs baru dimasukkan."
```

---

## Task 9: Bagan Akun beserta Pola CRUD yang Dipakai Ulang

Tugas ini menetapkan pola yang dipakai kembali oleh Task 10 dan 11: komponen tabel generik, susunan repositori-layanan-validasi, dan bentuk Server Action.

**Files:**
- Create: `src/db/schema/akuntansi.ts` (bagian `accounts`)
- Modify: `src/db/schema/index.ts`, `src/db/schema/konfigurasi.ts` (tambah kunci asing)
- Create: `src/lib/galat.ts`
- Create: `src/components/data/tabel-data.tsx`, `src/components/data/kepala-halaman.tsx`
- Create: `src/modules/akuntansi/validasi/akun.ts`
- Create: `src/modules/akuntansi/repositori/akun.ts`
- Create: `src/modules/akuntansi/layanan/akun.ts`
- Create: `src/app/(app)/akuntansi/konfigurasi/bagan-akun/page.tsx`
- Create: `src/app/(app)/akuntansi/konfigurasi/bagan-akun/aksi.ts`
- Create: `src/app/(app)/akuntansi/konfigurasi/bagan-akun/dialog-akun.tsx`
- Test: `tests/akuntansi/akun.test.ts`

**Interfaces:**
- Consumes: `wajibIzin` dari Task 5; `Transaksi` dari Task 7
- Produces:
  - Tabel `accounts` dari `@/db/schema/akuntansi`
  - `class ValidasiError extends Error` dari `@/lib/galat` — dipakai seluruh layanan di Task 10 sampai 16
  - `const KELOMPOK_TIPE_AKUN` dan `labelTipeAkun(tipe): string` dari `@/modules/akuntansi/validasi/akun`
  - `skemaAkun` (Zod) dan `type MasukanAkun` dari modul yang sama
  - `buatAkun(masukan: MasukanAkun): Promise<Akun>`, `ubahAkun(id: string, masukan: MasukanAkun): Promise<Akun>`, `nonaktifkanAkun(id: string): Promise<void>`, `daftarAkun(): Promise<Akun[]>` dari `@/modules/akuntansi/layanan/akun`
  - `type Akun = typeof accounts.$inferSelect`
  - `<TabelData kolom={...} baris={...} />` dari `@/components/data/tabel-data`

- [ ] **Step 1: Tulis skema akun**

`src/db/schema/akuntansi.ts`:
```ts
import { pgTable, uuid, text, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { tipeAkunEnum } from './enum'
import { currencies } from './mata-uang'

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  tipeAkun: tipeAkunEnum('tipe_akun').notNull(),
  mataUangId: text('mata_uang_id').references(() => currencies.kode),
  dapatDirekonsiliasi: boolean('dapat_direkonsiliasi').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  catatan: text('catatan'),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('accounts_kode_unik').on(t.kode),
  index('accounts_tipe_idx').on(t.tipeAkun),
])
```

- [ ] **Step 2: Tambahkan kunci asing yang tertunda dari Task 7**

Ubah keempat kolom akun default di `src/db/schema/konfigurasi.ts` agar merujuk `accounts`. Tambahkan impor di bagian atas berkas:
```ts
import { accounts } from './akuntansi'
```

Lalu ganti keempat baris berikut di dalam `companySettings`:
```ts
  akunLabaDitahanId: uuid('akun_laba_ditahan_id').references(() => accounts.id),
  akunSelisihKursUntungId: uuid('akun_selisih_kurs_untung_id').references(() => accounts.id),
  akunSelisihKursRugiId: uuid('akun_selisih_kurs_rugi_id').references(() => accounts.id),
  akunPembulatanId: uuid('akun_pembulatan_id').references(() => accounts.id),
```

- [ ] **Step 3: Ekspor skema, hasilkan dan jalankan migrasi**

Tambahkan ke `src/db/schema/index.ts`:
```ts
export * from './akuntansi'
```

```bash
pnpm db:generate && pnpm db:migrate
```

Expected: migrasi baru memuat pembuatan tabel `accounts` dan empat constraint kunci asing pada `company_settings`.

- [ ] **Step 4: Tulis pengujian akun yang gagal**

`tests/akuntansi/akun.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { accounts } from '@/db/schema'
import { buatAkun, ubahAkun, nonaktifkanAkun, daftarAkun } from '@/modules/akuntansi/layanan/akun'
import { skemaAkun, labelTipeAkun, KELOMPOK_TIPE_AKUN } from '@/modules/akuntansi/validasi/akun'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

beforeEach(async () => { await bersihkanTabel(['accounts']) })
afterAll(async () => { await tutupKoneksi() })

const AKUN_KAS = {
  kode: '1101', nama: 'Kas', tipeAkun: 'aset_kas' as const,
  mataUangId: null, dapatDirekonsiliasi: false, catatan: null,
}

describe('validasi akun', () => {
  it('menerima masukan yang sah', () => {
    expect(skemaAkun.safeParse(AKUN_KAS).success).toBe(true)
  })

  it('menolak kode kosong', () => {
    const hasil = skemaAkun.safeParse({ ...AKUN_KAS, kode: '' })
    expect(hasil.success).toBe(false)
    expect(hasil.error!.issues[0].message).toBe('Kode akun wajib diisi')
  })

  it('menolak kode yang memuat spasi', () => {
    const hasil = skemaAkun.safeParse({ ...AKUN_KAS, kode: '11 01' })
    expect(hasil.success).toBe(false)
  })

  it('menolak nama kosong', () => {
    const hasil = skemaAkun.safeParse({ ...AKUN_KAS, nama: '   ' })
    expect(hasil.success).toBe(false)
    expect(hasil.error!.issues[0].message).toBe('Nama akun wajib diisi')
  })

  it('menolak tipe akun di luar daftar', () => {
    expect(skemaAkun.safeParse({ ...AKUN_KAS, tipeAkun: 'aset_ajaib' }).success).toBe(false)
  })

  it('memangkas spasi di awal dan akhir', () => {
    const hasil = skemaAkun.parse({ ...AKUN_KAS, kode: ' 1101 ', nama: ' Kas ' })
    expect(hasil.kode).toBe('1101')
    expect(hasil.nama).toBe('Kas')
  })
})

describe('label tipe akun', () => {
  it('memberi label berbahasa Indonesia untuk setiap tipe', () => {
    const semua = KELOMPOK_TIPE_AKUN.flatMap((k) => k.tipe)
    for (const tipe of semua) {
      expect(labelTipeAkun(tipe), `label hilang untuk ${tipe}`).toBeTruthy()
    }
  })

  it('mencakup seluruh dua puluh dua tipe akun', () => {
    expect(KELOMPOK_TIPE_AKUN.flatMap((k) => k.tipe)).toHaveLength(22)
  })

  it('mengelompokkan tipe ke dalam lima kelompok laporan', () => {
    expect(KELOMPOK_TIPE_AKUN.map((k) => k.label)).toEqual([
      'Aset', 'Liabilitas', 'Ekuitas', 'Pendapatan', 'Beban',
    ])
  })
})

describe('buatAkun', () => {
  it('menyimpan akun baru dalam keadaan aktif', async () => {
    const akun = await buatAkun(AKUN_KAS)
    expect(akun.kode).toBe('1101')
    expect(akun.isActive).toBe(true)
  })

  it('menolak kode yang sudah dipakai dengan pesan berbahasa Indonesia', async () => {
    await buatAkun(AKUN_KAS)
    await expect(buatAkun({ ...AKUN_KAS, nama: 'Kas Lain' }))
      .rejects.toThrow('Kode akun 1101 sudah digunakan')
  })

  it('menolak masukan yang tidak lolos validasi', async () => {
    await expect(buatAkun({ ...AKUN_KAS, kode: '' })).rejects.toThrow('Kode akun wajib diisi')
  })
})

describe('ubahAkun', () => {
  it('memperbarui nama dan tipe', async () => {
    const akun = await buatAkun(AKUN_KAS)
    const hasil = await ubahAkun(akun.id, { ...AKUN_KAS, nama: 'Kas Besar', tipeAkun: 'aset_bank' })
    expect(hasil.nama).toBe('Kas Besar')
    expect(hasil.tipeAkun).toBe('aset_bank')
  })

  it('mengizinkan penyimpanan ulang dengan kode yang sama', async () => {
    const akun = await buatAkun(AKUN_KAS)
    await expect(ubahAkun(akun.id, { ...AKUN_KAS, nama: 'Kas Kecil' })).resolves.toBeTruthy()
  })

  it('menolak kode yang sudah dipakai akun lain', async () => {
    await buatAkun(AKUN_KAS)
    const bank = await buatAkun({ ...AKUN_KAS, kode: '1102', nama: 'Bank', tipeAkun: 'aset_bank' })
    await expect(ubahAkun(bank.id, { ...AKUN_KAS, kode: '1101' }))
      .rejects.toThrow('Kode akun 1101 sudah digunakan')
  })

  it('menolak akun yang tidak ada', async () => {
    await expect(ubahAkun('00000000-0000-0000-0000-000000000000', AKUN_KAS))
      .rejects.toThrow('Akun tidak ditemukan')
  })

  it('memperbarui penanda waktu perubahan', async () => {
    const akun = await buatAkun(AKUN_KAS)
    const hasil = await ubahAkun(akun.id, { ...AKUN_KAS, nama: 'Kas Besar' })
    expect(hasil.diubahPada.getTime()).toBeGreaterThanOrEqual(akun.diubahPada.getTime())
  })
})

describe('nonaktifkanAkun', () => {
  it('menandai akun nonaktif alih-alih menghapusnya', async () => {
    const akun = await buatAkun(AKUN_KAS)
    await nonaktifkanAkun(akun.id)
    const [tersimpan] = await db.select().from(accounts).where(eq(accounts.id, akun.id))
    expect(tersimpan).toBeDefined()
    expect(tersimpan.isActive).toBe(false)
  })
})

describe('daftarAkun', () => {
  it('mengurutkan berdasarkan kode akun', async () => {
    await buatAkun({ ...AKUN_KAS, kode: '4101', nama: 'Penjualan', tipeAkun: 'pendapatan' })
    await buatAkun(AKUN_KAS)
    await buatAkun({ ...AKUN_KAS, kode: '1102', nama: 'Bank', tipeAkun: 'aset_bank' })
    const daftar = await daftarAkun()
    expect(daftar.map((a) => a.kode)).toEqual(['1101', '1102', '4101'])
  })

  it('tetap menyertakan akun nonaktif agar dapat diaktifkan kembali', async () => {
    const akun = await buatAkun(AKUN_KAS)
    await nonaktifkanAkun(akun.id)
    expect(await daftarAkun()).toHaveLength(1)
  })
})
```

- [ ] **Step 5: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/akuntansi/akun.test.ts`
Expected: GAGAL pada impor modul akun

- [ ] **Step 6: Tulis validasi akun**

`src/modules/akuntansi/validasi/akun.ts`:
```ts
import { z } from 'zod'

export const KELOMPOK_TIPE_AKUN = [
  {
    label: 'Aset',
    tipe: [
      'aset_kas', 'aset_bank', 'aset_piutang', 'aset_persediaan', 'aset_lancar_lain',
      'aset_tetap', 'aset_akumulasi_depresiasi', 'aset_tidak_lancar_lain',
    ],
  },
  {
    label: 'Liabilitas',
    tipe: [
      'liabilitas_utang_usaha', 'liabilitas_pajak',
      'liabilitas_jangka_pendek', 'liabilitas_jangka_panjang',
    ],
  },
  { label: 'Ekuitas', tipe: ['ekuitas', 'ekuitas_laba_ditahan', 'ekuitas_laba_berjalan'] },
  { label: 'Pendapatan', tipe: ['pendapatan', 'pendapatan_lain'] },
  {
    label: 'Beban',
    tipe: ['beban_hpp', 'beban_operasional', 'beban_depresiasi', 'beban_lain', 'beban_pajak'],
  },
] as const

const LABEL_TIPE: Record<string, string> = {
  aset_kas: 'Kas',
  aset_bank: 'Bank',
  aset_piutang: 'Piutang Usaha',
  aset_persediaan: 'Persediaan',
  aset_lancar_lain: 'Aset Lancar Lainnya',
  aset_tetap: 'Aset Tetap',
  aset_akumulasi_depresiasi: 'Akumulasi Depresiasi',
  aset_tidak_lancar_lain: 'Aset Tidak Lancar Lainnya',
  liabilitas_utang_usaha: 'Utang Usaha',
  liabilitas_pajak: 'Utang Pajak',
  liabilitas_jangka_pendek: 'Liabilitas Jangka Pendek',
  liabilitas_jangka_panjang: 'Liabilitas Jangka Panjang',
  ekuitas: 'Modal',
  ekuitas_laba_ditahan: 'Laba Ditahan',
  ekuitas_laba_berjalan: 'Laba Tahun Berjalan',
  pendapatan: 'Pendapatan',
  pendapatan_lain: 'Pendapatan Lain-lain',
  beban_hpp: 'Harga Pokok Penjualan',
  beban_operasional: 'Beban Operasional',
  beban_depresiasi: 'Beban Depresiasi',
  beban_lain: 'Beban Lain-lain',
  beban_pajak: 'Beban Pajak Penghasilan',
}

const SEMUA_TIPE = KELOMPOK_TIPE_AKUN.flatMap((k) => k.tipe)

export function labelTipeAkun(tipe: string): string {
  return LABEL_TIPE[tipe] ?? tipe
}

export const skemaAkun = z.object({
  kode: z.string().trim()
    .min(1, 'Kode akun wajib diisi')
    .max(20, 'Kode akun maksimal 20 karakter')
    .regex(/^\S+$/, 'Kode akun tidak boleh memuat spasi'),
  nama: z.string().trim()
    .min(1, 'Nama akun wajib diisi')
    .max(120, 'Nama akun maksimal 120 karakter'),
  tipeAkun: z.enum(SEMUA_TIPE as unknown as [string, ...string[]], {
    message: 'Tipe akun tidak dikenali',
  }),
  mataUangId: z.string().trim().length(3).nullable().default(null),
  dapatDirekonsiliasi: z.boolean().default(false),
  catatan: z.string().trim().max(500).nullable().default(null),
})

export type MasukanAkun = z.input<typeof skemaAkun>
export type AkunTervalidasi = z.output<typeof skemaAkun>
```

- [ ] **Step 7: Tulis repositori akun**

`src/modules/akuntansi/repositori/akun.ts`:
```ts
import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '@/db/klien'
import { accounts } from '@/db/schema'

export type Akun = typeof accounts.$inferSelect
export type AkunBaru = typeof accounts.$inferInsert

export async function ambilSemuaAkun(): Promise<Akun[]> {
  return db.select().from(accounts).orderBy(asc(accounts.kode))
}

export async function ambilAkunLewatId(id: string): Promise<Akun | null> {
  const [akun] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1)
  return akun ?? null
}

export async function kodeAkunTerpakai(kode: string, kecualiId?: string): Promise<boolean> {
  const syarat = kecualiId
    ? and(eq(accounts.kode, kode), ne(accounts.id, kecualiId))
    : eq(accounts.kode, kode)
  const [ada] = await db.select({ id: accounts.id }).from(accounts).where(syarat).limit(1)
  return Boolean(ada)
}

export async function sisipkanAkun(nilai: AkunBaru): Promise<Akun> {
  const [akun] = await db.insert(accounts).values(nilai).returning()
  return akun
}

export async function perbaruiAkun(id: string, nilai: Partial<AkunBaru>): Promise<Akun> {
  const [akun] = await db.update(accounts)
    .set({ ...nilai, diubahPada: new Date() })
    .where(eq(accounts.id, id))
    .returning()
  return akun
}
```

- [ ] **Step 8: Tulis kelas galat bersama dan layanan akun**

`ValidasiError` ditempatkan di `src/lib/` dan bukan di dalam modul akuntansi karena modul identitas juga memakainya pada Task 16; menaruhnya di salah satu modul akan memaksa modul lain mengimpor lintas batas.

`src/lib/galat.ts`:
```ts
/** Galat aturan bisnis yang pesannya aman ditampilkan langsung ke pengguna. */
export class ValidasiError extends Error {
  constructor(pesan: string) {
    super(pesan)
    this.name = 'ValidasiError'
  }
}
```

`src/modules/akuntansi/layanan/akun.ts`:
```ts
import { ValidasiError } from '@/lib/galat'
import { skemaAkun, type MasukanAkun } from '../validasi/akun'
import * as repo from '../repositori/akun'
import type { Akun } from '../repositori/akun'

export type { Akun }

function urai(masukan: MasukanAkun) {
  const hasil = skemaAkun.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

export async function daftarAkun(): Promise<Akun[]> {
  return repo.ambilSemuaAkun()
}

export async function buatAkun(masukan: MasukanAkun): Promise<Akun> {
  const data = urai(masukan)
  if (await repo.kodeAkunTerpakai(data.kode)) {
    throw new ValidasiError(`Kode akun ${data.kode} sudah digunakan`)
  }
  return repo.sisipkanAkun(data)
}

export async function ubahAkun(id: string, masukan: MasukanAkun): Promise<Akun> {
  const data = urai(masukan)
  const akun = await repo.ambilAkunLewatId(id)
  if (!akun) throw new ValidasiError('Akun tidak ditemukan')
  if (await repo.kodeAkunTerpakai(data.kode, id)) {
    throw new ValidasiError(`Kode akun ${data.kode} sudah digunakan`)
  }
  return repo.perbaruiAkun(id, data)
}

/**
 * Akun tidak pernah dihapus karena dapat sudah dirujuk item jurnal.
 * Menonaktifkan menyembunyikannya dari pilihan tanpa merusak riwayat.
 */
export async function nonaktifkanAkun(id: string): Promise<void> {
  const akun = await repo.ambilAkunLewatId(id)
  if (!akun) throw new ValidasiError('Akun tidak ditemukan')
  await repo.perbaruiAkun(id, { isActive: false })
}

export async function aktifkanAkun(id: string): Promise<void> {
  const akun = await repo.ambilAkunLewatId(id)
  if (!akun) throw new ValidasiError('Akun tidak ditemukan')
  await repo.perbaruiAkun(id, { isActive: true })
}
```

- [ ] **Step 9: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/akuntansi/akun.test.ts`
Expected: SELURUH pengujian LULUS

- [ ] **Step 10: Tulis komponen tabel generik dan kepala halaman**

`src/components/data/tabel-data.tsx`:
```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type Kolom<T> = {
  kunci: string
  judul: string
  render: (baris: T) => React.ReactNode
  rataKanan?: boolean
  lebar?: string
}

export function TabelData<T>({
  kolom, baris, kunciBaris, pesanKosong = 'Belum ada data.',
}: {
  kolom: Kolom<T>[]
  baris: T[]
  kunciBaris: (baris: T) => string
  pesanKosong?: string
}) {
  if (baris.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        {pesanKosong}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {kolom.map((k) => (
              <TableHead key={k.kunci} className={cn(k.rataKanan && 'text-right')} style={{ width: k.lebar }}>
                {k.judul}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {baris.map((b) => (
            <TableRow key={kunciBaris(b)}>
              {kolom.map((k) => (
                <TableCell key={k.kunci} className={cn(k.rataKanan && 'text-right tabular-nums')}>
                  {k.render(b)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

`src/components/data/kepala-halaman.tsx`:
```tsx
export function KepalaHalaman({
  judul, deskripsi, aksi,
}: {
  judul: string
  deskripsi?: string
  aksi?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{judul}</h1>
        {deskripsi && <p className="mt-1 text-sm text-muted-foreground">{deskripsi}</p>}
      </div>
      {aksi}
    </div>
  )
}
```

- [ ] **Step 11: Tulis Server Action**

`src/app/(app)/akuntansi/konfigurasi/bagan-akun/aksi.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { buatAkun, ubahAkun, nonaktifkanAkun, aktifkanAkun } from '@/modules/akuntansi/layanan/akun'
import type { MasukanAkun } from '@/modules/akuntansi/validasi/akun'

const IZIN = 'akuntansi.coa.kelola'
const RUTE = '/akuntansi/konfigurasi/bagan-akun'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  const pesan = galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga'
  return { berhasil: false, pesan }
}

export async function aksiSimpanAkun(id: string | null, masukan: MasukanAkun): Promise<HasilAksi> {
  await wajibIzin(IZIN)
  try {
    if (id) await ubahAkun(id, masukan)
    else await buatAkun(masukan)
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusAkun(id: string, aktif: boolean): Promise<HasilAksi> {
  await wajibIzin(IZIN)
  try {
    if (aktif) await aktifkanAkun(id)
    else await nonaktifkanAkun(id)
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
```

- [ ] **Step 12: Tulis dialog formulir**

`src/app/(app)/akuntansi/konfigurasi/bagan-akun/dialog-akun.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { KELOMPOK_TIPE_AKUN, labelTipeAkun } from '@/modules/akuntansi/validasi/akun'
import type { Akun } from '@/modules/akuntansi/layanan/akun'
import { aksiSimpanAkun } from './aksi'

export function DialogAkun({ akun, pemicu }: { akun?: Akun; pemicu: React.ReactNode }) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanAkun(akun?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        tipeAkun: String(data.get('tipeAkun') ?? ''),
        mataUangId: null,
        dapatDirekonsiliasi: data.get('dapatDirekonsiliasi') === 'on',
        catatan: String(data.get('catatan') ?? '') || null,
      })
      if (hasil.berhasil) {
        toast.success(akun ? 'Akun berhasil diperbarui' : 'Akun berhasil dibuat')
        setTerbuka(false)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>{pemicu}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{akun ? 'Ubah Akun' : 'Tambah Akun'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kode">Kode Akun</Label>
            <Input id="kode" name="kode" defaultValue={akun?.kode} required placeholder="1101" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nama">Nama Akun</Label>
            <Input id="nama" name="nama" defaultValue={akun?.nama} required placeholder="Kas" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipeAkun">Tipe Akun</Label>
            <Select name="tipeAkun" defaultValue={akun?.tipeAkun} required>
              <SelectTrigger id="tipeAkun">
                <SelectValue placeholder="Pilih tipe akun" />
              </SelectTrigger>
              <SelectContent>
                {KELOMPOK_TIPE_AKUN.map((kelompok) => (
                  <SelectGroup key={kelompok.label}>
                    <SelectLabel>{kelompok.label}</SelectLabel>
                    {kelompok.tipe.map((tipe) => (
                      <SelectItem key={tipe} value={tipe}>{labelTipeAkun(tipe)}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Tipe akun menentukan baris tempat akun ini muncul di laporan keuangan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="dapatDirekonsiliasi"
              name="dapatDirekonsiliasi"
              defaultChecked={akun?.dapatDirekonsiliasi}
            />
            <Label htmlFor="dapatDirekonsiliasi" className="font-normal">
              Dapat direkonsiliasi
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="catatan">Catatan</Label>
            <Textarea id="catatan" name="catatan" defaultValue={akun?.catatan ?? ''} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 13: Tulis halaman Bagan Akun**

`src/app/(app)/akuntansi/konfigurasi/bagan-akun/page.tsx`:
```tsx
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarAkun, type Akun } from '@/modules/akuntansi/layanan/akun'
import { labelTipeAkun } from '@/modules/akuntansi/validasi/akun'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogAkun } from './dialog-akun'

export const metadata = { title: 'Bagan Akun' }

const kolom: Kolom<Akun>[] = [
  { kunci: 'kode', judul: 'Kode', lebar: '120px', render: (a) => <span className="font-mono">{a.kode}</span> },
  { kunci: 'nama', judul: 'Nama Akun', render: (a) => a.nama },
  { kunci: 'tipe', judul: 'Tipe Akun', render: (a) => labelTipeAkun(a.tipeAkun) },
  {
    kunci: 'rekonsiliasi', judul: 'Rekonsiliasi', lebar: '120px',
    render: (a) => (a.dapatDirekonsiliasi ? 'Ya' : '—'),
  },
  {
    kunci: 'status', judul: 'Status', lebar: '100px',
    render: (a) => (
      <Badge variant={a.isActive ? 'secondary' : 'outline'}>
        {a.isActive ? 'Aktif' : 'Nonaktif'}
      </Badge>
    ),
  },
  {
    kunci: 'aksi', judul: '', lebar: '80px', rataKanan: true,
    render: (a) => (
      <DialogAkun akun={a} pemicu={<Button variant="ghost" size="sm">Ubah</Button>} />
    ),
  },
]

export default async function HalamanBaganAkun() {
  await wajibIzin('akuntansi.coa.kelola')
  const akun = await daftarAkun()

  return (
    <>
      <KepalaHalaman
        judul="Bagan Akun"
        deskripsi="Tipe akun menentukan penempatan setiap akun pada Laba Rugi dan Neraca."
        aksi={
          <DialogAkun
            pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Akun</Button>}
          />
        }
      />
      <TabelData
        kolom={kolom}
        baris={akun}
        kunciBaris={(a) => a.id}
        pesanKosong="Belum ada akun. Jalankan seed data awal atau tambahkan akun secara manual."
      />
    </>
  )
}
```

- [ ] **Step 14: Jalankan seluruh pengujian, periksa tipe, dan bangun**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: seluruhnya berhasil

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat(akuntansi): bagan akun beserta pola CRUD yang dipakai ulang

Menambahkan tabel accounts dengan dua puluh dua tipe akun yang menjadi dasar
seluruh pelaporan, beserta susunan validasi-repositori-layanan dan komponen
tabel generik yang dipakai ulang oleh master data berikutnya. Akun
dinonaktifkan alih-alih dihapus karena dapat sudah dirujuk item jurnal."
```

---

## Task 10: Mitra Usaha

**Files:**
- Modify: `src/db/schema/akuntansi.ts` (tambah `paymentTerms` dan `partners`)
- Create: `src/modules/akuntansi/validasi/partner.ts`
- Create: `src/modules/akuntansi/repositori/partner.ts`
- Create: `src/modules/akuntansi/layanan/partner.ts`
- Create: `src/app/(app)/kontak/page.tsx`, `src/app/(app)/kontak/pelanggan/page.tsx`, `src/app/(app)/kontak/pemasok/page.tsx`
- Create: `src/app/(app)/kontak/daftar-kontak.tsx`, `src/app/(app)/kontak/aksi.ts`, `src/app/(app)/kontak/dialog-partner.tsx`
- Test: `tests/akuntansi/partner.test.ts`

**Interfaces:**
- Consumes: `TabelData`, `Kolom`, `KepalaHalaman` dari Task 9; `ValidasiError` dari `@/modules/akuntansi/layanan/akun`; `wajibIzin` dari Task 5
- Produces:
  - Tabel `partners`, `paymentTerms` dari `@/db/schema/akuntansi`
  - `normalkanNpwp(teks: string): string` dan `skemaPartner` dari `@/modules/akuntansi/validasi/partner`
  - `buatPartner`, `ubahPartner`, `nonaktifkanPartner`, `aktifkanPartner`, `daftarPartner(saring?: SaringPartner)` dari `@/modules/akuntansi/layanan/partner`
  - `type Partner = typeof partners.$inferSelect`
  - `type SaringPartner = { peran?: 'pelanggan' | 'pemasok' }`

- [ ] **Step 1: Tambahkan skema syarat pembayaran dan mitra usaha**

Tambahkan ke `src/db/schema/akuntansi.ts` (impor `integer` dan `tipePartnerEnum` di bagian atas berkas):
```ts
import { pgTable, uuid, text, boolean, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { tipeAkunEnum, tipePartnerEnum } from './enum'
import { currencies } from './mata-uang'

export const paymentTerms = pgTable('payment_terms', {
  id: uuid('id').primaryKey().defaultRandom(),
  nama: text('nama').notNull(),
  jumlahHari: integer('jumlah_hari').notNull().default(0),
  catatan: text('catatan'),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [uniqueIndex('payment_terms_nama_unik').on(t.nama)])

export const partners = pgTable('partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  tipe: tipePartnerEnum('tipe').notNull().default('badan'),
  isPelanggan: boolean('is_pelanggan').notNull().default(false),
  isPemasok: boolean('is_pemasok').notNull().default(false),
  npwp: text('npwp'),
  nik: text('nik'),
  alamat: text('alamat'),
  kota: text('kota'),
  provinsi: text('provinsi'),
  kodePos: text('kode_pos'),
  telepon: text('telepon'),
  email: text('email'),
  kontakPerson: text('kontak_person'),
  syaratPembayaranId: uuid('syarat_pembayaran_id').references(() => paymentTerms.id),
  akunPiutangId: uuid('akun_piutang_id').references(() => accounts.id),
  akunUtangId: uuid('akun_utang_id').references(() => accounts.id),
  isActive: boolean('is_active').notNull().default(true),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('partners_kode_unik').on(t.kode),
  index('partners_pelanggan_idx').on(t.isPelanggan),
  index('partners_pemasok_idx').on(t.isPemasok),
])
```

Definisi `accounts` dari Task 9 tetap berada di berkas yang sama dan harus dideklarasikan sebelum `partners` agar rujukan `accounts.id` sah.

- [ ] **Step 2: Hasilkan dan jalankan migrasi**

```bash
pnpm db:generate && pnpm db:migrate
```

- [ ] **Step 3: Tulis pengujian mitra usaha yang gagal**

`tests/akuntansi/partner.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { partners } from '@/db/schema'
import {
  buatPartner, ubahPartner, nonaktifkanPartner, daftarPartner,
} from '@/modules/akuntansi/layanan/partner'
import { skemaPartner, normalkanNpwp } from '@/modules/akuntansi/validasi/partner'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

beforeEach(async () => { await bersihkanTabel(['partners', 'payment_terms']) })
afterAll(async () => { await tutupKoneksi() })

const PELANGGAN = {
  kode: 'CUST-001', nama: 'PT Mebel Sejahtera', tipe: 'badan' as const,
  isPelanggan: true, isPemasok: false,
  npwp: '01.234.567.8-901.000', nik: null,
  alamat: 'Jl. Industri No. 12', kota: 'Jepara', provinsi: 'Jawa Tengah', kodePos: '59411',
  telepon: '0291-123456', email: 'kontak@mebelsejahtera.co.id', kontakPerson: 'Budi',
  syaratPembayaranId: null, akunPiutangId: null, akunUtangId: null,
}

describe('normalkanNpwp', () => {
  it('membuang titik, strip, dan spasi', () => {
    expect(normalkanNpwp('01.234.567.8-901.000')).toBe('012345678901000')
  })

  it('membiarkan angka polos apa adanya', () => {
    expect(normalkanNpwp('012345678901000')).toBe('012345678901000')
  })

  it('mengembalikan teks kosong untuk masukan kosong', () => {
    expect(normalkanNpwp('')).toBe('')
  })
})

describe('validasi mitra usaha', () => {
  it('menerima masukan yang sah', () => {
    expect(skemaPartner.safeParse(PELANGGAN).success).toBe(true)
  })

  it('menyimpan NPWP dalam bentuk angka saja', () => {
    expect(skemaPartner.parse(PELANGGAN).npwp).toBe('012345678901000')
  })

  it('menerima NPWP enam belas digit', () => {
    const hasil = skemaPartner.safeParse({ ...PELANGGAN, npwp: '0123456789012345' })
    expect(hasil.success).toBe(true)
  })

  it('menolak NPWP yang panjangnya bukan lima belas atau enam belas digit', () => {
    const hasil = skemaPartner.safeParse({ ...PELANGGAN, npwp: '12345' })
    expect(hasil.success).toBe(false)
    expect(hasil.error!.issues[0].message).toBe('NPWP harus 15 atau 16 digit')
  })

  it('menerima NPWP kosong karena tidak semua mitra ber-NPWP', () => {
    expect(skemaPartner.safeParse({ ...PELANGGAN, npwp: '' }).success).toBe(true)
    expect(skemaPartner.parse({ ...PELANGGAN, npwp: '' }).npwp).toBeNull()
  })

  it('menolak NIK yang bukan enam belas digit', () => {
    const hasil = skemaPartner.safeParse({ ...PELANGGAN, tipe: 'perorangan', nik: '123' })
    expect(hasil.success).toBe(false)
    expect(hasil.error!.issues[0].message).toBe('NIK harus 16 digit')
  })

  it('menolak email yang tidak sah', () => {
    const hasil = skemaPartner.safeParse({ ...PELANGGAN, email: 'bukan-email' })
    expect(hasil.success).toBe(false)
    expect(hasil.error!.issues[0].message).toBe('Format email tidak sah')
  })

  it('menerima email kosong', () => {
    expect(skemaPartner.safeParse({ ...PELANGGAN, email: '' }).success).toBe(true)
  })

  it('menolak mitra yang bukan pelanggan maupun pemasok', () => {
    const hasil = skemaPartner.safeParse({ ...PELANGGAN, isPelanggan: false, isPemasok: false })
    expect(hasil.success).toBe(false)
    expect(hasil.error!.issues[0].message).toBe('Mitra harus ditandai sebagai pelanggan, pemasok, atau keduanya')
  })

  it('menerima mitra yang sekaligus pelanggan dan pemasok', () => {
    expect(skemaPartner.safeParse({ ...PELANGGAN, isPemasok: true }).success).toBe(true)
  })
})

describe('buatPartner', () => {
  it('menyimpan mitra baru', async () => {
    const mitra = await buatPartner(PELANGGAN)
    expect(mitra.kode).toBe('CUST-001')
    expect(mitra.isActive).toBe(true)
  })

  it('menolak kode ganda', async () => {
    await buatPartner(PELANGGAN)
    await expect(buatPartner({ ...PELANGGAN, nama: 'Lain' }))
      .rejects.toThrow('Kode mitra CUST-001 sudah digunakan')
  })
})

describe('ubahPartner', () => {
  it('memperbarui data mitra', async () => {
    const mitra = await buatPartner(PELANGGAN)
    const hasil = await ubahPartner(mitra.id, { ...PELANGGAN, kota: 'Semarang' })
    expect(hasil.kota).toBe('Semarang')
  })

  it('menolak kode milik mitra lain', async () => {
    await buatPartner(PELANGGAN)
    const lain = await buatPartner({ ...PELANGGAN, kode: 'CUST-002', nama: 'CV Kayu Jati' })
    await expect(ubahPartner(lain.id, { ...PELANGGAN, kode: 'CUST-001' }))
      .rejects.toThrow('Kode mitra CUST-001 sudah digunakan')
  })

  it('menolak mitra yang tidak ada', async () => {
    await expect(ubahPartner('00000000-0000-0000-0000-000000000000', PELANGGAN))
      .rejects.toThrow('Mitra tidak ditemukan')
  })
})

describe('daftarPartner', () => {
  beforeEach(async () => {
    await buatPartner(PELANGGAN)
    await buatPartner({
      ...PELANGGAN, kode: 'SUPP-001', nama: 'UD Kayu Nusantara',
      isPelanggan: false, isPemasok: true,
    })
    await buatPartner({
      ...PELANGGAN, kode: 'BOTH-001', nama: 'PT Dwifungsi',
      isPelanggan: true, isPemasok: true,
    })
  })

  it('mengembalikan seluruh mitra tanpa penyaringan', async () => {
    expect(await daftarPartner()).toHaveLength(3)
  })

  it('menyaring hanya pelanggan', async () => {
    const hasil = await daftarPartner({ peran: 'pelanggan' })
    expect(hasil.map((m) => m.kode).sort()).toEqual(['BOTH-001', 'CUST-001'])
  })

  it('menyaring hanya pemasok', async () => {
    const hasil = await daftarPartner({ peran: 'pemasok' })
    expect(hasil.map((m) => m.kode).sort()).toEqual(['BOTH-001', 'SUPP-001'])
  })

  it('mengurutkan berdasarkan nama', async () => {
    const hasil = await daftarPartner()
    expect(hasil.map((m) => m.nama)).toEqual([
      'PT Dwifungsi', 'PT Mebel Sejahtera', 'UD Kayu Nusantara',
    ])
  })
})

describe('nonaktifkanPartner', () => {
  it('menandai nonaktif alih-alih menghapus', async () => {
    const mitra = await buatPartner(PELANGGAN)
    await nonaktifkanPartner(mitra.id)
    const [tersimpan] = await db.select().from(partners).where(eq(partners.id, mitra.id))
    expect(tersimpan.isActive).toBe(false)
  })
})
```

- [ ] **Step 4: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/akuntansi/partner.test.ts`
Expected: GAGAL pada impor modul partner

- [ ] **Step 5: Tulis validasi mitra usaha**

`src/modules/akuntansi/validasi/partner.ts`:
```ts
import { z } from 'zod'

/** Membuang titik, strip, dan spasi dari NPWP agar tersimpan sebagai angka saja. */
export function normalkanNpwp(teks: string): string {
  return teks.replace(/[^0-9]/g, '')
}

const teksOpsional = z.string().trim().max(200).nullable().default(null)
  .transform((v) => (v === '' ? null : v))

export const skemaPartner = z.object({
  kode: z.string().trim()
    .min(1, 'Kode mitra wajib diisi')
    .max(20, 'Kode mitra maksimal 20 karakter'),
  nama: z.string().trim()
    .min(1, 'Nama mitra wajib diisi')
    .max(150, 'Nama mitra maksimal 150 karakter'),
  tipe: z.enum(['perorangan', 'badan'], { message: 'Tipe mitra tidak dikenali' }),
  isPelanggan: z.boolean().default(false),
  isPemasok: z.boolean().default(false),
  npwp: z.string().nullable().default(null)
    .transform((v) => (v ? normalkanNpwp(v) : null))
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || v.length === 15 || v.length === 16, {
      message: 'NPWP harus 15 atau 16 digit',
    }),
  nik: z.string().nullable().default(null)
    .transform((v) => (v ? v.replace(/[^0-9]/g, '') : null))
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || v.length === 16, { message: 'NIK harus 16 digit' }),
  alamat: teksOpsional,
  kota: teksOpsional,
  provinsi: teksOpsional,
  kodePos: teksOpsional,
  telepon: teksOpsional,
  email: z.string().trim().nullable().default(null)
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || z.string().email().safeParse(v).success, {
      message: 'Format email tidak sah',
    }),
  kontakPerson: teksOpsional,
  syaratPembayaranId: z.string().uuid().nullable().default(null),
  akunPiutangId: z.string().uuid().nullable().default(null),
  akunUtangId: z.string().uuid().nullable().default(null),
}).refine((d) => d.isPelanggan || d.isPemasok, {
  message: 'Mitra harus ditandai sebagai pelanggan, pemasok, atau keduanya',
  path: ['isPelanggan'],
})

export type MasukanPartner = z.input<typeof skemaPartner>
```

NPWP disimpan sebagai angka saja, bukan dengan format bertitik. Menyimpan bentuk terformat akan membuat pencarian dan pencocokan dengan data pajak menjadi tidak dapat diandalkan; pemformatan adalah urusan tampilan.

- [ ] **Step 6: Tulis repositori dan layanan mitra usaha**

`src/modules/akuntansi/repositori/partner.ts`:
```ts
import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '@/db/klien'
import { partners } from '@/db/schema'

export type Partner = typeof partners.$inferSelect
export type PartnerBaru = typeof partners.$inferInsert
export type SaringPartner = { peran?: 'pelanggan' | 'pemasok' }

export async function ambilSemuaPartner(saring: SaringPartner = {}): Promise<Partner[]> {
  const syarat =
    saring.peran === 'pelanggan' ? eq(partners.isPelanggan, true)
    : saring.peran === 'pemasok' ? eq(partners.isPemasok, true)
    : undefined

  const kueri = db.select().from(partners).orderBy(asc(partners.nama))
  return syarat ? kueri.where(syarat) : kueri
}

export async function ambilPartnerLewatId(id: string): Promise<Partner | null> {
  const [mitra] = await db.select().from(partners).where(eq(partners.id, id)).limit(1)
  return mitra ?? null
}

export async function kodePartnerTerpakai(kode: string, kecualiId?: string): Promise<boolean> {
  const syarat = kecualiId
    ? and(eq(partners.kode, kode), ne(partners.id, kecualiId))
    : eq(partners.kode, kode)
  const [ada] = await db.select({ id: partners.id }).from(partners).where(syarat).limit(1)
  return Boolean(ada)
}

export async function sisipkanPartner(nilai: PartnerBaru): Promise<Partner> {
  const [mitra] = await db.insert(partners).values(nilai).returning()
  return mitra
}

export async function perbaruiPartner(id: string, nilai: Partial<PartnerBaru>): Promise<Partner> {
  const [mitra] = await db.update(partners)
    .set({ ...nilai, diubahPada: new Date() })
    .where(eq(partners.id, id))
    .returning()
  return mitra
}
```

`src/modules/akuntansi/layanan/partner.ts`:
```ts
import { skemaPartner, type MasukanPartner } from '../validasi/partner'
import * as repo from '../repositori/partner'
import type { Partner, SaringPartner } from '../repositori/partner'
import { ValidasiError } from '@/lib/galat'

export type { Partner, SaringPartner }

function urai(masukan: MasukanPartner) {
  const hasil = skemaPartner.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

export async function daftarPartner(saring: SaringPartner = {}): Promise<Partner[]> {
  return repo.ambilSemuaPartner(saring)
}

export async function buatPartner(masukan: MasukanPartner): Promise<Partner> {
  const data = urai(masukan)
  if (await repo.kodePartnerTerpakai(data.kode)) {
    throw new ValidasiError(`Kode mitra ${data.kode} sudah digunakan`)
  }
  return repo.sisipkanPartner(data)
}

export async function ubahPartner(id: string, masukan: MasukanPartner): Promise<Partner> {
  const data = urai(masukan)
  const mitra = await repo.ambilPartnerLewatId(id)
  if (!mitra) throw new ValidasiError('Mitra tidak ditemukan')
  if (await repo.kodePartnerTerpakai(data.kode, id)) {
    throw new ValidasiError(`Kode mitra ${data.kode} sudah digunakan`)
  }
  return repo.perbaruiPartner(id, data)
}

export async function nonaktifkanPartner(id: string): Promise<void> {
  const mitra = await repo.ambilPartnerLewatId(id)
  if (!mitra) throw new ValidasiError('Mitra tidak ditemukan')
  await repo.perbaruiPartner(id, { isActive: false })
}

export async function aktifkanPartner(id: string): Promise<void> {
  const mitra = await repo.ambilPartnerLewatId(id)
  if (!mitra) throw new ValidasiError('Mitra tidak ditemukan')
  await repo.perbaruiPartner(id, { isActive: true })
}
```

- [ ] **Step 7: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/akuntansi/partner.test.ts`
Expected: SELURUH pengujian LULUS

- [ ] **Step 8: Tulis Server Action mitra usaha**

`src/app/(app)/kontak/aksi.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  buatPartner, ubahPartner, nonaktifkanPartner, aktifkanPartner,
} from '@/modules/akuntansi/layanan/partner'
import type { MasukanPartner } from '@/modules/akuntansi/validasi/partner'

const IZIN = 'kontak.partner.lihat'
const RUTE = ['/kontak', '/kontak/pelanggan', '/kontak/pemasok']

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function segarkan() {
  for (const rute of RUTE) revalidatePath(rute)
}

function keHasil(galat: unknown): HasilAksi {
  const pesan = galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga'
  return { berhasil: false, pesan }
}

export async function aksiSimpanPartner(id: string | null, masukan: MasukanPartner): Promise<HasilAksi> {
  await wajibIzin(IZIN)
  try {
    if (id) await ubahPartner(id, masukan)
    else await buatPartner(masukan)
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusPartner(id: string, aktif: boolean): Promise<HasilAksi> {
  await wajibIzin(IZIN)
  try {
    if (aktif) await aktifkanPartner(id)
    else await nonaktifkanPartner(id)
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
```

- [ ] **Step 9: Tulis dialog mitra usaha**

`src/app/(app)/kontak/dialog-partner.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Partner } from '@/modules/akuntansi/layanan/partner'
import { aksiSimpanPartner } from './aksi'

export function DialogPartner({
  partner, pemicu, peranAwal,
}: {
  partner?: Partner
  pemicu: React.ReactNode
  peranAwal?: 'pelanggan' | 'pemasok'
}) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanPartner(partner?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        tipe: String(data.get('tipe') ?? 'badan') as 'perorangan' | 'badan',
        isPelanggan: data.get('isPelanggan') === 'on',
        isPemasok: data.get('isPemasok') === 'on',
        npwp: String(data.get('npwp') ?? '') || null,
        nik: String(data.get('nik') ?? '') || null,
        alamat: String(data.get('alamat') ?? '') || null,
        kota: String(data.get('kota') ?? '') || null,
        provinsi: String(data.get('provinsi') ?? '') || null,
        kodePos: String(data.get('kodePos') ?? '') || null,
        telepon: String(data.get('telepon') ?? '') || null,
        email: String(data.get('email') ?? '') || null,
        kontakPerson: String(data.get('kontakPerson') ?? '') || null,
        syaratPembayaranId: null,
        akunPiutangId: null,
        akunUtangId: null,
      })
      if (hasil.berhasil) {
        toast.success(partner ? 'Mitra berhasil diperbarui' : 'Mitra berhasil dibuat')
        setTerbuka(false)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>{pemicu}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{partner ? 'Ubah Mitra Usaha' : 'Tambah Mitra Usaha'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="kode">Kode</Label>
            <Input id="kode" name="kode" defaultValue={partner?.kode} required placeholder="CUST-001" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipe">Tipe</Label>
            <Select name="tipe" defaultValue={partner?.tipe ?? 'badan'}>
              <SelectTrigger id="tipe"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="badan">Badan Usaha</SelectItem>
                <SelectItem value="perorangan">Perorangan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" defaultValue={partner?.nama} required />
          </div>

          <div className="flex items-center gap-6 sm:col-span-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="isPelanggan" name="isPelanggan"
                defaultChecked={partner?.isPelanggan ?? peranAwal === 'pelanggan'}
              />
              <Label htmlFor="isPelanggan" className="font-normal">Pelanggan</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isPemasok" name="isPemasok"
                defaultChecked={partner?.isPemasok ?? peranAwal === 'pemasok'}
              />
              <Label htmlFor="isPemasok" className="font-normal">Pemasok</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="npwp">NPWP</Label>
            <Input id="npwp" name="npwp" defaultValue={partner?.npwp ?? ''} placeholder="01.234.567.8-901.000" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nik">NIK</Label>
            <Input id="nik" name="nik" defaultValue={partner?.nik ?? ''} placeholder="16 digit" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="alamat">Alamat</Label>
            <Input id="alamat" name="alamat" defaultValue={partner?.alamat ?? ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kota">Kota</Label>
            <Input id="kota" name="kota" defaultValue={partner?.kota ?? ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provinsi">Provinsi</Label>
            <Input id="provinsi" name="provinsi" defaultValue={partner?.provinsi ?? ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kodePos">Kode Pos</Label>
            <Input id="kodePos" name="kodePos" defaultValue={partner?.kodePos ?? ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telepon">Telepon</Label>
            <Input id="telepon" name="telepon" defaultValue={partner?.telepon ?? ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={partner?.email ?? ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kontakPerson">Kontak Person</Label>
            <Input id="kontakPerson" name="kontakPerson" defaultValue={partner?.kontakPerson ?? ''} />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 10: Tulis komponen daftar dan tiga halaman**

`src/app/(app)/kontak/daftar-kontak.tsx`:
```tsx
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarPartner, type Partner } from '@/modules/akuntansi/layanan/partner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogPartner } from './dialog-partner'

function formatNpwp(npwp: string | null): string {
  if (!npwp) return '—'
  if (npwp.length !== 15) return npwp
  return `${npwp.slice(0, 2)}.${npwp.slice(2, 5)}.${npwp.slice(5, 8)}.${npwp.slice(8, 9)}-${npwp.slice(9, 12)}.${npwp.slice(12)}`
}

const kolom: Kolom<Partner>[] = [
  { kunci: 'kode', judul: 'Kode', lebar: '130px', render: (m) => <span className="font-mono text-sm">{m.kode}</span> },
  { kunci: 'nama', judul: 'Nama', render: (m) => m.nama },
  {
    kunci: 'peran', judul: 'Peran', lebar: '170px',
    render: (m) => (
      <span className="flex gap-1">
        {m.isPelanggan && <Badge variant="secondary">Pelanggan</Badge>}
        {m.isPemasok && <Badge variant="secondary">Pemasok</Badge>}
      </span>
    ),
  },
  { kunci: 'npwp', judul: 'NPWP', lebar: '190px', render: (m) => <span className="font-mono text-sm">{formatNpwp(m.npwp)}</span> },
  { kunci: 'kota', judul: 'Kota', render: (m) => m.kota ?? '—' },
  {
    kunci: 'status', judul: 'Status', lebar: '100px',
    render: (m) => (
      <Badge variant={m.isActive ? 'secondary' : 'outline'}>
        {m.isActive ? 'Aktif' : 'Nonaktif'}
      </Badge>
    ),
  },
  {
    kunci: 'aksi', judul: '', lebar: '80px', rataKanan: true,
    render: (m) => <DialogPartner partner={m} pemicu={<Button variant="ghost" size="sm">Ubah</Button>} />,
  },
]

export async function DaftarKontak({
  judul, deskripsi, peran,
}: {
  judul: string
  deskripsi: string
  peran?: 'pelanggan' | 'pemasok'
}) {
  await wajibIzin('kontak.partner.lihat')
  const mitra = await daftarPartner(peran ? { peran } : {})

  return (
    <>
      <KepalaHalaman
        judul={judul}
        deskripsi={deskripsi}
        aksi={
          <DialogPartner
            peranAwal={peran}
            pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Mitra</Button>}
          />
        }
      />
      <TabelData
        kolom={kolom}
        baris={mitra}
        kunciBaris={(m) => m.id}
        pesanKosong="Belum ada mitra usaha yang terdaftar."
      />
    </>
  )
}
```

`src/app/(app)/kontak/page.tsx`:
```tsx
import { DaftarKontak } from './daftar-kontak'

export const metadata = { title: 'Semua Kontak' }

export default function HalamanSemuaKontak() {
  return (
    <DaftarKontak
      judul="Semua Kontak"
      deskripsi="Pelanggan dan pemasok tersimpan dalam satu daftar; satu mitra dapat berperan sebagai keduanya."
    />
  )
}
```

`src/app/(app)/kontak/pelanggan/page.tsx`:
```tsx
import { DaftarKontak } from '../daftar-kontak'

export const metadata = { title: 'Pelanggan' }

export default function HalamanPelanggan() {
  return (
    <DaftarKontak
      judul="Pelanggan"
      deskripsi="Mitra usaha yang ditandai sebagai pelanggan."
      peran="pelanggan"
    />
  )
}
```

`src/app/(app)/kontak/pemasok/page.tsx`:
```tsx
import { DaftarKontak } from '../daftar-kontak'

export const metadata = { title: 'Pemasok' }

export default function HalamanPemasok() {
  return (
    <DaftarKontak
      judul="Pemasok"
      deskripsi="Mitra usaha yang ditandai sebagai pemasok."
      peran="pemasok"
    />
  )
}
```

- [ ] **Step 11: Jalankan pengujian, periksa tipe, dan bangun**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: seluruhnya berhasil

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(akuntansi): mitra usaha dengan validasi NPWP dan NIK

Menyimpan pelanggan dan pemasok dalam satu tabel dengan tiga tampilan
terfilter. NPWP dinormalkan menjadi angka saja saat disimpan dan
diformat kembali saat ditampilkan, sehingga pencocokan dengan data pajak
tetap dapat diandalkan. Menerima NPWP 15 maupun 16 digit."
```

---

## Task 11: Pajak dan Syarat Pembayaran

**Files:**
- Modify: `src/db/schema/akuntansi.ts` (tambah `taxes`)
- Create: `src/modules/akuntansi/validasi/pajak.ts`
- Create: `src/modules/akuntansi/repositori/pajak.ts`, `src/modules/akuntansi/repositori/syarat-pembayaran.ts`
- Create: `src/modules/akuntansi/layanan/pajak.ts`, `src/modules/akuntansi/layanan/syarat-pembayaran.ts`
- Create: `src/app/(app)/akuntansi/konfigurasi/pajak/page.tsx`, `aksi.ts`, `dialog-pajak.tsx`
- Create: `src/app/(app)/akuntansi/konfigurasi/syarat-pembayaran/page.tsx`, `aksi.ts`, `dialog-syarat.tsx`
- Test: `tests/akuntansi/pajak.test.ts`

**Interfaces:**
- Consumes: `ValidasiError` dari `@/modules/akuntansi/layanan/akun`; `daftarAkun` dari Task 9; `TabelData`, `KepalaHalaman` dari Task 9
- Produces:
  - Tabel `taxes` dari `@/db/schema/akuntansi`
  - `hitungPajak(dpp: Uang, tarif: Uang, hargaTermasukPajak: boolean): { dasar: Uang; pajak: Uang }` dari `@/modules/akuntansi/layanan/pajak`
  - `buatPajak`, `ubahPajak`, `nonaktifkanPajak`, `daftarPajak(ruangLingkup?)` dari modul yang sama
  - `buatSyaratPembayaran`, `ubahSyaratPembayaran`, `daftarSyaratPembayaran`, `hitungJatuhTempo(tanggal: Date, jumlahHari: number): Date` dari `@/modules/akuntansi/layanan/syarat-pembayaran`
  - `type Pajak = typeof taxes.$inferSelect`

- [ ] **Step 1: Tambahkan skema pajak**

Tambahkan ke `src/db/schema/akuntansi.ts` (impor `numeric` dan `ruangLingkupPajakEnum`):
```ts
export const taxes = pgTable('taxes', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  ruangLingkup: ruangLingkupPajakEnum('ruang_lingkup').notNull(),
  tarif: numeric('tarif', { precision: 9, scale: 4 }).notNull(),
  hargaTermasukPajak: boolean('harga_termasuk_pajak').notNull().default(false),
  isPemotongan: boolean('is_pemotongan').notNull().default(false),
  akunPajakId: uuid('akun_pajak_id').notNull().references(() => accounts.id),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [uniqueIndex('taxes_kode_unik').on(t.kode)])
```

- [ ] **Step 2: Hasilkan dan jalankan migrasi**

```bash
pnpm db:generate && pnpm db:migrate
```

- [ ] **Step 3: Tulis pengujian pajak yang gagal**

`tests/akuntansi/pajak.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/klien'
import { accounts } from '@/db/schema'
import { hitungPajak, buatPajak, daftarPajak } from '@/modules/akuntansi/layanan/pajak'
import { skemaPajak } from '@/modules/akuntansi/validasi/pajak'
import {
  buatSyaratPembayaran, daftarSyaratPembayaran, hitungJatuhTempo,
} from '@/modules/akuntansi/layanan/syarat-pembayaran'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

let akunPajakId: string

beforeEach(async () => {
  await bersihkanTabel(['taxes', 'payment_terms', 'accounts'])
  const [akun] = await db.insert(accounts).values({
    kode: '2103', nama: 'Utang PPN Keluaran', tipeAkun: 'liabilitas_pajak',
  }).returning()
  akunPajakId = akun.id
})
afterAll(async () => { await tutupKoneksi() })

describe('hitungPajak — harga belum termasuk pajak', () => {
  it('menambahkan pajak di atas dasar pengenaan', () => {
    expect(hitungPajak('1000000', '11', false)).toEqual({ dasar: '1000000.00', pajak: '110000.00' })
  })

  it('membulatkan hasil ke dua desimal', () => {
    expect(hitungPajak('333333.33', '11', false)).toEqual({ dasar: '333333.33', pajak: '36666.67' })
  })

  it('menghasilkan pajak nol untuk tarif nol', () => {
    expect(hitungPajak('1000000', '0', false)).toEqual({ dasar: '1000000.00', pajak: '0.00' })
  })
})

describe('hitungPajak — harga sudah termasuk pajak', () => {
  it('memisahkan dasar pengenaan dari nilai bruto', () => {
    expect(hitungPajak('1110000', '11', true)).toEqual({ dasar: '1000000.00', pajak: '110000.00' })
  })

  it('menjaga penjumlahan dasar dan pajak tetap sama dengan nilai bruto', () => {
    const { dasar, pajak } = hitungPajak('999999.99', '11', true)
    expect(Number(dasar) + Number(pajak)).toBeCloseTo(999999.99, 2)
  })

  it('mengembalikan nilai apa adanya untuk tarif nol', () => {
    expect(hitungPajak('1000000', '0', true)).toEqual({ dasar: '1000000.00', pajak: '0.00' })
  })
})

describe('validasi pajak', () => {
  const PPN = {
    kode: 'PPN-K-11', nama: 'PPN Keluaran 11%', ruangLingkup: 'penjualan' as const,
    tarif: '11', hargaTermasukPajak: false, isPemotongan: false, akunPajakId: '',
  }

  it('menerima masukan yang sah', () => {
    expect(skemaPajak.safeParse({ ...PPN, akunPajakId: crypto.randomUUID() }).success).toBe(true)
  })

  it('menolak tarif negatif', () => {
    const hasil = skemaPajak.safeParse({ ...PPN, tarif: '-1', akunPajakId: crypto.randomUUID() })
    expect(hasil.success).toBe(false)
    expect(hasil.error!.issues[0].message).toBe('Tarif tidak boleh negatif')
  })

  it('menolak tarif di atas seratus persen', () => {
    const hasil = skemaPajak.safeParse({ ...PPN, tarif: '101', akunPajakId: crypto.randomUUID() })
    expect(hasil.success).toBe(false)
    expect(hasil.error!.issues[0].message).toBe('Tarif maksimal 100 persen')
  })

  it('menolak tarif yang bukan angka', () => {
    const hasil = skemaPajak.safeParse({ ...PPN, tarif: 'sebelas', akunPajakId: crypto.randomUUID() })
    expect(hasil.success).toBe(false)
  })
})

describe('buatPajak dan daftarPajak', () => {
  it('menyimpan pajak baru', async () => {
    const pajak = await buatPajak({
      kode: 'PPN-K-11', nama: 'PPN Keluaran 11%', ruangLingkup: 'penjualan',
      tarif: '11', hargaTermasukPajak: false, isPemotongan: false, akunPajakId,
    })
    expect(pajak.kode).toBe('PPN-K-11')
    expect(pajak.tarif).toBe('11.0000')
  })

  it('menolak kode ganda', async () => {
    const masukan = {
      kode: 'PPN-K-11', nama: 'PPN Keluaran 11%', ruangLingkup: 'penjualan' as const,
      tarif: '11', hargaTermasukPajak: false, isPemotongan: false, akunPajakId,
    }
    await buatPajak(masukan)
    await expect(buatPajak(masukan)).rejects.toThrow('Kode pajak PPN-K-11 sudah digunakan')
  })

  it('menyaring berdasarkan ruang lingkup', async () => {
    await buatPajak({
      kode: 'PPN-K-11', nama: 'PPN Keluaran', ruangLingkup: 'penjualan',
      tarif: '11', hargaTermasukPajak: false, isPemotongan: false, akunPajakId,
    })
    await buatPajak({
      kode: 'PPN-M-11', nama: 'PPN Masukan', ruangLingkup: 'pembelian',
      tarif: '11', hargaTermasukPajak: false, isPemotongan: false, akunPajakId,
    })
    expect(await daftarPajak('penjualan')).toHaveLength(1)
    expect(await daftarPajak()).toHaveLength(2)
  })
})

describe('syarat pembayaran', () => {
  it('menyimpan syarat baru', async () => {
    const syarat = await buatSyaratPembayaran({ nama: 'Net 30', jumlahHari: 30, catatan: null })
    expect(syarat.jumlahHari).toBe(30)
  })

  it('menolak nama ganda', async () => {
    await buatSyaratPembayaran({ nama: 'Tunai', jumlahHari: 0, catatan: null })
    await expect(buatSyaratPembayaran({ nama: 'Tunai', jumlahHari: 0, catatan: null }))
      .rejects.toThrow('Syarat pembayaran Tunai sudah ada')
  })

  it('menolak jumlah hari negatif', async () => {
    await expect(buatSyaratPembayaran({ nama: 'Aneh', jumlahHari: -5, catatan: null }))
      .rejects.toThrow('Jumlah hari tidak boleh negatif')
  })

  it('mengurutkan berdasarkan jumlah hari', async () => {
    await buatSyaratPembayaran({ nama: 'Net 60', jumlahHari: 60, catatan: null })
    await buatSyaratPembayaran({ nama: 'Tunai', jumlahHari: 0, catatan: null })
    await buatSyaratPembayaran({ nama: 'Net 30', jumlahHari: 30, catatan: null })
    expect((await daftarSyaratPembayaran()).map((s) => s.nama)).toEqual(['Tunai', 'Net 30', 'Net 60'])
  })
})

describe('hitungJatuhTempo', () => {
  it('menambahkan jumlah hari ke tanggal faktur', () => {
    expect(hitungJatuhTempo(new Date('2026-09-08T00:00:00Z'), 30).toISOString().slice(0, 10))
      .toBe('2026-10-08')
  })

  it('mengembalikan tanggal yang sama untuk pembayaran tunai', () => {
    expect(hitungJatuhTempo(new Date('2026-09-08T00:00:00Z'), 0).toISOString().slice(0, 10))
      .toBe('2026-09-08')
  })

  it('melintasi pergantian bulan dan tahun dengan benar', () => {
    expect(hitungJatuhTempo(new Date('2026-12-20T00:00:00Z'), 30).toISOString().slice(0, 10))
      .toBe('2027-01-19')
  })
})
```

- [ ] **Step 4: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/akuntansi/pajak.test.ts`
Expected: GAGAL pada impor modul pajak

- [ ] **Step 5: Tulis validasi pajak**

`src/modules/akuntansi/validasi/pajak.ts`:
```ts
import { z } from 'zod'

const tarifPersen = z.string().trim()
  .refine((v) => /^-?\d+(\.\d+)?$/.test(v), { message: 'Tarif harus berupa angka' })
  .refine((v) => Number(v) >= 0, { message: 'Tarif tidak boleh negatif' })
  .refine((v) => Number(v) <= 100, { message: 'Tarif maksimal 100 persen' })

export const skemaPajak = z.object({
  kode: z.string().trim().min(1, 'Kode pajak wajib diisi').max(20),
  nama: z.string().trim().min(1, 'Nama pajak wajib diisi').max(120),
  ruangLingkup: z.enum(['penjualan', 'pembelian'], { message: 'Ruang lingkup tidak dikenali' }),
  tarif: tarifPersen,
  hargaTermasukPajak: z.boolean().default(false),
  isPemotongan: z.boolean().default(false),
  akunPajakId: z.string().uuid('Akun pajak wajib dipilih'),
})

export const skemaSyaratPembayaran = z.object({
  nama: z.string().trim().min(1, 'Nama syarat pembayaran wajib diisi').max(60),
  jumlahHari: z.number().int('Jumlah hari harus bilangan bulat')
    .min(0, 'Jumlah hari tidak boleh negatif')
    .max(365, 'Jumlah hari maksimal 365'),
  catatan: z.string().trim().max(200).nullable().default(null),
})

export type MasukanPajak = z.input<typeof skemaPajak>
export type MasukanSyaratPembayaran = z.input<typeof skemaSyaratPembayaran>
```

- [ ] **Step 6: Tulis repositori dan layanan pajak**

`src/modules/akuntansi/repositori/pajak.ts`:
```ts
import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '@/db/klien'
import { taxes } from '@/db/schema'

export type Pajak = typeof taxes.$inferSelect
export type PajakBaru = typeof taxes.$inferInsert

export async function ambilSemuaPajak(ruangLingkup?: 'penjualan' | 'pembelian'): Promise<Pajak[]> {
  const kueri = db.select().from(taxes).orderBy(asc(taxes.kode))
  return ruangLingkup ? kueri.where(eq(taxes.ruangLingkup, ruangLingkup)) : kueri
}

export async function ambilPajakLewatId(id: string): Promise<Pajak | null> {
  const [pajak] = await db.select().from(taxes).where(eq(taxes.id, id)).limit(1)
  return pajak ?? null
}

export async function kodePajakTerpakai(kode: string, kecualiId?: string): Promise<boolean> {
  const syarat = kecualiId ? and(eq(taxes.kode, kode), ne(taxes.id, kecualiId)) : eq(taxes.kode, kode)
  const [ada] = await db.select({ id: taxes.id }).from(taxes).where(syarat).limit(1)
  return Boolean(ada)
}

export async function sisipkanPajak(nilai: PajakBaru): Promise<Pajak> {
  const [pajak] = await db.insert(taxes).values(nilai).returning()
  return pajak
}

export async function perbaruiPajak(id: string, nilai: Partial<PajakBaru>): Promise<Pajak> {
  const [pajak] = await db.update(taxes).set(nilai).where(eq(taxes.id, id)).returning()
  return pajak
}
```

`src/modules/akuntansi/layanan/pajak.ts`:
```ts
import { bagi, bulatkan, kali, kurang, tambah, type Uang } from '@/lib/uang'
import { skemaPajak, type MasukanPajak } from '../validasi/pajak'
import * as repo from '../repositori/pajak'
import type { Pajak } from '../repositori/pajak'
import { ValidasiError } from '@/lib/galat'

export type { Pajak }

const DESIMAL_IDR = 2

/**
 * Memisahkan dasar pengenaan pajak dari nilai pajaknya.
 * Bila hargaTermasukPajak bernilai benar, `nilai` dianggap bruto dan
 * dasar dihitung mundur: dasar = bruto / (1 + tarif/100).
 */
export function hitungPajak(
  nilai: Uang,
  tarif: Uang,
  hargaTermasukPajak: boolean,
): { dasar: Uang; pajak: Uang } {
  const pengali = bagi(tarif, 100)

  if (!hargaTermasukPajak) {
    return {
      dasar: bulatkan(nilai, DESIMAL_IDR),
      pajak: bulatkan(kali(nilai, pengali), DESIMAL_IDR),
    }
  }

  const dasar = bulatkan(bagi(nilai, tambah('1', pengali)), DESIMAL_IDR)
  return { dasar, pajak: bulatkan(kurang(nilai, dasar), DESIMAL_IDR) }
}

function urai(masukan: MasukanPajak) {
  const hasil = skemaPajak.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

export async function daftarPajak(ruangLingkup?: 'penjualan' | 'pembelian'): Promise<Pajak[]> {
  return repo.ambilSemuaPajak(ruangLingkup)
}

export async function buatPajak(masukan: MasukanPajak): Promise<Pajak> {
  const data = urai(masukan)
  if (await repo.kodePajakTerpakai(data.kode)) {
    throw new ValidasiError(`Kode pajak ${data.kode} sudah digunakan`)
  }
  return repo.sisipkanPajak(data)
}

export async function ubahPajak(id: string, masukan: MasukanPajak): Promise<Pajak> {
  const data = urai(masukan)
  const pajak = await repo.ambilPajakLewatId(id)
  if (!pajak) throw new ValidasiError('Pajak tidak ditemukan')
  if (await repo.kodePajakTerpakai(data.kode, id)) {
    throw new ValidasiError(`Kode pajak ${data.kode} sudah digunakan`)
  }
  return repo.perbaruiPajak(id, data)
}

export async function nonaktifkanPajak(id: string): Promise<void> {
  const pajak = await repo.ambilPajakLewatId(id)
  if (!pajak) throw new ValidasiError('Pajak tidak ditemukan')
  await repo.perbaruiPajak(id, { isActive: false })
}

export async function aktifkanPajak(id: string): Promise<void> {
  const pajak = await repo.ambilPajakLewatId(id)
  if (!pajak) throw new ValidasiError('Pajak tidak ditemukan')
  await repo.perbaruiPajak(id, { isActive: true })
}
```

Perhitungan pajak diselesaikan dengan menghitung dasar lebih dulu lalu mengurangkannya dari nilai bruto, bukan dengan mengalikan dasar dengan tarif. Cara ini menjamin dasar dan pajak selalu berjumlah tepat sama dengan nilai bruto, tanpa selisih satu sen akibat dua kali pembulatan.

- [ ] **Step 7: Tulis repositori dan layanan syarat pembayaran**

`src/modules/akuntansi/repositori/syarat-pembayaran.ts`:
```ts
import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '@/db/klien'
import { paymentTerms } from '@/db/schema'

export type SyaratPembayaran = typeof paymentTerms.$inferSelect
export type SyaratPembayaranBaru = typeof paymentTerms.$inferInsert

export async function ambilSemuaSyarat(): Promise<SyaratPembayaran[]> {
  return db.select().from(paymentTerms).orderBy(asc(paymentTerms.jumlahHari))
}

export async function ambilSyaratLewatId(id: string): Promise<SyaratPembayaran | null> {
  const [syarat] = await db.select().from(paymentTerms).where(eq(paymentTerms.id, id)).limit(1)
  return syarat ?? null
}

export async function namaSyaratTerpakai(nama: string, kecualiId?: string): Promise<boolean> {
  const syarat = kecualiId
    ? and(eq(paymentTerms.nama, nama), ne(paymentTerms.id, kecualiId))
    : eq(paymentTerms.nama, nama)
  const [ada] = await db.select({ id: paymentTerms.id }).from(paymentTerms).where(syarat).limit(1)
  return Boolean(ada)
}

export async function sisipkanSyarat(nilai: SyaratPembayaranBaru): Promise<SyaratPembayaran> {
  const [syarat] = await db.insert(paymentTerms).values(nilai).returning()
  return syarat
}

export async function perbaruiSyarat(
  id: string, nilai: Partial<SyaratPembayaranBaru>,
): Promise<SyaratPembayaran> {
  const [syarat] = await db.update(paymentTerms).set(nilai).where(eq(paymentTerms.id, id)).returning()
  return syarat
}
```

`src/modules/akuntansi/layanan/syarat-pembayaran.ts`:
```ts
import { skemaSyaratPembayaran, type MasukanSyaratPembayaran } from '../validasi/pajak'
import * as repo from '../repositori/syarat-pembayaran'
import type { SyaratPembayaran } from '../repositori/syarat-pembayaran'
import { ValidasiError } from '@/lib/galat'

export type { SyaratPembayaran }

export function hitungJatuhTempo(tanggalFaktur: Date, jumlahHari: number): Date {
  const jatuhTempo = new Date(tanggalFaktur)
  jatuhTempo.setUTCDate(jatuhTempo.getUTCDate() + jumlahHari)
  return jatuhTempo
}

function urai(masukan: MasukanSyaratPembayaran) {
  const hasil = skemaSyaratPembayaran.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

export async function daftarSyaratPembayaran(): Promise<SyaratPembayaran[]> {
  return repo.ambilSemuaSyarat()
}

export async function buatSyaratPembayaran(
  masukan: MasukanSyaratPembayaran,
): Promise<SyaratPembayaran> {
  const data = urai(masukan)
  if (await repo.namaSyaratTerpakai(data.nama)) {
    throw new ValidasiError(`Syarat pembayaran ${data.nama} sudah ada`)
  }
  return repo.sisipkanSyarat(data)
}

export async function ubahSyaratPembayaran(
  id: string, masukan: MasukanSyaratPembayaran,
): Promise<SyaratPembayaran> {
  const data = urai(masukan)
  const syarat = await repo.ambilSyaratLewatId(id)
  if (!syarat) throw new ValidasiError('Syarat pembayaran tidak ditemukan')
  if (await repo.namaSyaratTerpakai(data.nama, id)) {
    throw new ValidasiError(`Syarat pembayaran ${data.nama} sudah ada`)
  }
  return repo.perbaruiSyarat(id, data)
}
```

- [ ] **Step 8: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/akuntansi/pajak.test.ts`
Expected: SELURUH pengujian LULUS

- [ ] **Step 9: Tulis Server Action untuk kedua entitas**

`src/app/(app)/akuntansi/konfigurasi/pajak/aksi.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { buatPajak, ubahPajak, nonaktifkanPajak, aktifkanPajak } from '@/modules/akuntansi/layanan/pajak'
import type { MasukanPajak } from '@/modules/akuntansi/validasi/pajak'

const IZIN = 'akuntansi.pajak.kelola'
const RUTE = '/akuntansi/konfigurasi/pajak'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
}

export async function aksiSimpanPajak(id: string | null, masukan: MasukanPajak): Promise<HasilAksi> {
  await wajibIzin(IZIN)
  try {
    if (id) await ubahPajak(id, masukan)
    else await buatPajak(masukan)
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusPajak(id: string, aktif: boolean): Promise<HasilAksi> {
  await wajibIzin(IZIN)
  try {
    if (aktif) await aktifkanPajak(id)
    else await nonaktifkanPajak(id)
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
```

`src/app/(app)/akuntansi/konfigurasi/syarat-pembayaran/aksi.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  buatSyaratPembayaran, ubahSyaratPembayaran,
} from '@/modules/akuntansi/layanan/syarat-pembayaran'
import type { MasukanSyaratPembayaran } from '@/modules/akuntansi/validasi/pajak'

const IZIN = 'akuntansi.syarat-bayar.kelola'
const RUTE = '/akuntansi/konfigurasi/syarat-pembayaran'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

export async function aksiSimpanSyarat(
  id: string | null, masukan: MasukanSyaratPembayaran,
): Promise<HasilAksi> {
  await wajibIzin(IZIN)
  try {
    if (id) await ubahSyaratPembayaran(id, masukan)
    else await buatSyaratPembayaran(masukan)
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
  }
}
```

- [ ] **Step 10: Tulis dialog pajak**

`src/app/(app)/akuntansi/konfigurasi/pajak/dialog-pajak.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Pajak } from '@/modules/akuntansi/layanan/pajak'
import { aksiSimpanPajak } from './aksi'

export type PilihanAkun = { id: string; kode: string; nama: string }

export function DialogPajak({
  pajak, akunPajak, pemicu,
}: {
  pajak?: Pajak
  akunPajak: PilihanAkun[]
  pemicu: React.ReactNode
}) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanPajak(pajak?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        ruangLingkup: String(data.get('ruangLingkup') ?? 'penjualan') as 'penjualan' | 'pembelian',
        tarif: String(data.get('tarif') ?? '0'),
        hargaTermasukPajak: data.get('hargaTermasukPajak') === 'on',
        isPemotongan: data.get('isPemotongan') === 'on',
        akunPajakId: String(data.get('akunPajakId') ?? ''),
      })
      if (hasil.berhasil) {
        toast.success(pajak ? 'Pajak berhasil diperbarui' : 'Pajak berhasil dibuat')
        setTerbuka(false)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>{pemicu}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pajak ? 'Ubah Pajak' : 'Tambah Pajak'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kode">Kode</Label>
            <Input id="kode" name="kode" defaultValue={pajak?.kode} required placeholder="PPN-K-11" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" defaultValue={pajak?.nama} required placeholder="PPN Keluaran 11%" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ruangLingkup">Ruang Lingkup</Label>
              <Select name="ruangLingkup" defaultValue={pajak?.ruangLingkup ?? 'penjualan'}>
                <SelectTrigger id="ruangLingkup"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="penjualan">Penjualan</SelectItem>
                  <SelectItem value="pembelian">Pembelian</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tarif">Tarif (%)</Label>
              <Input
                id="tarif" name="tarif" type="number" step="0.0001" min="0" max="100"
                defaultValue={pajak?.tarif ?? '11'} required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="akunPajakId">Akun Pajak</Label>
            <Select name="akunPajakId" defaultValue={pajak?.akunPajakId} required>
              <SelectTrigger id="akunPajakId">
                <SelectValue placeholder="Pilih akun pajak" />
              </SelectTrigger>
              <SelectContent>
                {akunPajak.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.kode} — {a.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="hargaTermasukPajak" name="hargaTermasukPajak"
                defaultChecked={pajak?.hargaTermasukPajak}
              />
              <Label htmlFor="hargaTermasukPajak" className="font-normal">
                Harga sudah termasuk pajak
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="isPemotongan" name="isPemotongan" defaultChecked={pajak?.isPemotongan} />
              <Label htmlFor="isPemotongan" className="font-normal">
                Pajak pemotongan (PPh)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 11: Tulis dialog syarat pembayaran**

`src/app/(app)/akuntansi/konfigurasi/syarat-pembayaran/dialog-syarat.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import type { SyaratPembayaran } from '@/modules/akuntansi/layanan/syarat-pembayaran'
import { aksiSimpanSyarat } from './aksi'

export function DialogSyarat({
  syarat, pemicu,
}: {
  syarat?: SyaratPembayaran
  pemicu: React.ReactNode
}) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanSyarat(syarat?.id ?? null, {
        nama: String(data.get('nama') ?? ''),
        jumlahHari: Number(data.get('jumlahHari') ?? 0),
        catatan: String(data.get('catatan') ?? '') || null,
      })
      if (hasil.berhasil) {
        toast.success(syarat ? 'Syarat pembayaran diperbarui' : 'Syarat pembayaran dibuat')
        setTerbuka(false)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>{pemicu}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{syarat ? 'Ubah Syarat Pembayaran' : 'Tambah Syarat Pembayaran'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" defaultValue={syarat?.nama} required placeholder="Net 30" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jumlahHari">Jumlah Hari</Label>
            <Input
              id="jumlahHari" name="jumlahHari" type="number" min="0" max="365"
              defaultValue={syarat?.jumlahHari ?? 0} required
            />
            <p className="text-xs text-muted-foreground">
              Isi 0 untuk pembayaran tunai. Jatuh tempo dihitung dari tanggal faktur.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="catatan">Catatan</Label>
            <Textarea id="catatan" name="catatan" defaultValue={syarat?.catatan ?? ''} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 12: Tulis kedua halaman**

`src/app/(app)/akuntansi/konfigurasi/pajak/page.tsx`:
```tsx
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarPajak, type Pajak } from '@/modules/akuntansi/layanan/pajak'
import { daftarAkun } from '@/modules/akuntansi/layanan/akun'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogPajak, type PilihanAkun } from './dialog-pajak'

export const metadata = { title: 'Pajak' }

function kolomPajak(akunPajak: PilihanAkun[]): Kolom<Pajak>[] {
  return [
    { kunci: 'kode', judul: 'Kode', lebar: '130px', render: (p) => <span className="font-mono text-sm">{p.kode}</span> },
    { kunci: 'nama', judul: 'Nama', render: (p) => p.nama },
    {
      kunci: 'lingkup', judul: 'Ruang Lingkup', lebar: '140px',
      render: (p) => (p.ruangLingkup === 'penjualan' ? 'Penjualan' : 'Pembelian'),
    },
    {
      kunci: 'tarif', judul: 'Tarif', lebar: '100px', rataKanan: true,
      render: (p) => `${Number(p.tarif)}%`,
    },
    {
      kunci: 'sifat', judul: 'Sifat', lebar: '170px',
      render: (p) => (
        <span className="flex gap-1">
          {p.isPemotongan && <Badge variant="outline">Pemotongan</Badge>}
          {p.hargaTermasukPajak && <Badge variant="outline">Termasuk Harga</Badge>}
        </span>
      ),
    },
    {
      kunci: 'status', judul: 'Status', lebar: '100px',
      render: (p) => (
        <Badge variant={p.isActive ? 'secondary' : 'outline'}>
          {p.isActive ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
    {
      kunci: 'aksi', judul: '', lebar: '80px', rataKanan: true,
      render: (p) => (
        <DialogPajak pajak={p} akunPajak={akunPajak} pemicu={<Button variant="ghost" size="sm">Ubah</Button>} />
      ),
    },
  ]
}

export default async function HalamanPajak() {
  await wajibIzin('akuntansi.pajak.kelola')
  const [pajak, semuaAkun] = await Promise.all([daftarPajak(), daftarAkun()])

  const akunPajak: PilihanAkun[] = semuaAkun
    .filter((a) => a.isActive && (a.tipeAkun === 'liabilitas_pajak' || a.tipeAkun === 'aset_lancar_lain'))
    .map((a) => ({ id: a.id, kode: a.kode, nama: a.nama }))

  return (
    <>
      <KepalaHalaman
        judul="Pajak"
        deskripsi="Tarif tersimpan di basis data dan dapat diubah tanpa penerapan ulang saat regulasi berubah."
        aksi={
          <DialogPajak
            akunPajak={akunPajak}
            pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Pajak</Button>}
          />
        }
      />
      <TabelData
        kolom={kolomPajak(akunPajak)}
        baris={pajak}
        kunciBaris={(p) => p.id}
        pesanKosong="Belum ada pajak. Jalankan seed data awal untuk memuat PPN dan PPh."
      />
    </>
  )
}
```

`src/app/(app)/akuntansi/konfigurasi/syarat-pembayaran/page.tsx`:
```tsx
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import {
  daftarSyaratPembayaran, type SyaratPembayaran,
} from '@/modules/akuntansi/layanan/syarat-pembayaran'
import { Button } from '@/components/ui/button'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogSyarat } from './dialog-syarat'

export const metadata = { title: 'Syarat Pembayaran' }

const kolom: Kolom<SyaratPembayaran>[] = [
  { kunci: 'nama', judul: 'Nama', render: (s) => s.nama },
  {
    kunci: 'hari', judul: 'Jatuh Tempo', lebar: '160px', rataKanan: true,
    render: (s) => (s.jumlahHari === 0 ? 'Tunai' : `${s.jumlahHari} hari`),
  },
  { kunci: 'catatan', judul: 'Catatan', render: (s) => s.catatan ?? '—' },
  {
    kunci: 'aksi', judul: '', lebar: '80px', rataKanan: true,
    render: (s) => <DialogSyarat syarat={s} pemicu={<Button variant="ghost" size="sm">Ubah</Button>} />,
  },
]

export default async function HalamanSyaratPembayaran() {
  await wajibIzin('akuntansi.syarat-bayar.kelola')
  const syarat = await daftarSyaratPembayaran()

  return (
    <>
      <KepalaHalaman
        judul="Syarat Pembayaran"
        deskripsi="Menentukan tanggal jatuh tempo faktur dan tagihan."
        aksi={
          <DialogSyarat pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Syarat</Button>} />
        }
      />
      <TabelData
        kolom={kolom}
        baris={syarat}
        kunciBaris={(s) => s.id}
        pesanKosong="Belum ada syarat pembayaran."
      />
    </>
  )
}
```

- [ ] **Step 13: Jalankan pengujian, periksa tipe, dan bangun**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: seluruhnya berhasil

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(akuntansi): master pajak dan syarat pembayaran

Menambahkan tabel pajak dengan tarif yang dapat diubah lewat antarmuka,
penanda pajak pemotongan untuk PPh, serta perhitungan dasar pengenaan yang
menjamin dasar dan pajak berjumlah tepat sama dengan nilai bruto.
Syarat pembayaran menentukan perhitungan jatuh tempo."
```

---

## Task 12: Master Jurnal

Setiap jurnal memiliki urutan penomorannya sendiri. Pembuatan jurnal dan urutannya harus terjadi dalam satu transaksi agar tidak pernah ada jurnal tanpa urutan.

**Files:**
- Modify: `src/db/schema/akuntansi.ts` (tambah `journals`)
- Create: `src/modules/akuntansi/validasi/jurnal.ts`
- Create: `src/modules/akuntansi/repositori/jurnal.ts`
- Create: `src/modules/akuntansi/layanan/jurnal.ts`
- Create: `src/app/(app)/akuntansi/konfigurasi/jurnal/page.tsx`, `aksi.ts`, `dialog-jurnal.tsx`
- Test: `tests/akuntansi/jurnal.test.ts`

**Interfaces:**
- Consumes: `ambilNomorBerikut` dari Task 7; `daftarAkun` dari Task 9; `ValidasiError` dari `@/modules/akuntansi/layanan/akun`
- Produces:
  - Tabel `journals` dari `@/db/schema/akuntansi`
  - `buatJurnal(masukan: MasukanJurnal): Promise<Jurnal>` — membuat jurnal beserta urutannya dalam satu transaksi
  - `ubahJurnal`, `nonaktifkanJurnal`, `aktifkanJurnal`, `daftarJurnal(tipe?)` dari `@/modules/akuntansi/layanan/jurnal`
  - `labelTipeJurnal(tipe: string): string`
  - `type Jurnal = typeof journals.$inferSelect`

- [ ] **Step 1: Tambahkan skema jurnal**

Tambahkan ke `src/db/schema/akuntansi.ts` (impor `tipeJurnalEnum` dari `./enum` dan `sequences` dari `./konfigurasi`):
```ts
export const journals = pgTable('journals', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  tipe: tipeJurnalEnum('tipe').notNull(),
  sequenceId: uuid('sequence_id').notNull().references(() => sequences.id),
  akunDefaultDebitId: uuid('akun_default_debit_id').references(() => accounts.id),
  akunDefaultKreditId: uuid('akun_default_kredit_id').references(() => accounts.id),
  mataUangId: text('mata_uang_id').references(() => currencies.kode),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [uniqueIndex('journals_kode_unik').on(t.kode)])
```

`konfigurasi.ts` mengimpor `accounts` dari `akuntansi.ts`, dan kini `akuntansi.ts` mengimpor `sequences` dari `konfigurasi.ts`. Impor melingkar ini aman karena Drizzle hanya membaca definisi tabel pada saat modul dimuat, tetapi bila TypeScript mengeluh, pindahkan `sequences` ke berkas skema tersendiri `src/db/schema/urutan.ts` dan impor dari sana di kedua berkas.

- [ ] **Step 2: Hasilkan dan jalankan migrasi**

```bash
pnpm db:generate && pnpm db:migrate
```

- [ ] **Step 3: Tulis pengujian jurnal yang gagal**

`tests/akuntansi/jurnal.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { journals, sequences } from '@/db/schema'
import {
  buatJurnal, ubahJurnal, nonaktifkanJurnal, daftarJurnal, labelTipeJurnal,
} from '@/modules/akuntansi/layanan/jurnal'
import { ambilNomorBerikut } from '@/modules/akuntansi/layanan/urutan'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const TABEL = ['journals', 'sequences', 'taxes', 'partners', 'payment_terms', 'accounts']

beforeEach(async () => { await bersihkanTabel(TABEL) })
afterAll(async () => { await tutupKoneksi() })

const JURNAL_UMUM = {
  kode: 'JU', nama: 'Jurnal Umum', tipe: 'umum' as const,
  prefixNomor: 'JU', resetNomor: 'bulanan' as const,
  akunDefaultDebitId: null, akunDefaultKreditId: null, mataUangId: null,
}

describe('label tipe jurnal', () => {
  it('memberi label berbahasa Indonesia', () => {
    expect(labelTipeJurnal('penjualan')).toBe('Penjualan')
    expect(labelTipeJurnal('pembelian')).toBe('Pembelian')
    expect(labelTipeJurnal('kas')).toBe('Kas')
    expect(labelTipeJurnal('bank')).toBe('Bank')
    expect(labelTipeJurnal('umum')).toBe('Umum')
  })
})

describe('buatJurnal', () => {
  it('membuat jurnal beserta urutan penomorannya', async () => {
    const jurnal = await buatJurnal(JURNAL_UMUM)
    expect(jurnal.kode).toBe('JU')
    const [urutan] = await db.select().from(sequences).where(eq(sequences.id, jurnal.sequenceId))
    expect(urutan.prefix).toBe('JU')
    expect(urutan.reset).toBe('bulanan')
    expect(urutan.nomorBerikut).toBe(1)
  })

  it('memberi kode urutan yang diturunkan dari kode jurnal', async () => {
    const jurnal = await buatJurnal(JURNAL_UMUM)
    const [urutan] = await db.select().from(sequences).where(eq(sequences.id, jurnal.sequenceId))
    expect(urutan.kode).toBe('jurnal:JU')
  })

  it('menghasilkan urutan yang langsung dapat dipakai', async () => {
    await buatJurnal(JURNAL_UMUM)
    const nomor = await db.transaction((tx) =>
      ambilNomorBerikut(tx, 'jurnal:JU', new Date('2026-09-08')),
    )
    expect(nomor).toBe('JU/2026/09/0001')
  })

  it('menolak kode jurnal ganda', async () => {
    await buatJurnal(JURNAL_UMUM)
    await expect(buatJurnal({ ...JURNAL_UMUM, nama: 'Jurnal Lain' }))
      .rejects.toThrow('Kode jurnal JU sudah digunakan')
  })

  it('tidak meninggalkan urutan yatim bila pembuatan jurnal gagal', async () => {
    await buatJurnal(JURNAL_UMUM)
    await buatJurnal({ ...JURNAL_UMUM, kode: 'KAS', nama: 'Jurnal Kas', tipe: 'kas', prefixNomor: 'BKM' })
      .catch(() => undefined)
    await expect(buatJurnal({ ...JURNAL_UMUM, nama: 'Duplikat' })).rejects.toThrow()
    const urutan = await db.select().from(sequences)
    expect(urutan.map((u) => u.kode).sort()).toEqual(['jurnal:JU', 'jurnal:KAS'])
  })

  it('menolak kode jurnal kosong', async () => {
    await expect(buatJurnal({ ...JURNAL_UMUM, kode: '' })).rejects.toThrow('Kode jurnal wajib diisi')
  })

  it('menolak tipe jurnal di luar daftar', async () => {
    await expect(buatJurnal({ ...JURNAL_UMUM, tipe: 'aneh' as never }))
      .rejects.toThrow('Tipe jurnal tidak dikenali')
  })
})

describe('ubahJurnal', () => {
  it('memperbarui nama jurnal', async () => {
    const jurnal = await buatJurnal(JURNAL_UMUM)
    const hasil = await ubahJurnal(jurnal.id, { ...JURNAL_UMUM, nama: 'Jurnal Memorial' })
    expect(hasil.nama).toBe('Jurnal Memorial')
  })

  it('tidak mengubah urutan yang sudah terpakai saat kode jurnal diubah', async () => {
    const jurnal = await buatJurnal(JURNAL_UMUM)
    await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal:JU', new Date('2026-09-08')))
    await ubahJurnal(jurnal.id, { ...JURNAL_UMUM, kode: 'JUM' })
    const [urutan] = await db.select().from(sequences).where(eq(sequences.id, jurnal.sequenceId))
    expect(urutan.kode).toBe('jurnal:JU')
    expect(urutan.nomorBerikut).toBe(2)
  })

  it('menolak jurnal yang tidak ada', async () => {
    await expect(ubahJurnal('00000000-0000-0000-0000-000000000000', JURNAL_UMUM))
      .rejects.toThrow('Jurnal tidak ditemukan')
  })
})

describe('daftarJurnal', () => {
  it('menyaring berdasarkan tipe', async () => {
    await buatJurnal(JURNAL_UMUM)
    await buatJurnal({ ...JURNAL_UMUM, kode: 'PNJ', nama: 'Jurnal Penjualan', tipe: 'penjualan', prefixNomor: 'FJ' })
    expect(await daftarJurnal('penjualan')).toHaveLength(1)
    expect(await daftarJurnal()).toHaveLength(2)
  })

  it('mengurutkan berdasarkan kode', async () => {
    await buatJurnal({ ...JURNAL_UMUM, kode: 'PNJ', nama: 'Penjualan', tipe: 'penjualan', prefixNomor: 'FJ' })
    await buatJurnal(JURNAL_UMUM)
    expect((await daftarJurnal()).map((j) => j.kode)).toEqual(['JU', 'PNJ'])
  })
})

describe('nonaktifkanJurnal', () => {
  it('menandai nonaktif alih-alih menghapus', async () => {
    const jurnal = await buatJurnal(JURNAL_UMUM)
    await nonaktifkanJurnal(jurnal.id)
    const [tersimpan] = await db.select().from(journals).where(eq(journals.id, jurnal.id))
    expect(tersimpan.isActive).toBe(false)
  })
})
```

Pengujian "tidak mengubah urutan yang sudah terpakai" menegaskan keputusan penting: mengganti kode jurnal tidak menomori ulang dokumen yang sudah terbit.

- [ ] **Step 4: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/akuntansi/jurnal.test.ts`
Expected: GAGAL pada impor modul jurnal

- [ ] **Step 5: Tulis validasi jurnal**

`src/modules/akuntansi/validasi/jurnal.ts`:
```ts
import { z } from 'zod'

const TIPE_JURNAL = ['penjualan', 'pembelian', 'kas', 'bank', 'umum'] as const

const LABEL_TIPE: Record<string, string> = {
  penjualan: 'Penjualan',
  pembelian: 'Pembelian',
  kas: 'Kas',
  bank: 'Bank',
  umum: 'Umum',
}

export const DAFTAR_TIPE_JURNAL = TIPE_JURNAL

export function labelTipeJurnal(tipe: string): string {
  return LABEL_TIPE[tipe] ?? tipe
}

export const skemaJurnal = z.object({
  kode: z.string().trim()
    .min(1, 'Kode jurnal wajib diisi')
    .max(10, 'Kode jurnal maksimal 10 karakter')
    .regex(/^\S+$/, 'Kode jurnal tidak boleh memuat spasi'),
  nama: z.string().trim().min(1, 'Nama jurnal wajib diisi').max(120),
  tipe: z.enum(TIPE_JURNAL, { message: 'Tipe jurnal tidak dikenali' }),
  prefixNomor: z.string().trim()
    .min(1, 'Prefiks penomoran wajib diisi')
    .max(10, 'Prefiks penomoran maksimal 10 karakter'),
  resetNomor: z.enum(['tidak_pernah', 'tahunan', 'bulanan'], {
    message: 'Aturan reset penomoran tidak dikenali',
  }),
  akunDefaultDebitId: z.string().uuid().nullable().default(null),
  akunDefaultKreditId: z.string().uuid().nullable().default(null),
  mataUangId: z.string().trim().length(3).nullable().default(null),
})

export type MasukanJurnal = z.input<typeof skemaJurnal>
```

- [ ] **Step 6: Tulis repositori dan layanan jurnal**

`src/modules/akuntansi/repositori/jurnal.ts`:
```ts
import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '@/db/klien'
import { journals } from '@/db/schema'

export type Jurnal = typeof journals.$inferSelect
export type JurnalBaru = typeof journals.$inferInsert
export type TipeJurnal = Jurnal['tipe']

export async function ambilSemuaJurnal(tipe?: TipeJurnal): Promise<Jurnal[]> {
  const kueri = db.select().from(journals).orderBy(asc(journals.kode))
  return tipe ? kueri.where(eq(journals.tipe, tipe)) : kueri
}

export async function ambilJurnalLewatId(id: string): Promise<Jurnal | null> {
  const [jurnal] = await db.select().from(journals).where(eq(journals.id, id)).limit(1)
  return jurnal ?? null
}

export async function kodeJurnalTerpakai(kode: string, kecualiId?: string): Promise<boolean> {
  const syarat = kecualiId
    ? and(eq(journals.kode, kode), ne(journals.id, kecualiId))
    : eq(journals.kode, kode)
  const [ada] = await db.select({ id: journals.id }).from(journals).where(syarat).limit(1)
  return Boolean(ada)
}

export async function perbaruiJurnal(id: string, nilai: Partial<JurnalBaru>): Promise<Jurnal> {
  const [jurnal] = await db.update(journals).set(nilai).where(eq(journals.id, id)).returning()
  return jurnal
}
```

`src/modules/akuntansi/layanan/jurnal.ts`:
```ts
import { db } from '@/db/klien'
import { journals, sequences } from '@/db/schema'
import { skemaJurnal, labelTipeJurnal, type MasukanJurnal } from '../validasi/jurnal'
import * as repo from '../repositori/jurnal'
import type { Jurnal, TipeJurnal } from '../repositori/jurnal'
import { ValidasiError } from '@/lib/galat'

export type { Jurnal, TipeJurnal }
export { labelTipeJurnal }

function urai(masukan: MasukanJurnal) {
  const hasil = skemaJurnal.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

function kodeUrutanJurnal(kodeJurnal: string): string {
  return `jurnal:${kodeJurnal}`
}

export async function daftarJurnal(tipe?: TipeJurnal): Promise<Jurnal[]> {
  return repo.ambilSemuaJurnal(tipe)
}

/**
 * Membuat jurnal beserta urutan penomorannya dalam satu transaksi.
 * Bila salah satu gagal, keduanya dibatalkan — tidak pernah ada jurnal
 * tanpa urutan maupun urutan tanpa jurnal.
 */
export async function buatJurnal(masukan: MasukanJurnal): Promise<Jurnal> {
  const data = urai(masukan)
  if (await repo.kodeJurnalTerpakai(data.kode)) {
    throw new ValidasiError(`Kode jurnal ${data.kode} sudah digunakan`)
  }

  return db.transaction(async (tx) => {
    const [urutan] = await tx.insert(sequences).values({
      kode: kodeUrutanJurnal(data.kode),
      prefix: data.prefixNomor,
      panjangDigit: 4,
      nomorBerikut: 1,
      reset: data.resetNomor,
    }).returning()

    const [jurnal] = await tx.insert(journals).values({
      kode: data.kode,
      nama: data.nama,
      tipe: data.tipe,
      sequenceId: urutan.id,
      akunDefaultDebitId: data.akunDefaultDebitId,
      akunDefaultKreditId: data.akunDefaultKreditId,
      mataUangId: data.mataUangId,
    }).returning()

    return jurnal
  })
}

/**
 * Mengubah jurnal tidak menyentuh urutan penomorannya. Mengganti kode
 * jurnal tidak boleh menomori ulang dokumen yang sudah terbit.
 */
export async function ubahJurnal(id: string, masukan: MasukanJurnal): Promise<Jurnal> {
  const data = urai(masukan)
  const jurnal = await repo.ambilJurnalLewatId(id)
  if (!jurnal) throw new ValidasiError('Jurnal tidak ditemukan')
  if (await repo.kodeJurnalTerpakai(data.kode, id)) {
    throw new ValidasiError(`Kode jurnal ${data.kode} sudah digunakan`)
  }
  return repo.perbaruiJurnal(id, {
    kode: data.kode,
    nama: data.nama,
    tipe: data.tipe,
    akunDefaultDebitId: data.akunDefaultDebitId,
    akunDefaultKreditId: data.akunDefaultKreditId,
    mataUangId: data.mataUangId,
  })
}

export async function nonaktifkanJurnal(id: string): Promise<void> {
  const jurnal = await repo.ambilJurnalLewatId(id)
  if (!jurnal) throw new ValidasiError('Jurnal tidak ditemukan')
  await repo.perbaruiJurnal(id, { isActive: false })
}

export async function aktifkanJurnal(id: string): Promise<void> {
  const jurnal = await repo.ambilJurnalLewatId(id)
  if (!jurnal) throw new ValidasiError('Jurnal tidak ditemukan')
  await repo.perbaruiJurnal(id, { isActive: true })
}
```

- [ ] **Step 7: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/akuntansi/jurnal.test.ts`
Expected: SELURUH pengujian LULUS

- [ ] **Step 8: Tulis Server Action jurnal**

`src/app/(app)/akuntansi/konfigurasi/jurnal/aksi.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  buatJurnal, ubahJurnal, nonaktifkanJurnal, aktifkanJurnal,
} from '@/modules/akuntansi/layanan/jurnal'
import type { MasukanJurnal } from '@/modules/akuntansi/validasi/jurnal'

const IZIN = 'akuntansi.jurnal-master.kelola'
const RUTE = '/akuntansi/konfigurasi/jurnal'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
}

export async function aksiSimpanJurnal(id: string | null, masukan: MasukanJurnal): Promise<HasilAksi> {
  await wajibIzin(IZIN)
  try {
    if (id) await ubahJurnal(id, masukan)
    else await buatJurnal(masukan)
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusJurnal(id: string, aktif: boolean): Promise<HasilAksi> {
  await wajibIzin(IZIN)
  try {
    if (aktif) await aktifkanJurnal(id)
    else await nonaktifkanJurnal(id)
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
```

- [ ] **Step 9: Tulis dialog jurnal**

`src/app/(app)/akuntansi/konfigurasi/jurnal/dialog-jurnal.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DAFTAR_TIPE_JURNAL, labelTipeJurnal } from '@/modules/akuntansi/validasi/jurnal'
import type { Jurnal } from '@/modules/akuntansi/layanan/jurnal'
import { aksiSimpanJurnal } from './aksi'

export function DialogJurnal({ jurnal, pemicu }: { jurnal?: Jurnal; pemicu: React.ReactNode }) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanJurnal(jurnal?.id ?? null, {
        kode: String(data.get('kode') ?? ''),
        nama: String(data.get('nama') ?? ''),
        tipe: String(data.get('tipe') ?? 'umum') as never,
        prefixNomor: String(data.get('prefixNomor') ?? ''),
        resetNomor: String(data.get('resetNomor') ?? 'bulanan') as never,
        akunDefaultDebitId: null,
        akunDefaultKreditId: null,
        mataUangId: null,
      })
      if (hasil.berhasil) {
        toast.success(jurnal ? 'Jurnal berhasil diperbarui' : 'Jurnal berhasil dibuat')
        setTerbuka(false)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>{pemicu}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{jurnal ? 'Ubah Jurnal' : 'Tambah Jurnal'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kode">Kode</Label>
              <Input id="kode" name="kode" defaultValue={jurnal?.kode} required placeholder="JU" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipe">Tipe</Label>
              <Select name="tipe" defaultValue={jurnal?.tipe ?? 'umum'}>
                <SelectTrigger id="tipe"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAFTAR_TIPE_JURNAL.map((t) => (
                    <SelectItem key={t} value={t}>{labelTipeJurnal(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" defaultValue={jurnal?.nama} required placeholder="Jurnal Umum" />
          </div>

          {!jurnal && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prefixNomor">Prefiks Nomor</Label>
                <Input id="prefixNomor" name="prefixNomor" required placeholder="JU" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resetNomor">Reset Nomor</Label>
                <Select name="resetNomor" defaultValue="bulanan">
                  <SelectTrigger id="resetNomor"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bulanan">Setiap Bulan</SelectItem>
                    <SelectItem value="tahunan">Setiap Tahun</SelectItem>
                    <SelectItem value="tidak_pernah">Tidak Pernah</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {jurnal && (
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Pengaturan penomoran tidak dapat diubah dari sini agar dokumen yang sudah terbit
              tidak ternomori ulang. Ubah melalui menu Penomoran Dokumen bila benar-benar perlu.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 10: Tulis halaman jurnal**

`src/app/(app)/akuntansi/konfigurasi/jurnal/page.tsx`:
```tsx
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarJurnal, labelTipeJurnal, type Jurnal } from '@/modules/akuntansi/layanan/jurnal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogJurnal } from './dialog-jurnal'

export const metadata = { title: 'Jurnal' }

const kolom: Kolom<Jurnal>[] = [
  { kunci: 'kode', judul: 'Kode', lebar: '100px', render: (j) => <span className="font-mono text-sm">{j.kode}</span> },
  { kunci: 'nama', judul: 'Nama', render: (j) => j.nama },
  { kunci: 'tipe', judul: 'Tipe', lebar: '140px', render: (j) => labelTipeJurnal(j.tipe) },
  {
    kunci: 'status', judul: 'Status', lebar: '100px',
    render: (j) => (
      <Badge variant={j.isActive ? 'secondary' : 'outline'}>
        {j.isActive ? 'Aktif' : 'Nonaktif'}
      </Badge>
    ),
  },
  {
    kunci: 'aksi', judul: '', lebar: '80px', rataKanan: true,
    render: (j) => <DialogJurnal jurnal={j} pemicu={<Button variant="ghost" size="sm">Ubah</Button>} />,
  },
]

export default async function HalamanJurnal() {
  await wajibIzin('akuntansi.jurnal-master.kelola')
  const jurnal = await daftarJurnal()

  return (
    <>
      <KepalaHalaman
        judul="Jurnal"
        deskripsi="Setiap jurnal memiliki urutan penomorannya sendiri yang dibuat otomatis."
        aksi={<DialogJurnal pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Jurnal</Button>} />}
      />
      <TabelData
        kolom={kolom}
        baris={jurnal}
        kunciBaris={(j) => j.id}
        pesanKosong="Belum ada jurnal. Jalankan seed data awal untuk memuat jurnal standar."
      />
    </>
  )
}
```

- [ ] **Step 11: Jalankan pengujian, periksa tipe, dan bangun**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: seluruhnya berhasil

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(akuntansi): master jurnal dengan urutan penomoran otomatis

Setiap jurnal dibuat bersama urutan penomorannya dalam satu transaksi
sehingga tidak pernah ada jurnal tanpa urutan. Mengganti kode jurnal tidak
menyentuh urutan yang sudah terpakai agar dokumen yang sudah terbit tidak
ternomori ulang."
```

---

## Task 13: Log Aktivitas

**Files:**
- Create: `src/modules/identitas/layanan/audit.ts`
- Modify: `src/app/(app)/kontak/aksi.ts`, `src/app/(app)/akuntansi/konfigurasi/bagan-akun/aksi.ts`
- Create: `src/app/(app)/pengaturan/log-aktivitas/page.tsx`
- Test: `tests/identitas/audit.test.ts`

**Interfaces:**
- Consumes: tabel `auditLogs` dari Task 4; `ambilSesi` dari Task 5
- Produces:
  - `catatAudit(masukan: MasukanAudit): Promise<void>` dari `@/modules/identitas/layanan/audit`
  - `type MasukanAudit = { penggunaId: string | null; entitas: string; entitasId: string | null; aksi: AksiAudit; dataLama?: unknown; dataBaru?: unknown }`
  - `type AksiAudit = 'buat' | 'ubah' | 'hapus' | 'posting' | 'balik' | 'masuk'`
  - `daftarAudit(batas?: number): Promise<BarisAudit[]>`
  - `type BarisAudit = { id: string; entitas: string; entitasId: string | null; aksi: AksiAudit; namaPengguna: string | null; waktu: Date; dataLama: unknown; dataBaru: unknown }`

- [ ] **Step 1: Tulis pengujian log aktivitas yang gagal**

`tests/identitas/audit.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/klien'
import { users } from '@/db/schema'
import { catatAudit, daftarAudit } from '@/modules/identitas/layanan/audit'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

let penggunaId: string

beforeEach(async () => {
  await bersihkanTabel(['audit_logs', 'user_roles', 'users'])
  const [pengguna] = await db.insert(users).values({
    email: 'auditor@uji.id', nama: 'Auditor', passwordHash: 'x',
  }).returning()
  penggunaId = pengguna.id
})
afterAll(async () => { await tutupKoneksi() })

describe('catatAudit', () => {
  it('menyimpan satu baris log', async () => {
    await catatAudit({
      penggunaId, entitas: 'accounts', entitasId: 'abc', aksi: 'buat',
      dataBaru: { kode: '1101', nama: 'Kas' },
    })
    const log = await daftarAudit()
    expect(log).toHaveLength(1)
    expect(log[0].entitas).toBe('accounts')
    expect(log[0].aksi).toBe('buat')
  })

  it('menyertakan nama pengguna pada hasil pembacaan', async () => {
    await catatAudit({ penggunaId, entitas: 'accounts', entitasId: 'abc', aksi: 'buat' })
    const [log] = await daftarAudit()
    expect(log.namaPengguna).toBe('Auditor')
  })

  it('menerima log tanpa pengguna untuk proses otomatis', async () => {
    await catatAudit({ penggunaId: null, entitas: 'sistem', entitasId: null, aksi: 'posting' })
    const [log] = await daftarAudit()
    expect(log.namaPengguna).toBeNull()
  })

  it('menyimpan data lama dan data baru sebagai JSON', async () => {
    await catatAudit({
      penggunaId, entitas: 'accounts', entitasId: 'abc', aksi: 'ubah',
      dataLama: { nama: 'Kas' }, dataBaru: { nama: 'Kas Besar' },
    })
    const [log] = await daftarAudit()
    expect(log.dataLama).toEqual({ nama: 'Kas' })
    expect(log.dataBaru).toEqual({ nama: 'Kas Besar' })
  })

  it('tidak melempar galat saat pencatatan gagal agar tidak menggagalkan operasi utama', async () => {
    await expect(
      catatAudit({
        penggunaId: '00000000-0000-0000-0000-000000000000',
        entitas: 'accounts', entitasId: 'abc', aksi: 'buat',
      }),
    ).resolves.toBeUndefined()
  })
})

describe('daftarAudit', () => {
  it('mengurutkan dari yang terbaru', async () => {
    await catatAudit({ penggunaId, entitas: 'accounts', entitasId: '1', aksi: 'buat' })
    await catatAudit({ penggunaId, entitas: 'partners', entitasId: '2', aksi: 'buat' })
    const log = await daftarAudit()
    expect(log[0].entitas).toBe('partners')
  })

  it('menghormati batas jumlah baris', async () => {
    for (let i = 0; i < 5; i++) {
      await catatAudit({ penggunaId, entitas: 'accounts', entitasId: String(i), aksi: 'buat' })
    }
    expect(await daftarAudit(3)).toHaveLength(3)
  })
})
```

Pengujian terakhir pada `catatAudit` menegaskan keputusan penting: kegagalan pencatatan log tidak boleh menggagalkan operasi bisnis yang sedang berjalan.

- [ ] **Step 2: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/identitas/audit.test.ts`
Expected: GAGAL pada impor modul audit

- [ ] **Step 3: Tulis layanan log aktivitas**

`src/modules/identitas/layanan/audit.ts`:
```ts
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { auditLogs, users } from '@/db/schema'

export type AksiAudit = 'buat' | 'ubah' | 'hapus' | 'posting' | 'balik' | 'masuk'

export type MasukanAudit = {
  penggunaId: string | null
  entitas: string
  entitasId: string | null
  aksi: AksiAudit
  dataLama?: unknown
  dataBaru?: unknown
  alamatIp?: string | null
}

export type BarisAudit = {
  id: string
  entitas: string
  entitasId: string | null
  aksi: AksiAudit
  namaPengguna: string | null
  waktu: Date
  dataLama: unknown
  dataBaru: unknown
}

/**
 * Mencatat jejak perubahan. Kegagalan pencatatan sengaja ditelan dan hanya
 * dicetak ke konsol: log yang gagal tidak boleh membatalkan transaksi bisnis
 * yang sudah berhasil.
 */
export async function catatAudit(masukan: MasukanAudit): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: masukan.penggunaId,
      entitas: masukan.entitas,
      entitasId: masukan.entitasId,
      aksi: masukan.aksi,
      dataLama: masukan.dataLama ?? null,
      dataBaru: masukan.dataBaru ?? null,
      alamatIp: masukan.alamatIp ?? null,
    })
  } catch (galat) {
    console.error('Gagal mencatat log aktivitas:', galat)
  }
}

export async function daftarAudit(batas = 200): Promise<BarisAudit[]> {
  const baris = await db
    .select({
      id: auditLogs.id,
      entitas: auditLogs.entitas,
      entitasId: auditLogs.entitasId,
      aksi: auditLogs.aksi,
      namaPengguna: users.nama,
      waktu: auditLogs.waktu,
      dataLama: auditLogs.dataLama,
      dataBaru: auditLogs.dataBaru,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .orderBy(desc(auditLogs.waktu))
    .limit(batas)

  return baris as BarisAudit[]
}
```

- [ ] **Step 4: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/identitas/audit.test.ts`
Expected: SELURUH pengujian LULUS

Bila pengujian "mengurutkan dari yang terbaru" gagal karena kedua baris memiliki nilai `waktu` yang identik, tambahkan `.orderBy(desc(auditLogs.waktu), desc(auditLogs.id))` — dua penyisipan dalam milidetik yang sama dapat menghasilkan penanda waktu yang sama.

- [ ] **Step 5: Sambungkan pencatatan ke Server Action akun**

Ubah `src/app/(app)/akuntansi/konfigurasi/bagan-akun/aksi.ts` menjadi:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { buatAkun, ubahAkun, nonaktifkanAkun, aktifkanAkun } from '@/modules/akuntansi/layanan/akun'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanAkun } from '@/modules/akuntansi/validasi/akun'

const IZIN = 'akuntansi.coa.kelola'
const RUTE = '/akuntansi/konfigurasi/bagan-akun'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  const pesan = galat instanceof Error ? galat.message : 'Terjadi kesalahan yang tidak terduga'
  return { berhasil: false, pesan }
}

export async function aksiSimpanAkun(id: string | null, masukan: MasukanAkun): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    const akun = id ? await ubahAkun(id, masukan) : await buatAkun(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId,
      entitas: 'accounts',
      entitasId: akun.id,
      aksi: id ? 'ubah' : 'buat',
      dataBaru: masukan,
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusAkun(id: string, aktif: boolean): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    if (aktif) await aktifkanAkun(id)
    else await nonaktifkanAkun(id)
    await catatAudit({
      penggunaId: sesi.penggunaId,
      entitas: 'accounts',
      entitasId: id,
      aksi: 'ubah',
      dataBaru: { isActive: aktif },
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
```

- [ ] **Step 6: Sambungkan pencatatan ke Server Action mitra usaha**

Ubah `src/app/(app)/kontak/aksi.ts` — tambahkan impor `catatAudit`, ubah `wajibIzin(IZIN)` menjadi `const sesi = await wajibIzin(IZIN)`, dan sisipkan pencatatan setelah operasi berhasil:
```ts
import { catatAudit } from '@/modules/identitas/layanan/audit'
```
Di dalam `aksiSimpanPartner`, ganti blok `try` menjadi:
```ts
  try {
    const mitra = id ? await ubahPartner(id, masukan) : await buatPartner(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId,
      entitas: 'partners',
      entitasId: mitra.id,
      aksi: id ? 'ubah' : 'buat',
      dataBaru: masukan,
    })
    segarkan()
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
```
Di dalam `aksiUbahStatusPartner`, sisipkan sebelum `segarkan()`:
```ts
    await catatAudit({
      penggunaId: sesi.penggunaId,
      entitas: 'partners',
      entitasId: id,
      aksi: 'ubah',
      dataBaru: { isActive: aktif },
    })
```

- [ ] **Step 7: Tulis halaman log aktivitas**

`src/app/(app)/pengaturan/log-aktivitas/page.tsx`:
```tsx
import { wajibIzin } from '@/lib/sesi'
import { daftarAudit, type BarisAudit } from '@/modules/identitas/layanan/audit'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'

export const metadata = { title: 'Log Aktivitas' }

const LABEL_AKSI: Record<string, string> = {
  buat: 'Buat', ubah: 'Ubah', hapus: 'Hapus',
  posting: 'Posting', balik: 'Balik', masuk: 'Masuk',
}

const LABEL_ENTITAS: Record<string, string> = {
  accounts: 'Bagan Akun',
  partners: 'Mitra Usaha',
  taxes: 'Pajak',
  journals: 'Jurnal',
  payment_terms: 'Syarat Pembayaran',
  sistem: 'Sistem',
}

const penanggalan = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
})

const kolom: Kolom<BarisAudit>[] = [
  { kunci: 'waktu', judul: 'Waktu', lebar: '200px', render: (l) => penanggalan.format(l.waktu) },
  { kunci: 'pengguna', judul: 'Pengguna', lebar: '180px', render: (l) => l.namaPengguna ?? 'Sistem' },
  {
    kunci: 'entitas', judul: 'Objek', lebar: '180px',
    render: (l) => LABEL_ENTITAS[l.entitas] ?? l.entitas,
  },
  {
    kunci: 'aksi', judul: 'Aksi', lebar: '120px',
    render: (l) => <Badge variant="outline">{LABEL_AKSI[l.aksi] ?? l.aksi}</Badge>,
  },
  {
    kunci: 'detail', judul: 'Perubahan',
    render: (l) => (
      <code className="text-xs text-muted-foreground">
        {l.dataBaru ? JSON.stringify(l.dataBaru).slice(0, 120) : '—'}
      </code>
    ),
  },
]

export default async function HalamanLogAktivitas() {
  await wajibIzin('pengaturan.log.lihat')
  const log = await daftarAudit()

  return (
    <>
      <KepalaHalaman
        judul="Log Aktivitas"
        deskripsi="Menampilkan 200 aktivitas terakhir. Jejak ini tidak dapat dihapus dari antarmuka."
      />
      <TabelData
        kolom={kolom}
        baris={log}
        kunciBaris={(l) => l.id}
        pesanKosong="Belum ada aktivitas tercatat."
      />
    </>
  )
}
```

- [ ] **Step 8: Jalankan pengujian, periksa tipe, dan bangun**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: seluruhnya berhasil

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(identitas): log aktivitas dan penyambungannya ke master data

Mencatat jejak siapa mengubah apa pada Bagan Akun dan Mitra Usaha.
Kegagalan pencatatan log sengaja ditelan agar tidak membatalkan transaksi
bisnis yang sudah berhasil. Halaman log menampilkan 200 aktivitas terakhir
dengan waktu zona Asia/Jakarta."
```

---

## Task 14: Data Awal dan Verifikasi Menyeluruh

**Files:**
- Create: `src/db/seed/index.ts`, `src/db/seed/bagan-akun.ts`, `src/db/seed/data-dasar.ts`
- Modify: `package.json` (skrip `db:seed`)
- Test: `tests/db/seed.test.ts`

**Interfaces:**
- Consumes: seluruh skema dan layanan dari Task 4 sampai 13; `daftarKodeIzin` dari Task 3
- Produces:
  - `jalankanSeed(): Promise<void>` dari `@/db/seed`
  - `const BAGAN_AKUN_STANDAR: { kode: string; nama: string; tipeAkun: string }[]` dari `@/db/seed/bagan-akun`

- [ ] **Step 1: Tulis bagan akun standar**

`src/db/seed/bagan-akun.ts`:
```ts
export const BAGAN_AKUN_STANDAR = [
  // ASET LANCAR
  { kode: '1101', nama: 'Kas', tipeAkun: 'aset_kas' },
  { kode: '1102', nama: 'Kas Kecil', tipeAkun: 'aset_kas' },
  { kode: '1111', nama: 'Bank BCA', tipeAkun: 'aset_bank' },
  { kode: '1112', nama: 'Bank Mandiri', tipeAkun: 'aset_bank' },
  { kode: '1113', nama: 'Bank Valas USD', tipeAkun: 'aset_bank' },
  { kode: '1121', nama: 'Piutang Usaha', tipeAkun: 'aset_piutang' },
  { kode: '1122', nama: 'Piutang Karyawan', tipeAkun: 'aset_lancar_lain' },
  { kode: '1123', nama: 'Piutang Lain-lain', tipeAkun: 'aset_lancar_lain' },
  { kode: '1129', nama: 'Cadangan Kerugian Piutang', tipeAkun: 'aset_lancar_lain' },
  { kode: '1131', nama: 'Persediaan Bahan Baku', tipeAkun: 'aset_persediaan' },
  { kode: '1132', nama: 'Persediaan Bahan Penolong', tipeAkun: 'aset_persediaan' },
  { kode: '1133', nama: 'Persediaan Barang Dalam Proses', tipeAkun: 'aset_persediaan' },
  { kode: '1134', nama: 'Persediaan Barang Jadi', tipeAkun: 'aset_persediaan' },
  { kode: '1135', nama: 'Persediaan Suku Cadang', tipeAkun: 'aset_persediaan' },
  { kode: '1141', nama: 'PPN Masukan', tipeAkun: 'aset_lancar_lain' },
  { kode: '1142', nama: 'PPh 23 Dibayar di Muka', tipeAkun: 'aset_lancar_lain' },
  { kode: '1143', nama: 'PPh 25 Dibayar di Muka', tipeAkun: 'aset_lancar_lain' },
  { kode: '1151', nama: 'Uang Muka Pembelian', tipeAkun: 'aset_lancar_lain' },
  { kode: '1152', nama: 'Biaya Dibayar di Muka', tipeAkun: 'aset_lancar_lain' },

  // ASET TIDAK LANCAR
  { kode: '1201', nama: 'Tanah', tipeAkun: 'aset_tetap' },
  { kode: '1202', nama: 'Bangunan', tipeAkun: 'aset_tetap' },
  { kode: '1203', nama: 'Mesin Produksi', tipeAkun: 'aset_tetap' },
  { kode: '1204', nama: 'Peralatan Pabrik', tipeAkun: 'aset_tetap' },
  { kode: '1205', nama: 'Kendaraan', tipeAkun: 'aset_tetap' },
  { kode: '1206', nama: 'Peralatan Kantor', tipeAkun: 'aset_tetap' },
  { kode: '1211', nama: 'Akumulasi Depresiasi Bangunan', tipeAkun: 'aset_akumulasi_depresiasi' },
  { kode: '1212', nama: 'Akumulasi Depresiasi Mesin Produksi', tipeAkun: 'aset_akumulasi_depresiasi' },
  { kode: '1213', nama: 'Akumulasi Depresiasi Peralatan Pabrik', tipeAkun: 'aset_akumulasi_depresiasi' },
  { kode: '1214', nama: 'Akumulasi Depresiasi Kendaraan', tipeAkun: 'aset_akumulasi_depresiasi' },
  { kode: '1215', nama: 'Akumulasi Depresiasi Peralatan Kantor', tipeAkun: 'aset_akumulasi_depresiasi' },
  { kode: '1291', nama: 'Aset Tidak Lancar Lainnya', tipeAkun: 'aset_tidak_lancar_lain' },

  // LIABILITAS JANGKA PENDEK
  { kode: '2101', nama: 'Utang Usaha', tipeAkun: 'liabilitas_utang_usaha' },
  { kode: '2102', nama: 'Utang Lain-lain', tipeAkun: 'liabilitas_jangka_pendek' },
  { kode: '2111', nama: 'PPN Keluaran', tipeAkun: 'liabilitas_pajak' },
  { kode: '2112', nama: 'Utang PPh 21', tipeAkun: 'liabilitas_pajak' },
  { kode: '2113', nama: 'Utang PPh 23', tipeAkun: 'liabilitas_pajak' },
  { kode: '2114', nama: 'Utang PPh 29', tipeAkun: 'liabilitas_pajak' },
  { kode: '2115', nama: 'Utang PPh Final', tipeAkun: 'liabilitas_pajak' },
  { kode: '2121', nama: 'Utang Gaji', tipeAkun: 'liabilitas_jangka_pendek' },
  { kode: '2122', nama: 'Biaya yang Masih Harus Dibayar', tipeAkun: 'liabilitas_jangka_pendek' },
  { kode: '2131', nama: 'Uang Muka Penjualan', tipeAkun: 'liabilitas_jangka_pendek' },
  { kode: '2141', nama: 'Utang Bank Jangka Pendek', tipeAkun: 'liabilitas_jangka_pendek' },

  // LIABILITAS JANGKA PANJANG
  { kode: '2201', nama: 'Utang Bank Jangka Panjang', tipeAkun: 'liabilitas_jangka_panjang' },
  { kode: '2202', nama: 'Utang Sewa Pembiayaan', tipeAkun: 'liabilitas_jangka_panjang' },

  // EKUITAS
  { kode: '3101', nama: 'Modal Disetor', tipeAkun: 'ekuitas' },
  { kode: '3102', nama: 'Tambahan Modal Disetor', tipeAkun: 'ekuitas' },
  { kode: '3201', nama: 'Laba Ditahan', tipeAkun: 'ekuitas_laba_ditahan' },
  { kode: '3202', nama: 'Laba Tahun Berjalan', tipeAkun: 'ekuitas_laba_berjalan' },
  { kode: '3301', nama: 'Prive dan Dividen', tipeAkun: 'ekuitas' },

  // PENDAPATAN
  { kode: '4101', nama: 'Penjualan Furnitur', tipeAkun: 'pendapatan' },
  { kode: '4102', nama: 'Penjualan Jasa Custom', tipeAkun: 'pendapatan' },
  { kode: '4109', nama: 'Retur Penjualan', tipeAkun: 'pendapatan' },
  { kode: '4110', nama: 'Potongan Penjualan', tipeAkun: 'pendapatan' },
  { kode: '4201', nama: 'Pendapatan Bunga', tipeAkun: 'pendapatan_lain' },
  { kode: '4202', nama: 'Laba Selisih Kurs', tipeAkun: 'pendapatan_lain' },
  { kode: '4203', nama: 'Pendapatan Lain-lain', tipeAkun: 'pendapatan_lain' },

  // HARGA POKOK PENJUALAN
  { kode: '5101', nama: 'HPP Bahan Baku', tipeAkun: 'beban_hpp' },
  { kode: '5102', nama: 'HPP Tenaga Kerja Langsung', tipeAkun: 'beban_hpp' },
  { kode: '5103', nama: 'HPP Overhead Pabrik', tipeAkun: 'beban_hpp' },
  { kode: '5104', nama: 'HPP Barang Jadi', tipeAkun: 'beban_hpp' },
  { kode: '5105', nama: 'Selisih Persediaan', tipeAkun: 'beban_hpp' },
  { kode: '5106', nama: 'Kerugian Barang Rusak', tipeAkun: 'beban_hpp' },

  // BEBAN OPERASIONAL
  { kode: '6101', nama: 'Beban Gaji dan Upah', tipeAkun: 'beban_operasional' },
  { kode: '6102', nama: 'Beban Tunjangan Karyawan', tipeAkun: 'beban_operasional' },
  { kode: '6103', nama: 'Beban BPJS', tipeAkun: 'beban_operasional' },
  { kode: '6111', nama: 'Beban Listrik dan Air', tipeAkun: 'beban_operasional' },
  { kode: '6112', nama: 'Beban Telepon dan Internet', tipeAkun: 'beban_operasional' },
  { kode: '6113', nama: 'Beban Sewa', tipeAkun: 'beban_operasional' },
  { kode: '6114', nama: 'Beban Perbaikan dan Pemeliharaan', tipeAkun: 'beban_operasional' },
  { kode: '6121', nama: 'Beban Pengiriman', tipeAkun: 'beban_operasional' },
  { kode: '6122', nama: 'Beban Pemasaran dan Promosi', tipeAkun: 'beban_operasional' },
  { kode: '6123', nama: 'Beban Perjalanan Dinas', tipeAkun: 'beban_operasional' },
  { kode: '6131', nama: 'Beban Alat Tulis Kantor', tipeAkun: 'beban_operasional' },
  { kode: '6132', nama: 'Beban Asuransi', tipeAkun: 'beban_operasional' },
  { kode: '6133', nama: 'Beban Jasa Profesional', tipeAkun: 'beban_operasional' },
  { kode: '6141', nama: 'Beban Administrasi Bank', tipeAkun: 'beban_operasional' },
  { kode: '6151', nama: 'Beban Depresiasi Bangunan', tipeAkun: 'beban_depresiasi' },
  { kode: '6152', nama: 'Beban Depresiasi Mesin Produksi', tipeAkun: 'beban_depresiasi' },
  { kode: '6153', nama: 'Beban Depresiasi Peralatan Pabrik', tipeAkun: 'beban_depresiasi' },
  { kode: '6154', nama: 'Beban Depresiasi Kendaraan', tipeAkun: 'beban_depresiasi' },
  { kode: '6155', nama: 'Beban Depresiasi Peralatan Kantor', tipeAkun: 'beban_depresiasi' },

  // PENDAPATAN DAN BEBAN LAIN
  { kode: '7101', nama: 'Beban Bunga', tipeAkun: 'beban_lain' },
  { kode: '7102', nama: 'Rugi Selisih Kurs', tipeAkun: 'beban_lain' },
  { kode: '7103', nama: 'Beban Lain-lain', tipeAkun: 'beban_lain' },
  { kode: '7104', nama: 'Selisih Pembulatan', tipeAkun: 'beban_lain' },

  // PAJAK PENGHASILAN
  { kode: '8101', nama: 'Beban Pajak Penghasilan', tipeAkun: 'beban_pajak' },
] as const

export const AKUN_PIUTANG_DEFAULT = '1121'
export const AKUN_UTANG_DEFAULT = '2101'
export const AKUN_LABA_DITAHAN = '3201'
export const AKUN_SELISIH_KURS_UNTUNG = '4202'
export const AKUN_SELISIH_KURS_RUGI = '7102'
export const AKUN_PEMBULATAN = '7104'
export const AKUN_PPN_KELUARAN = '2111'
export const AKUN_PPN_MASUKAN = '1141'
export const AKUN_PPH_23 = '2113'
export const AKUN_PPH_FINAL = '2115'
```

- [ ] **Step 2: Tulis data dasar selain bagan akun**

`src/db/seed/data-dasar.ts`:
```ts
export const MATA_UANG = [
  { kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 },
  { kode: 'USD', nama: 'Dolar Amerika Serikat', simbol: '$', desimal: 2 },
  { kode: 'EUR', nama: 'Euro', simbol: '€', desimal: 2 },
]

/** Kurs contoh; perbarui lewat menu Mata Uang & Kurs sesuai kurs yang berlaku. */
export const KURS_CONTOH = [
  { kodeMataUang: 'USD', tanggal: '2026-01-01', kurs: '16250.000000' },
  { kodeMataUang: 'EUR', tanggal: '2026-01-01', kurs: '17600.000000' },
]

export const SYARAT_PEMBAYARAN = [
  { nama: 'Tunai', jumlahHari: 0, catatan: 'Dibayar saat penyerahan' },
  { nama: 'Net 14', jumlahHari: 14, catatan: null },
  { nama: 'Net 30', jumlahHari: 30, catatan: null },
  { nama: 'Net 60', jumlahHari: 60, catatan: null },
]

export const JURNAL_STANDAR = [
  { kode: 'PNJ', nama: 'Jurnal Penjualan', tipe: 'penjualan', prefixNomor: 'FJ', resetNomor: 'bulanan' },
  { kode: 'PMB', nama: 'Jurnal Pembelian', tipe: 'pembelian', prefixNomor: 'FB', resetNomor: 'bulanan' },
  { kode: 'KAS', nama: 'Jurnal Kas', tipe: 'kas', prefixNomor: 'BK', resetNomor: 'bulanan' },
  { kode: 'BNK', nama: 'Jurnal Bank', tipe: 'bank', prefixNomor: 'BB', resetNomor: 'bulanan' },
  { kode: 'JU', nama: 'Jurnal Umum', tipe: 'umum', prefixNomor: 'JU', resetNomor: 'bulanan' },
  { kode: 'JPS', nama: 'Jurnal Penyesuaian Persediaan', tipe: 'umum', prefixNomor: 'JPS', resetNomor: 'bulanan' },
] as const

/**
 * Tarif berlaku saat seed disusun dan dapat diubah lewat menu Pajak
 * tanpa penerapan ulang bila regulasi berubah.
 */
export const PAJAK_STANDAR = [
  {
    kode: 'PPN-K-11', nama: 'PPN Keluaran 11%', ruangLingkup: 'penjualan',
    tarif: '11', hargaTermasukPajak: false, isPemotongan: false, kodeAkun: '2111',
  },
  {
    kode: 'PPN-M-11', nama: 'PPN Masukan 11%', ruangLingkup: 'pembelian',
    tarif: '11', hargaTermasukPajak: false, isPemotongan: false, kodeAkun: '1141',
  },
  {
    kode: 'PPH23-2', nama: 'PPh 23 Jasa 2%', ruangLingkup: 'pembelian',
    tarif: '2', hargaTermasukPajak: false, isPemotongan: true, kodeAkun: '2113',
  },
  {
    kode: 'PPHF-05', nama: 'PPh Final 0,5%', ruangLingkup: 'penjualan',
    tarif: '0.5', hargaTermasukPajak: false, isPemotongan: true, kodeAkun: '2115',
  },
] as const
```

- [ ] **Step 3: Tulis skrip seed**

`src/db/seed/index.ts`:
```ts
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db, koneksi } from '@/db/klien'
import {
  users, roles, permissions, rolePermissions, userRoles,
  companySettings, fiscalYears, currencies, currencyRates,
  accounts, paymentTerms, taxes, journals, sequences,
} from '@/db/schema'
import { daftarKodeIzin } from '@/lib/navigasi'
import { hashKataSandi } from '@/modules/identitas/layanan/kata-sandi'
import {
  BAGAN_AKUN_STANDAR, AKUN_LABA_DITAHAN, AKUN_SELISIH_KURS_UNTUNG,
  AKUN_SELISIH_KURS_RUGI, AKUN_PEMBULATAN,
} from './bagan-akun'
import { MATA_UANG, KURS_CONTOH, SYARAT_PEMBAYARAN, JURNAL_STANDAR, PAJAK_STANDAR } from './data-dasar'

/**
 * Seed bersifat idempoten: setiap penyisipan memakai onConflictDoNothing
 * sehingga menjalankannya berulang kali aman dan tidak menggandakan data.
 */
export async function jalankanSeed(): Promise<void> {
  // 1. Mata uang dan kurs
  await db.insert(currencies).values(MATA_UANG).onConflictDoNothing()
  await db.insert(currencyRates).values(KURS_CONTOH).onConflictDoNothing()

  // 2. Bagan akun
  await db.insert(accounts).values(
    BAGAN_AKUN_STANDAR.map((a) => ({ ...a, tipeAkun: a.tipeAkun as never })),
  ).onConflictDoNothing()

  const semuaAkun = await db.select().from(accounts)
  const akunLewatKode = new Map(semuaAkun.map((a) => [a.kode, a.id]))

  function akunId(kode: string): string {
    const id = akunLewatKode.get(kode)
    if (!id) throw new Error(`Akun ${kode} tidak ditemukan setelah seed bagan akun`)
    return id
  }

  // 3. Syarat pembayaran
  await db.insert(paymentTerms).values(SYARAT_PEMBAYARAN).onConflictDoNothing()

  // 4. Pajak
  await db.insert(taxes).values(
    PAJAK_STANDAR.map((p) => ({
      kode: p.kode,
      nama: p.nama,
      ruangLingkup: p.ruangLingkup as never,
      tarif: p.tarif,
      hargaTermasukPajak: p.hargaTermasukPajak,
      isPemotongan: p.isPemotongan,
      akunPajakId: akunId(p.kodeAkun),
    })),
  ).onConflictDoNothing()

  // 5. Jurnal beserta urutan penomorannya
  for (const j of JURNAL_STANDAR) {
    const [sudahAda] = await db.select({ id: journals.id }).from(journals)
      .where(eq(journals.kode, j.kode)).limit(1)
    if (sudahAda) continue

    await db.transaction(async (tx) => {
      const [urutan] = await tx.insert(sequences).values({
        kode: `jurnal:${j.kode}`,
        prefix: j.prefixNomor,
        panjangDigit: 4,
        nomorBerikut: 1,
        reset: j.resetNomor as never,
      }).returning()

      await tx.insert(journals).values({
        kode: j.kode, nama: j.nama, tipe: j.tipe as never, sequenceId: urutan.id,
      })
    })
  }

  // 6. Pengaturan perusahaan
  const [pengaturan] = await db.select().from(companySettings).limit(1)
  if (!pengaturan) {
    await db.insert(companySettings).values({
      nama: 'PT Furni Nusantara',
      mataUangFungsional: 'IDR',
      bulanAwalTahunBuku: 1,
      akunLabaDitahanId: akunId(AKUN_LABA_DITAHAN),
      akunSelisihKursUntungId: akunId(AKUN_SELISIH_KURS_UNTUNG),
      akunSelisihKursRugiId: akunId(AKUN_SELISIH_KURS_RUGI),
      akunPembulatanId: akunId(AKUN_PEMBULATAN),
    })
  }

  // 7. Tahun buku
  await db.insert(fiscalYears).values({
    nama: 'Tahun Buku 2026',
    tanggalMulai: '2026-01-01',
    tanggalSelesai: '2026-12-31',
    status: 'terbuka',
  }).onConflictDoNothing()

  // 8. Izin — seluruh kode dari seluruh fase, ditambah wildcard superuser
  const kodeIzin = ['*', ...daftarKodeIzin()]
  await db.insert(permissions).values(
    kodeIzin.map((kode) => ({
      kode,
      modul: kode === '*' ? 'sistem' : kode.split('.')[0],
      deskripsi: kode === '*' ? 'Akses penuh ke seluruh modul' : null,
    })),
  ).onConflictDoNothing()

  // 9. Peran superuser
  await db.insert(roles).values({
    kode: 'superuser', nama: 'Superuser', isSystem: true,
  }).onConflictDoNothing()

  const [peranSuperuser] = await db.select().from(roles).where(eq(roles.kode, 'superuser')).limit(1)
  const [izinWildcard] = await db.select().from(permissions).where(eq(permissions.kode, '*')).limit(1)
  await db.insert(rolePermissions).values({
    roleId: peranSuperuser.id, permissionId: izinWildcard.id,
  }).onConflictDoNothing()

  // 10. Pengguna administrator
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@furni.local'
  const kataSandi = process.env.SEED_ADMIN_PASSWORD
  if (!kataSandi) {
    throw new Error('SEED_ADMIN_PASSWORD wajib diatur sebelum menjalankan seed')
  }

  const [sudahAda] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  const pengguna = sudahAda ?? (await db.insert(users).values({
    email, nama: 'Administrator', passwordHash: await hashKataSandi(kataSandi),
  }).returning())[0]

  await db.insert(userRoles).values({
    userId: pengguna.id, roleId: peranSuperuser.id,
  }).onConflictDoNothing()
}

if (process.argv[1]?.includes('seed')) {
  jalankanSeed()
    .then(async () => {
      console.log('Seed data awal selesai.')
      await koneksi.end()
    })
    .catch(async (galat) => {
      console.error(galat)
      await koneksi.end()
      process.exit(1)
    })
}
```

- [ ] **Step 4: Tambahkan skrip seed ke package.json**

Tambahkan ke bagian `"scripts"`:
```json
{
  "db:seed": "tsx src/db/seed/index.ts"
}
```

Agar alias `@/` bekerja pada `tsx`, pastikan `tsconfig.json` memuat `"paths": { "@/*": ["./src/*"] }` (sudah disiapkan create-next-app). Bila `tsx` tetap gagal mengurai alias, pasang dan aktifkan resolver:
```bash
pnpm add -D tsconfig-paths
```
lalu ubah skrip menjadi `"db:seed": "tsx --tsconfig tsconfig.json src/db/seed/index.ts"`.

- [ ] **Step 5: Tulis pengujian seed yang gagal**

`tests/db/seed.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  accounts, taxes, journals, sequences, currencies, paymentTerms,
  users, roles, permissions, userRoles, companySettings, fiscalYears,
} from '@/db/schema'
import { jalankanSeed } from '@/db/seed'
import { BAGAN_AKUN_STANDAR } from '@/db/seed/bagan-akun'
import { daftarKodeIzin } from '@/lib/navigasi'
import { cariPenggunaLewatEmail } from '@/modules/identitas/repositori/pengguna'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const TABEL = [
  'audit_logs', 'user_roles', 'role_permissions', 'permissions', 'roles', 'users',
  'journals', 'taxes', 'partners', 'payment_terms', 'company_settings',
  'fiscal_years', 'sequences', 'accounts', 'currency_rates', 'currencies',
]

beforeAll(async () => {
  await bersihkanTabel(TABEL)
  process.env.SEED_ADMIN_EMAIL = 'admin@furni.local'
  process.env.SEED_ADMIN_PASSWORD = 'rahasia123'
  await jalankanSeed()
})
afterAll(async () => { await tutupKoneksi() })

describe('seed — bagan akun', () => {
  it('memuat seluruh akun standar', async () => {
    const tersimpan = await db.select().from(accounts)
    expect(tersimpan).toHaveLength(BAGAN_AKUN_STANDAR.length)
  })

  it('tidak memuat kode akun ganda', () => {
    const kode = BAGAN_AKUN_STANDAR.map((a) => a.kode)
    expect(new Set(kode).size).toBe(kode.length)
  })

  it('mencakup kelima kelompok laporan', async () => {
    const tersimpan = await db.select().from(accounts)
    const awalan = new Set(tersimpan.map((a) => a.tipeAkun.split('_')[0]))
    expect(awalan).toContain('aset')
    expect(awalan).toContain('liabilitas')
    expect(awalan).toContain('ekuitas')
    expect(awalan).toContain('pendapatan')
    expect(awalan).toContain('beban')
  })

  it('memuat tepat satu akun laba tahun berjalan', async () => {
    const hasil = await db.select().from(accounts)
      .where(eq(accounts.tipeAkun, 'ekuitas_laba_berjalan'))
    expect(hasil).toHaveLength(1)
  })
})

describe('seed — data dasar', () => {
  it('memuat tiga mata uang dengan IDR di antaranya', async () => {
    const hasil = await db.select().from(currencies)
    expect(hasil).toHaveLength(3)
    expect(hasil.map((c) => c.kode)).toContain('IDR')
  })

  it('memuat empat syarat pembayaran', async () => {
    expect(await db.select().from(paymentTerms)).toHaveLength(4)
  })

  it('memuat empat jenis pajak yang seluruhnya menunjuk akun yang ada', async () => {
    const hasil = await db.select().from(taxes)
    expect(hasil).toHaveLength(4)
    for (const pajak of hasil) {
      const [akun] = await db.select().from(accounts).where(eq(accounts.id, pajak.akunPajakId))
      expect(akun, `akun pajak ${pajak.kode} tidak ditemukan`).toBeDefined()
    }
  })

  it('memuat enam jurnal yang masing-masing punya urutan penomoran', async () => {
    const hasil = await db.select().from(journals)
    expect(hasil).toHaveLength(6)
    for (const jurnal of hasil) {
      const [urutan] = await db.select().from(sequences).where(eq(sequences.id, jurnal.sequenceId))
      expect(urutan, `urutan untuk jurnal ${jurnal.kode} tidak ditemukan`).toBeDefined()
      expect(urutan.nomorBerikut).toBe(1)
    }
  })

  it('mengisi pengaturan perusahaan beserta akun default yang sah', async () => {
    const [pengaturan] = await db.select().from(companySettings)
    expect(pengaturan.mataUangFungsional).toBe('IDR')
    expect(pengaturan.akunLabaDitahanId).not.toBeNull()
    expect(pengaturan.akunSelisihKursUntungId).not.toBeNull()
    expect(pengaturan.akunSelisihKursRugiId).not.toBeNull()
    expect(pengaturan.akunPembulatanId).not.toBeNull()
  })

  it('membuat satu tahun buku yang terbuka', async () => {
    const [tahun] = await db.select().from(fiscalYears)
    expect(tahun.status).toBe('terbuka')
  })
})

describe('seed — identitas', () => {
  it('memuat seluruh kode izin dari navigasi ditambah wildcard', async () => {
    const tersimpan = await db.select().from(permissions)
    expect(tersimpan).toHaveLength(daftarKodeIzin().length + 1)
    expect(tersimpan.map((p) => p.kode)).toContain('*')
  })

  it('membuat peran superuser sebagai peran sistem', async () => {
    const [peran] = await db.select().from(roles).where(eq(roles.kode, 'superuser'))
    expect(peran.isSystem).toBe(true)
  })

  it('memberi administrator izin wildcard', async () => {
    const pengguna = await cariPenggunaLewatEmail('admin@furni.local')
    expect(pengguna).not.toBeNull()
    expect(pengguna!.izin).toEqual(['*'])
  })

  it('menyimpan kata sandi dalam bentuk hash, bukan teks polos', async () => {
    const pengguna = await cariPenggunaLewatEmail('admin@furni.local')
    expect(pengguna!.passwordHash).not.toBe('rahasia123')
  })

  it('menugaskan tepat satu peran kepada administrator', async () => {
    const [{ jumlah }] = await db
      .select({ jumlah: sql<number>`count(*)::int` })
      .from(userRoles)
    expect(jumlah).toBe(1)
  })
})

describe('seed — idempotensi', () => {
  it('tidak menggandakan data saat dijalankan dua kali', async () => {
    await jalankanSeed()
    expect(await db.select().from(accounts)).toHaveLength(BAGAN_AKUN_STANDAR.length)
    expect(await db.select().from(journals)).toHaveLength(6)
    expect(await db.select().from(taxes)).toHaveLength(4)
    expect(await db.select().from(users)).toHaveLength(1)
    expect(await db.select().from(userRoles)).toHaveLength(1)
    expect(await db.select().from(companySettings)).toHaveLength(1)
    expect(await db.select().from(sequences)).toHaveLength(6)
  })
})

describe('seed — kegagalan yang disengaja', () => {
  it('menolak berjalan tanpa SEED_ADMIN_PASSWORD', async () => {
    const asli = process.env.SEED_ADMIN_PASSWORD
    delete process.env.SEED_ADMIN_PASSWORD
    await expect(jalankanSeed()).rejects.toThrow('SEED_ADMIN_PASSWORD wajib diatur')
    process.env.SEED_ADMIN_PASSWORD = asli
  })
})
```

Pengujian idempotensi penting karena seed akan dijalankan berulang kali selama pengembangan; seed yang menggandakan data akan menghasilkan kebingungan yang sulit dilacak.

- [ ] **Step 6: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/db/seed.test.ts`
Expected: GAGAL pada impor `@/db/seed`

- [ ] **Step 7: Jalankan pengujian untuk memastikan lulus**

Setelah ketiga berkas seed di atas ditulis:

Run: `pnpm vitest run tests/db/seed.test.ts`
Expected: SELURUH pengujian LULUS

- [ ] **Step 8: Jalankan seed pada basis data pengembangan**

Pastikan `.env.local` memuat `SEED_ADMIN_EMAIL` dan `SEED_ADMIN_PASSWORD`, lalu:

```bash
pnpm db:migrate && pnpm db:seed
```

Expected: keluaran `Seed data awal selesai.`

- [ ] **Step 9: Verifikasi menengah di peramban**

```bash
pnpm dev
```

Tujuh menu Fase 1 belum memiliki halaman pada tahap ini dan akan menampilkan 404: Dasbor Akuntansi, Mata Uang & Kurs, Tahun Buku & Penguncian, Profil Perusahaan, Pengguna, Peran & Hak Akses, dan Penomoran Dokumen. Ketujuhnya dibangun pada Task 15 dan 16; abaikan dulu di sini.

Periksa berurutan dan pastikan seluruhnya berhasil:

1. `http://localhost:3000` mengalihkan ke `/masuk`
2. Login dengan kredensial dari `.env.local` berhasil dan mendarat di `/dasbor`
3. Sidebar memuat empat grup fase 1: Dasbor, Kontak, Akuntansi, Pengaturan
4. Membuka satu grup menutup grup yang lain
5. `Ctrl+K` membuka palet perintah; mengetik "bagan" memunculkan menu Bagan Akun
6. Halaman Bagan Akun memuat seluruh akun hasil seed dengan tipe berbahasa Indonesia
7. Menambah akun baru berhasil dan muncul di daftar
8. Menambah akun dengan kode yang sudah ada menampilkan pesan "Kode akun … sudah digunakan"
9. Halaman Pajak memuat empat pajak dengan tarif yang benar
10. Halaman Jurnal memuat enam jurnal
11. Halaman Syarat Pembayaran memuat empat syarat, terurut dari Tunai
12. Menambah mitra usaha dengan NPWP berformat titik berhasil, dan NPWP tampil terformat di tabel
13. Menambah mitra tanpa mencentang Pelanggan maupun Pemasok ditolak dengan pesan yang jelas
14. Halaman Log Aktivitas memuat jejak penambahan akun dan mitra pada langkah 7 dan 12
15. Menu Keluar mengembalikan ke halaman masuk, dan membuka `/dasbor` setelahnya mengalihkan kembali ke `/masuk`

- [ ] **Step 10: Jalankan verifikasi akhir**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: seluruh pengujian LULUS, tidak ada galat tipe, dan build berhasil

Catat jumlah pengujian yang lulus. Bila ada yang gagal, perbaiki sebelum commit — jangan melanjutkan ke Fase 1B dengan pengujian yang gagal.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(db): data awal bagan akun Indonesia dan konfigurasi standar

Memuat 86 akun standar untuk manufaktur furnitur, empat jenis pajak
Indonesia, enam jurnal beserta urutan penomorannya, tiga mata uang,
empat syarat pembayaran, tahun buku 2026, seluruh kode izin dari tujuh
fase, dan satu pengguna superuser. Seed bersifat idempoten sehingga aman
dijalankan berulang kali."
```

---

## Task 15: Konfigurasi Akuntansi — Mata Uang, Tahun Buku, dan Dasbor

Melengkapi tiga menu Fase 1 di grup Akuntansi yang skemanya sudah ada sejak Task 7 dan 8 tetapi belum memiliki antarmuka.

**Files:**
- Create: `src/modules/akuntansi/validasi/konfigurasi.ts`
- Create: `src/modules/akuntansi/repositori/konfigurasi.ts`
- Create: `src/modules/akuntansi/layanan/konfigurasi.ts`
- Create: `src/app/(app)/akuntansi/page.tsx`
- Create: `src/app/(app)/akuntansi/konfigurasi/mata-uang/page.tsx`, `aksi.ts`, `dialog-kurs.tsx`
- Create: `src/app/(app)/akuntansi/konfigurasi/tahun-buku/page.tsx`, `aksi.ts`, `formulir-penguncian.tsx`
- Test: `tests/akuntansi/konfigurasi.test.ts`

**Interfaces:**
- Consumes: `ambilKurs`, `MATA_UANG_FUNGSIONAL` dari Task 8; `formatTanggalIndonesia` dari Task 7; `ValidasiError` dari `@/modules/akuntansi/layanan/akun`; `TabelData`, `KepalaHalaman` dari Task 9
- Produces (dari `@/modules/akuntansi/layanan/konfigurasi`):
  - `daftarMataUang(): Promise<MataUang[]>` dan `daftarKurs(kodeMataUang?: string): Promise<BarisKurs[]>`
  - `catatKurs(masukan: MasukanKurs): Promise<void>` — menimpa kurs pada tanggal yang sama
  - `daftarTahunBuku(): Promise<TahunBuku[]>` dan `buatTahunBuku(masukan: MasukanTahunBuku): Promise<TahunBuku>`
  - `ambilPengaturan(): Promise<Pengaturan | null>` dan `aturTanggalKunciBuku(tanggal: string | null): Promise<void>`
  - `simpanProfilPerusahaan(masukan: MasukanPerusahaan): Promise<void>` — dipakai halaman Profil Perusahaan pada Task 16
  - `skemaPerusahaan` dan `type MasukanPerusahaan` dari `@/modules/akuntansi/validasi/konfigurasi`
  - `type MataUang = typeof currencies.$inferSelect`, `type TahunBuku = typeof fiscalYears.$inferSelect`
  - `type BarisKurs = { id: string; kodeMataUang: string; tanggal: string; kurs: string }`

- [ ] **Step 1: Tulis pengujian konfigurasi yang gagal**

`tests/akuntansi/konfigurasi.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/klien'
import { currencies, companySettings } from '@/db/schema'
import {
  catatKurs, daftarKurs, buatTahunBuku, daftarTahunBuku,
  aturTanggalKunciBuku, ambilPengaturan, simpanProfilPerusahaan,
} from '@/modules/akuntansi/layanan/konfigurasi'
import { ambilKurs } from '@/modules/akuntansi/layanan/kurs'
import { wajibPeriodeTerbuka } from '@/modules/akuntansi/layanan/penguncian'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const TABEL = ['currency_rates', 'currencies', 'fiscal_years', 'company_settings']

beforeEach(async () => {
  await bersihkanTabel(TABEL)
  await db.insert(currencies).values([
    { kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 },
    { kode: 'USD', nama: 'Dolar Amerika Serikat', simbol: '$', desimal: 2 },
  ])
  await db.insert(companySettings).values({ nama: 'PT Furni Nusantara' })
})
afterAll(async () => { await tutupKoneksi() })

describe('catatKurs', () => {
  it('menyimpan kurs baru', async () => {
    await catatKurs({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '16250' })
    expect(await ambilKurs('USD', new Date('2026-09-08'))).toBe('16250')
  })

  it('menimpa kurs pada tanggal yang sama alih-alih menggandakannya', async () => {
    await catatKurs({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '16250' })
    await catatKurs({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '16400' })
    expect(await daftarKurs('USD')).toHaveLength(1)
    expect(await ambilKurs('USD', new Date('2026-09-08'))).toBe('16400')
  })

  it('menolak kurs nol atau negatif', async () => {
    await expect(catatKurs({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '0' }))
      .rejects.toThrow('Kurs harus lebih besar dari nol')
    await expect(catatKurs({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '-100' }))
      .rejects.toThrow('Kurs harus lebih besar dari nol')
  })

  it('menolak pencatatan kurs untuk mata uang fungsional', async () => {
    await expect(catatKurs({ kodeMataUang: 'IDR', tanggal: '2026-09-08', kurs: '1' }))
      .rejects.toThrow('Mata uang fungsional tidak memerlukan kurs')
  })

  it('menolak mata uang yang tidak terdaftar', async () => {
    await expect(catatKurs({ kodeMataUang: 'JPY', tanggal: '2026-09-08', kurs: '110' }))
      .rejects.toThrow('Mata uang JPY tidak terdaftar')
  })

  it('mengurutkan daftar kurs dari yang terbaru', async () => {
    await catatKurs({ kodeMataUang: 'USD', tanggal: '2026-09-01', kurs: '16000' })
    await catatKurs({ kodeMataUang: 'USD', tanggal: '2026-09-08', kurs: '16250' })
    expect((await daftarKurs('USD')).map((k) => k.tanggal)).toEqual(['2026-09-08', '2026-09-01'])
  })
})

describe('buatTahunBuku', () => {
  it('menyimpan tahun buku baru dalam keadaan terbuka', async () => {
    const tahun = await buatTahunBuku({
      nama: 'Tahun Buku 2026', tanggalMulai: '2026-01-01', tanggalSelesai: '2026-12-31',
    })
    expect(tahun.status).toBe('terbuka')
  })

  it('menolak tanggal selesai yang mendahului tanggal mulai', async () => {
    await expect(buatTahunBuku({
      nama: 'Terbalik', tanggalMulai: '2026-12-31', tanggalSelesai: '2026-01-01',
    })).rejects.toThrow('Tanggal selesai harus setelah tanggal mulai')
  })

  it('menolak nama tahun buku ganda', async () => {
    const masukan = {
      nama: 'Tahun Buku 2026', tanggalMulai: '2026-01-01', tanggalSelesai: '2026-12-31',
    }
    await buatTahunBuku(masukan)
    await expect(buatTahunBuku(masukan)).rejects.toThrow('Tahun buku Tahun Buku 2026 sudah ada')
  })

  it('menolak rentang yang bertumpang tindih dengan tahun buku lain', async () => {
    await buatTahunBuku({
      nama: 'Tahun Buku 2026', tanggalMulai: '2026-01-01', tanggalSelesai: '2026-12-31',
    })
    await expect(buatTahunBuku({
      nama: 'Tahun Buku Tumpang Tindih', tanggalMulai: '2026-07-01', tanggalSelesai: '2027-06-30',
    })).rejects.toThrow('bertumpang tindih')
  })

  it('menerima tahun buku yang bersambungan tanpa tumpang tindih', async () => {
    await buatTahunBuku({
      nama: 'Tahun Buku 2026', tanggalMulai: '2026-01-01', tanggalSelesai: '2026-12-31',
    })
    await expect(buatTahunBuku({
      nama: 'Tahun Buku 2027', tanggalMulai: '2027-01-01', tanggalSelesai: '2027-12-31',
    })).resolves.toBeTruthy()
  })

  it('mengurutkan daftar dari tahun terbaru', async () => {
    await buatTahunBuku({ nama: '2026', tanggalMulai: '2026-01-01', tanggalSelesai: '2026-12-31' })
    await buatTahunBuku({ nama: '2027', tanggalMulai: '2027-01-01', tanggalSelesai: '2027-12-31' })
    expect((await daftarTahunBuku()).map((t) => t.nama)).toEqual(['2027', '2026'])
  })
})

describe('aturTanggalKunciBuku', () => {
  it('menyimpan tanggal kunci dan langsung berlaku pada penguncian periode', async () => {
    await aturTanggalKunciBuku('2026-08-31')
    expect((await ambilPengaturan())!.tanggalKunciBuku).toBe('2026-08-31')
    await expect(wajibPeriodeTerbuka(new Date('2026-08-15'))).rejects.toThrow('terkunci')
    await expect(wajibPeriodeTerbuka(new Date('2026-09-01'))).resolves.toBeUndefined()
  })

  it('mengizinkan pembukaan kembali dengan mengosongkan tanggal kunci', async () => {
    await aturTanggalKunciBuku('2026-08-31')
    await aturTanggalKunciBuku(null)
    expect((await ambilPengaturan())!.tanggalKunciBuku).toBeNull()
    await expect(wajibPeriodeTerbuka(new Date('2020-01-01'))).resolves.toBeUndefined()
  })

  it('menolak pemunduran tanggal kunci ke masa lalu', async () => {
    await aturTanggalKunciBuku('2026-08-31')
    await expect(aturTanggalKunciBuku('2026-07-31'))
      .rejects.toThrow('Tanggal kunci tidak boleh dimundurkan')
  })

  it('melempar galat bila pengaturan perusahaan belum ada', async () => {
    await bersihkanTabel(['company_settings'])
    await expect(aturTanggalKunciBuku('2026-08-31'))
      .rejects.toThrow('Pengaturan perusahaan belum dibuat')
  })
})

describe('simpanProfilPerusahaan', () => {
  it('menyimpan perubahan profil', async () => {
    await simpanProfilPerusahaan({
      nama: 'PT Furni Nusantara Jaya', npwp: '01.234.567.8-901.000', kota: 'Jepara',
    })
    const pengaturan = await ambilPengaturan()
    expect(pengaturan!.nama).toBe('PT Furni Nusantara Jaya')
    expect(pengaturan!.kota).toBe('Jepara')
  })

  it('menormalkan NPWP menjadi angka saja', async () => {
    await simpanProfilPerusahaan({ nama: 'PT Uji', npwp: '01.234.567.8-901.000' })
    expect((await ambilPengaturan())!.npwp).toBe('012345678901000')
  })

  it('menolak nama perusahaan kosong', async () => {
    await expect(simpanProfilPerusahaan({ nama: '   ' }))
      .rejects.toThrow('Nama perusahaan wajib diisi')
  })

  it('menolak NPWP yang panjangnya tidak sah', async () => {
    await expect(simpanProfilPerusahaan({ nama: 'PT Uji', npwp: '12345' }))
      .rejects.toThrow('NPWP harus 15 atau 16 digit')
  })

  it('menolak email yang formatnya tidak sah', async () => {
    await expect(simpanProfilPerusahaan({ nama: 'PT Uji', email: 'bukan-email' }))
      .rejects.toThrow('Format email tidak sah')
  })

  it('tidak menyentuh tanggal kunci buku', async () => {
    await aturTanggalKunciBuku('2026-08-31')
    await simpanProfilPerusahaan({ nama: 'PT Uji' })
    expect((await ambilPengaturan())!.tanggalKunciBuku).toBe('2026-08-31')
  })
})
```

Penolakan pemunduran tanggal kunci adalah pengaman: membuka kembali periode yang sudah ditutup memungkinkan perubahan pada laporan yang mungkin sudah dilaporkan ke pihak luar. Pengosongan penuh tetap diizinkan karena itu tindakan yang jelas disengaja, bukan pergeseran diam-diam.

- [ ] **Step 2: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/akuntansi/konfigurasi.test.ts`
Expected: GAGAL pada impor modul konfigurasi

- [ ] **Step 3: Tulis validasi konfigurasi**

`src/modules/akuntansi/validasi/konfigurasi.ts`:
```ts
import { z } from 'zod'
import { normalkanNpwp } from './partner'

const tanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')

const teksOpsional = z.string().trim().max(200).nullable().default(null)
  .transform((v) => (v === '' ? null : v))

export const skemaPerusahaan = z.object({
  nama: z.string().trim().min(1, 'Nama perusahaan wajib diisi').max(150),
  npwp: z.string().nullable().default(null)
    .transform((v) => (v ? normalkanNpwp(v) : null))
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || v.length === 15 || v.length === 16, {
      message: 'NPWP harus 15 atau 16 digit',
    }),
  alamat: teksOpsional,
  kota: teksOpsional,
  provinsi: teksOpsional,
  kodePos: teksOpsional,
  telepon: teksOpsional,
  email: z.string().trim().nullable().default(null)
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || z.string().email().safeParse(v).success, {
      message: 'Format email tidak sah',
    }),
})

export const skemaKurs = z.object({
  kodeMataUang: z.string().trim().length(3, 'Kode mata uang harus 3 huruf'),
  tanggal: tanggalIso,
  kurs: z.string().trim()
    .refine((v) => /^\d+(\.\d+)?$/.test(v), { message: 'Kurs harus berupa angka' })
    .refine((v) => Number(v) > 0, { message: 'Kurs harus lebih besar dari nol' }),
})

export const skemaTahunBuku = z.object({
  nama: z.string().trim().min(1, 'Nama tahun buku wajib diisi').max(60),
  tanggalMulai: tanggalIso,
  tanggalSelesai: tanggalIso,
}).refine((d) => d.tanggalSelesai > d.tanggalMulai, {
  message: 'Tanggal selesai harus setelah tanggal mulai',
  path: ['tanggalSelesai'],
})

export type MasukanKurs = z.input<typeof skemaKurs>
export type MasukanTahunBuku = z.input<typeof skemaTahunBuku>
export type MasukanPerusahaan = z.input<typeof skemaPerusahaan>
```

- [ ] **Step 4: Tulis repositori konfigurasi**

`src/modules/akuntansi/repositori/konfigurasi.ts`:
```ts
import { and, asc, desc, eq, gte, lte, or } from 'drizzle-orm'
import { db } from '@/db/klien'
import { currencies, currencyRates, fiscalYears, companySettings } from '@/db/schema'

export type MataUang = typeof currencies.$inferSelect
export type TahunBuku = typeof fiscalYears.$inferSelect
export type Pengaturan = typeof companySettings.$inferSelect
export type BarisKurs = { id: string; kodeMataUang: string; tanggal: string; kurs: string }

export async function ambilSemuaMataUang(): Promise<MataUang[]> {
  return db.select().from(currencies).orderBy(asc(currencies.kode))
}

export async function mataUangAda(kode: string): Promise<boolean> {
  const [ada] = await db.select({ kode: currencies.kode }).from(currencies)
    .where(eq(currencies.kode, kode)).limit(1)
  return Boolean(ada)
}

export async function ambilSemuaKurs(kodeMataUang?: string): Promise<BarisKurs[]> {
  const kueri = db.select({
    id: currencyRates.id,
    kodeMataUang: currencyRates.kodeMataUang,
    tanggal: currencyRates.tanggal,
    kurs: currencyRates.kurs,
  }).from(currencyRates).orderBy(desc(currencyRates.tanggal), asc(currencyRates.kodeMataUang))

  return kodeMataUang ? kueri.where(eq(currencyRates.kodeMataUang, kodeMataUang)) : kueri
}

/** Menimpa kurs bila tanggal dan mata uangnya sudah tercatat. */
export async function simpanKurs(
  kodeMataUang: string, tanggal: string, kurs: string,
): Promise<void> {
  await db.insert(currencyRates)
    .values({ kodeMataUang, tanggal, kurs })
    .onConflictDoUpdate({
      target: [currencyRates.kodeMataUang, currencyRates.tanggal],
      set: { kurs },
    })
}

export async function ambilSemuaTahunBuku(): Promise<TahunBuku[]> {
  return db.select().from(fiscalYears).orderBy(desc(fiscalYears.tanggalMulai))
}

export async function namaTahunBukuTerpakai(nama: string): Promise<boolean> {
  const [ada] = await db.select({ id: fiscalYears.id }).from(fiscalYears)
    .where(eq(fiscalYears.nama, nama)).limit(1)
  return Boolean(ada)
}

export async function adaTahunBukuBertumpangTindih(
  tanggalMulai: string, tanggalSelesai: string,
): Promise<boolean> {
  const [ada] = await db.select({ id: fiscalYears.id }).from(fiscalYears)
    .where(and(
      lte(fiscalYears.tanggalMulai, tanggalSelesai),
      gte(fiscalYears.tanggalSelesai, tanggalMulai),
    ))
    .limit(1)
  return Boolean(ada)
}

export async function sisipkanTahunBuku(
  nilai: typeof fiscalYears.$inferInsert,
): Promise<TahunBuku> {
  const [tahun] = await db.insert(fiscalYears).values(nilai).returning()
  return tahun
}

export async function ambilPengaturanPerusahaan(): Promise<Pengaturan | null> {
  const [pengaturan] = await db.select().from(companySettings).limit(1)
  return pengaturan ?? null
}

export async function perbaruiPengaturanPerusahaan(
  id: string, nilai: Partial<typeof companySettings.$inferInsert>,
): Promise<void> {
  await db.update(companySettings)
    .set({ ...nilai, diubahPada: new Date() })
    .where(eq(companySettings.id, id))
}
```

Dua rentang tanggal bertumpang tindih bila yang satu dimulai sebelum yang lain berakhir dan berakhir setelah yang lain dimulai. Rumus ini menangkap seluruh bentuk tumpang tindih, termasuk pembungkusan penuh, dalam satu kondisi.

- [ ] **Step 5: Tulis layanan konfigurasi**

`src/modules/akuntansi/layanan/konfigurasi.ts`:
```ts
import {
  skemaKurs, skemaTahunBuku, skemaPerusahaan,
  type MasukanKurs, type MasukanTahunBuku, type MasukanPerusahaan,
} from '../validasi/konfigurasi'
import * as repo from '../repositori/konfigurasi'
import type { MataUang, TahunBuku, Pengaturan, BarisKurs } from '../repositori/konfigurasi'
import { MATA_UANG_FUNGSIONAL } from './kurs'
import { ValidasiError } from '@/lib/galat'

export type { MataUang, TahunBuku, Pengaturan, BarisKurs }

export async function daftarMataUang(): Promise<MataUang[]> {
  return repo.ambilSemuaMataUang()
}

export async function daftarKurs(kodeMataUang?: string): Promise<BarisKurs[]> {
  return repo.ambilSemuaKurs(kodeMataUang)
}

export async function catatKurs(masukan: MasukanKurs): Promise<void> {
  const hasil = skemaKurs.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  if (data.kodeMataUang === MATA_UANG_FUNGSIONAL) {
    throw new ValidasiError('Mata uang fungsional tidak memerlukan kurs')
  }
  if (!(await repo.mataUangAda(data.kodeMataUang))) {
    throw new ValidasiError(`Mata uang ${data.kodeMataUang} tidak terdaftar`)
  }

  await repo.simpanKurs(data.kodeMataUang, data.tanggal, data.kurs)
}

export async function daftarTahunBuku(): Promise<TahunBuku[]> {
  return repo.ambilSemuaTahunBuku()
}

export async function buatTahunBuku(masukan: MasukanTahunBuku): Promise<TahunBuku> {
  const hasil = skemaTahunBuku.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  if (await repo.namaTahunBukuTerpakai(data.nama)) {
    throw new ValidasiError(`Tahun buku ${data.nama} sudah ada`)
  }
  if (await repo.adaTahunBukuBertumpangTindih(data.tanggalMulai, data.tanggalSelesai)) {
    throw new ValidasiError('Rentang tanggal bertumpang tindih dengan tahun buku yang sudah ada')
  }

  return repo.sisipkanTahunBuku(data)
}

export async function ambilPengaturan(): Promise<Pengaturan | null> {
  return repo.ambilPengaturanPerusahaan()
}

export async function simpanProfilPerusahaan(masukan: MasukanPerusahaan): Promise<void> {
  const hasil = skemaPerusahaan.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)

  const pengaturan = await repo.ambilPengaturanPerusahaan()
  if (!pengaturan) throw new ValidasiError('Pengaturan perusahaan belum dibuat')

  await repo.perbaruiPengaturanPerusahaan(pengaturan.id, hasil.data)
}

/**
 * Tanggal kunci hanya boleh dimajukan atau dikosongkan sepenuhnya.
 * Memundurkannya akan membuka kembali periode yang laporannya mungkin
 * sudah dilaporkan ke pihak luar.
 */
export async function aturTanggalKunciBuku(tanggal: string | null): Promise<void> {
  const pengaturan = await repo.ambilPengaturanPerusahaan()
  if (!pengaturan) throw new ValidasiError('Pengaturan perusahaan belum dibuat')

  if (tanggal !== null && pengaturan.tanggalKunciBuku && tanggal < pengaturan.tanggalKunciBuku) {
    throw new ValidasiError(
      'Tanggal kunci tidak boleh dimundurkan. Kosongkan terlebih dahulu bila benar-benar perlu membuka periode.',
    )
  }

  await repo.perbaruiPengaturanPerusahaan(pengaturan.id, { tanggalKunciBuku: tanggal })
}
```

- [ ] **Step 6: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/akuntansi/konfigurasi.test.ts`
Expected: SELURUH pengujian LULUS

- [ ] **Step 7: Tulis Server Action untuk kurs dan tahun buku**

`src/app/(app)/akuntansi/konfigurasi/mata-uang/aksi.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { catatKurs } from '@/modules/akuntansi/layanan/konfigurasi'
import type { MasukanKurs } from '@/modules/akuntansi/validasi/konfigurasi'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

export async function aksiCatatKurs(masukan: MasukanKurs): Promise<HasilAksi> {
  await wajibIzin('akuntansi.mata-uang.kelola')
  try {
    await catatKurs(masukan)
    revalidatePath('/akuntansi/konfigurasi/mata-uang')
    return { berhasil: true }
  } catch (galat) {
    return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
  }
}
```

`src/app/(app)/akuntansi/konfigurasi/tahun-buku/aksi.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { buatTahunBuku, aturTanggalKunciBuku } from '@/modules/akuntansi/layanan/konfigurasi'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanTahunBuku } from '@/modules/akuntansi/validasi/konfigurasi'

const IZIN = 'akuntansi.tahun-buku.kelola'
const RUTE = '/akuntansi/konfigurasi/tahun-buku'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
}

export async function aksiBuatTahunBuku(masukan: MasukanTahunBuku): Promise<HasilAksi> {
  await wajibIzin(IZIN)
  try {
    await buatTahunBuku(masukan)
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiAturKunciBuku(tanggal: string | null): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    await aturTanggalKunciBuku(tanggal)
    await catatAudit({
      penggunaId: sesi.penggunaId,
      entitas: 'company_settings',
      entitasId: null,
      aksi: 'ubah',
      dataBaru: { tanggalKunciBuku: tanggal },
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
```

Perubahan tanggal kunci selalu dicatat ke log aktivitas. Ini termasuk tindakan paling berdampak di seluruh sistem akuntansi dan harus dapat ditelusuri.

- [ ] **Step 8: Tulis dialog kurs**

`src/app/(app)/akuntansi/konfigurasi/mata-uang/dialog-kurs.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { aksiCatatKurs } from './aksi'

export type PilihanMataUang = { kode: string; nama: string }

export function DialogKurs({
  mataUang, pemicu,
}: {
  mataUang: PilihanMataUang[]
  pemicu: React.ReactNode
}) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiCatatKurs({
        kodeMataUang: String(data.get('kodeMataUang') ?? ''),
        tanggal: String(data.get('tanggal') ?? ''),
        kurs: String(data.get('kurs') ?? ''),
      })
      if (hasil.berhasil) {
        toast.success('Kurs berhasil dicatat')
        setTerbuka(false)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>{pemicu}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat Kurs</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kodeMataUang">Mata Uang</Label>
            <Select name="kodeMataUang" required>
              <SelectTrigger id="kodeMataUang">
                <SelectValue placeholder="Pilih mata uang" />
              </SelectTrigger>
              <SelectContent>
                {mataUang.map((m) => (
                  <SelectItem key={m.kode} value={m.kode}>{m.kode} — {m.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tanggal">Tanggal Berlaku</Label>
            <Input id="tanggal" name="tanggal" type="date" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kurs">Kurs (Rupiah per 1 unit)</Label>
            <Input id="kurs" name="kurs" type="number" step="0.000001" min="0" required placeholder="16250" />
            <p className="text-xs text-muted-foreground">
              Mencatat kurs pada tanggal yang sudah ada akan menimpanya. Jurnal yang sudah
              terposting tidak ikut berubah karena kursnya dibekukan saat posting.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 9: Tulis halaman mata uang dan kurs**

`src/app/(app)/akuntansi/konfigurasi/mata-uang/page.tsx`:
```tsx
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarMataUang, daftarKurs, type BarisKurs } from '@/modules/akuntansi/layanan/konfigurasi'
import { MATA_UANG_FUNGSIONAL } from '@/modules/akuntansi/layanan/kurs'
import { formatAngka } from '@/lib/uang'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogKurs, type PilihanMataUang } from './dialog-kurs'

export const metadata = { title: 'Mata Uang & Kurs' }

const kolomKurs: Kolom<BarisKurs>[] = [
  { kunci: 'tanggal', judul: 'Tanggal', lebar: '160px', render: (k) => k.tanggal },
  { kunci: 'mataUang', judul: 'Mata Uang', lebar: '140px', render: (k) => k.kodeMataUang },
  {
    kunci: 'kurs', judul: 'Kurs (IDR)', rataKanan: true,
    render: (k) => formatAngka(k.kurs, 2),
  },
]

export default async function HalamanMataUang() {
  await wajibIzin('akuntansi.mata-uang.kelola')
  const [mataUang, kurs] = await Promise.all([daftarMataUang(), daftarKurs()])

  const pilihan: PilihanMataUang[] = mataUang
    .filter((m) => m.isActive && m.kode !== MATA_UANG_FUNGSIONAL)
    .map((m) => ({ kode: m.kode, nama: m.nama }))

  return (
    <>
      <KepalaHalaman
        judul="Mata Uang & Kurs"
        deskripsi="Kurs bermakna jumlah Rupiah per satu unit mata uang asing."
        aksi={
          <DialogKurs
            mataUang={pilihan}
            pemicu={<Button><Plus className="mr-2 h-4 w-4" />Catat Kurs</Button>}
          />
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Mata Uang Terdaftar</h2>
        <div className="flex flex-wrap gap-2">
          {mataUang.map((m) => (
            <Badge key={m.kode} variant={m.kode === MATA_UANG_FUNGSIONAL ? 'default' : 'secondary'}>
              {m.kode} — {m.nama}
              {m.kode === MATA_UANG_FUNGSIONAL && ' (fungsional)'}
            </Badge>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Riwayat Kurs</h2>
        <TabelData
          kolom={kolomKurs}
          baris={kurs}
          kunciBaris={(k) => k.id}
          pesanKosong="Belum ada kurs tercatat."
        />
      </section>
    </>
  )
}
```

- [ ] **Step 10: Tulis formulir penguncian dan halaman tahun buku**

`src/app/(app)/akuntansi/konfigurasi/tahun-buku/formulir-penguncian.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { aksiAturKunciBuku, aksiBuatTahunBuku } from './aksi'

export function FormulirPenguncian({ tanggalKunci }: { tanggalKunci: string | null }) {
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const nilai = String(data.get('tanggalKunciBuku') ?? '')
      const hasil = await aksiAturKunciBuku(nilai === '' ? null : nilai)
      if (hasil.berhasil) toast.success('Tanggal kunci buku diperbarui')
      else toast.error(hasil.pesan)
    })
  }

  return (
    <form action={simpan} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="tanggalKunciBuku">Tanggal Kunci Buku</Label>
        <Input
          id="tanggalKunciBuku" name="tanggalKunciBuku" type="date"
          defaultValue={tanggalKunci ?? ''} className="w-48"
        />
      </div>
      <Button type="submit" disabled={menyimpan}>
        {menyimpan ? 'Menyimpan…' : 'Simpan'}
      </Button>
    </form>
  )
}

export function DialogTahunBuku() {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiBuatTahunBuku({
        nama: String(data.get('nama') ?? ''),
        tanggalMulai: String(data.get('tanggalMulai') ?? ''),
        tanggalSelesai: String(data.get('tanggalSelesai') ?? ''),
      })
      if (hasil.berhasil) {
        toast.success('Tahun buku berhasil dibuat')
        setTerbuka(false)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        <Button>Tambah Tahun Buku</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Tahun Buku</DialogTitle>
        </DialogHeader>
        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" required placeholder="Tahun Buku 2027" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tanggalMulai">Tanggal Mulai</Label>
              <Input id="tanggalMulai" name="tanggalMulai" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tanggalSelesai">Tanggal Selesai</Label>
              <Input id="tanggalSelesai" name="tanggalSelesai" type="date" required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

`src/app/(app)/akuntansi/konfigurasi/tahun-buku/page.tsx`:
```tsx
import { wajibIzin } from '@/lib/sesi'
import {
  daftarTahunBuku, ambilPengaturan, type TahunBuku,
} from '@/modules/akuntansi/layanan/konfigurasi'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogTahunBuku, FormulirPenguncian } from './formulir-penguncian'

export const metadata = { title: 'Tahun Buku & Penguncian' }

const kolom: Kolom<TahunBuku>[] = [
  { kunci: 'nama', judul: 'Nama', render: (t) => t.nama },
  { kunci: 'mulai', judul: 'Tanggal Mulai', lebar: '160px', render: (t) => t.tanggalMulai },
  { kunci: 'selesai', judul: 'Tanggal Selesai', lebar: '160px', render: (t) => t.tanggalSelesai },
  {
    kunci: 'status', judul: 'Status', lebar: '120px',
    render: (t) => (
      <Badge variant={t.status === 'terbuka' ? 'secondary' : 'outline'}>
        {t.status === 'terbuka' ? 'Terbuka' : 'Ditutup'}
      </Badge>
    ),
  },
]

export default async function HalamanTahunBuku() {
  await wajibIzin('akuntansi.tahun-buku.kelola')
  const [tahun, pengaturan] = await Promise.all([daftarTahunBuku(), ambilPengaturan()])

  return (
    <>
      <KepalaHalaman
        judul="Tahun Buku & Penguncian"
        deskripsi="Menentukan periode pelaporan dan batas perubahan data akuntansi."
        aksi={<DialogTahunBuku />}
      />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Penguncian Periode</CardTitle>
          <CardDescription>
            Entri jurnal bertanggal pada atau sebelum tanggal kunci tidak dapat dibuat, diubah,
            maupun dihapus — termasuk oleh proses otomatis dari modul lain. Tanggal kunci hanya
            dapat dimajukan atau dikosongkan sepenuhnya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormulirPenguncian tanggalKunci={pengaturan?.tanggalKunciBuku ?? null} />
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Daftar Tahun Buku</h2>
        <TabelData
          kolom={kolom}
          baris={tahun}
          kunciBaris={(t) => t.id}
          pesanKosong="Belum ada tahun buku."
        />
      </section>
    </>
  )
}
```

- [ ] **Step 11: Tulis dasbor akuntansi**

`src/app/(app)/akuntansi/page.tsx`:
```tsx
import Link from 'next/link'
import { wajibIzin } from '@/lib/sesi'
import { daftarAkun } from '@/modules/akuntansi/layanan/akun'
import { daftarJurnal } from '@/modules/akuntansi/layanan/jurnal'
import { daftarPartner } from '@/modules/akuntansi/layanan/partner'
import { ambilPengaturan } from '@/modules/akuntansi/layanan/konfigurasi'
import { formatTanggalIndonesia } from '@/modules/akuntansi/layanan/penguncian'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Dasbor Akuntansi' }

function Ringkasan({ judul, nilai, rute }: { judul: string; nilai: number; rute: string }) {
  return (
    <Link href={rute}>
      <Card className="transition-colors hover:bg-accent/40">
        <CardHeader className="pb-2">
          <CardDescription>{judul}</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{nilai}</CardTitle>
        </CardHeader>
      </Card>
    </Link>
  )
}

export default async function HalamanDasborAkuntansi() {
  await wajibIzin('akuntansi.dasbor.lihat')
  const [akun, jurnal, mitra, pengaturan] = await Promise.all([
    daftarAkun(), daftarJurnal(), daftarPartner(), ambilPengaturan(),
  ])

  const kunci = pengaturan?.tanggalKunciBuku
    ? formatTanggalIndonesia(new Date(`${pengaturan.tanggalKunciBuku}T00:00:00Z`))
    : null

  return (
    <>
      <KepalaHalaman
        judul="Dasbor Akuntansi"
        deskripsi="Ringkasan konfigurasi akuntansi. Angka keuangan muncul setelah mesin jurnal aktif pada Fase 1B."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Ringkasan judul="Akun Aktif" nilai={akun.filter((a) => a.isActive).length}
          rute="/akuntansi/konfigurasi/bagan-akun" />
        <Ringkasan judul="Jurnal Aktif" nilai={jurnal.filter((j) => j.isActive).length}
          rute="/akuntansi/konfigurasi/jurnal" />
        <Ringkasan judul="Mitra Usaha" nilai={mitra.filter((m) => m.isActive).length}
          rute="/kontak" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Periode</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {kunci
            ? `Buku terkunci sampai ${kunci}. Transaksi pada tanggal tersebut atau sebelumnya tidak dapat diubah.`
            : 'Belum ada penguncian periode. Seluruh tanggal masih terbuka untuk pencatatan.'}
        </CardContent>
      </Card>
    </>
  )
}
```

- [ ] **Step 12: Jalankan pengujian, periksa tipe, dan bangun**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: seluruhnya berhasil

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(akuntansi): halaman mata uang, tahun buku, penguncian, dan dasbor

Melengkapi tiga menu Fase 1 yang skemanya sudah ada sejak Task 7 dan 8.
Pencatatan kurs menimpa tanggal yang sama alih-alih menggandakannya.
Tanggal kunci buku hanya dapat dimajukan atau dikosongkan sepenuhnya, dan
setiap perubahannya dicatat ke log aktivitas."
```

---

## Task 16: Pengaturan Sistem dan Verifikasi Akhir

Melengkapi empat menu terakhir Fase 1 di grup Pengaturan, lalu menyapu seluruh aplikasi.

**Files:**
- Create: `src/modules/identitas/validasi/pengguna.ts`
- Create: `src/modules/identitas/repositori/peran.ts`
- Create: `src/modules/identitas/layanan/pengguna.ts`
- Create: `src/app/(app)/pengaturan/perusahaan/page.tsx`, `aksi.ts`, `formulir-perusahaan.tsx`
- Create: `src/app/(app)/pengaturan/pengguna/page.tsx`, `aksi.ts`, `dialog-pengguna.tsx`
- Create: `src/app/(app)/pengaturan/peran/page.tsx`
- Create: `src/app/(app)/pengaturan/penomoran/page.tsx`
- Test: `tests/identitas/pengguna.test.ts`

**Interfaces:**
- Consumes: `hashKataSandi`, `PANJANG_MINIMAL` dari Task 4; `catatAudit` dari Task 13; `ambilPengaturan`, `simpanProfilPerusahaan`, `MasukanPerusahaan` dari Task 15; `ValidasiError` dari `@/lib/galat`; `TabelData`, `KepalaHalaman` dari Task 9
- Produces:
  - `skemaPengguna`, `skemaPenggunaBaru` dari `@/modules/identitas/validasi/pengguna`
  - `daftarPengguna(): Promise<BarisPengguna[]>`, `buatPengguna(masukan): Promise<BarisPengguna>`, `ubahPengguna(id, masukan): Promise<BarisPengguna>`, `aturKataSandi(id, kataSandi): Promise<void>`, `ubahStatusPengguna(id, aktif): Promise<void>` dari `@/modules/identitas/layanan/pengguna`
  - `type BarisPengguna = { id: string; email: string; nama: string; isActive: boolean; lastLoginAt: Date | null; peran: string[] }`
  - `daftarPeranDenganIzin(): Promise<PeranDenganIzin[]>` dari `@/modules/identitas/repositori/peran`
  - `type PeranDenganIzin = { id: string; kode: string; nama: string; isSystem: boolean; izin: string[]; jumlahPengguna: number }`

- [ ] **Step 1: Tulis pengujian pengguna yang gagal**

`tests/identitas/pengguna.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/klien'
import { roles } from '@/db/schema'
import {
  daftarPengguna, buatPengguna, ubahPengguna, aturKataSandi, ubahStatusPengguna,
} from '@/modules/identitas/layanan/pengguna'
import { daftarPeranDenganIzin } from '@/modules/identitas/repositori/peran'
import { verifikasiKredensial } from '@/modules/identitas/layanan/autentikasi'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const TABEL = ['audit_logs', 'user_roles', 'role_permissions', 'permissions', 'roles', 'users']

let peranId: string

beforeEach(async () => {
  await bersihkanTabel(TABEL)
  const [peran] = await db.insert(roles).values({
    kode: 'superuser', nama: 'Superuser', isSystem: true,
  }).returning()
  peranId = peran.id
})
afterAll(async () => { await tutupKoneksi() })

const BARU = {
  email: 'akuntan@furni.local', nama: 'Sri Akuntan',
  kataSandi: 'rahasia123', peranId: '',
}

describe('buatPengguna', () => {
  it('menyimpan pengguna baru beserta perannya', async () => {
    const pengguna = await buatPengguna({ ...BARU, peranId })
    expect(pengguna.email).toBe('akuntan@furni.local')
    expect(pengguna.peran).toEqual(['Superuser'])
    expect(pengguna.isActive).toBe(true)
  })

  it('menyimpan kata sandi sebagai hash yang dapat diverifikasi', async () => {
    await buatPengguna({ ...BARU, peranId })
    const hasil = await verifikasiKredensial('akuntan@furni.local', 'rahasia123')
    expect(hasil.nama).toBe('Sri Akuntan')
  })

  it('menolak email yang sudah terdaftar', async () => {
    await buatPengguna({ ...BARU, peranId })
    await expect(buatPengguna({ ...BARU, peranId, nama: 'Orang Lain' }))
      .rejects.toThrow('Email akuntan@furni.local sudah terdaftar')
  })

  it('menolak email yang sudah terdaftar meski beda huruf besar-kecil', async () => {
    await buatPengguna({ ...BARU, peranId })
    await expect(buatPengguna({ ...BARU, peranId, email: 'Akuntan@Furni.Local' }))
      .rejects.toThrow('sudah terdaftar')
  })

  it('menolak kata sandi lebih pendek dari delapan karakter', async () => {
    await expect(buatPengguna({ ...BARU, peranId, kataSandi: 'pendek' }))
      .rejects.toThrow('minimal 8 karakter')
  })

  it('menolak email yang formatnya tidak sah', async () => {
    await expect(buatPengguna({ ...BARU, peranId, email: 'bukan-email' }))
      .rejects.toThrow('Format email tidak sah')
  })

  it('menolak peran yang tidak ada', async () => {
    await expect(buatPengguna({ ...BARU, peranId: '00000000-0000-0000-0000-000000000000' }))
      .rejects.toThrow('Peran tidak ditemukan')
  })
})

describe('ubahPengguna', () => {
  it('memperbarui nama tanpa menyentuh kata sandi', async () => {
    const pengguna = await buatPengguna({ ...BARU, peranId })
    await ubahPengguna(pengguna.id, { email: BARU.email, nama: 'Sri Akuntan Utama', peranId })
    const hasil = await verifikasiKredensial('akuntan@furni.local', 'rahasia123')
    expect(hasil.nama).toBe('Sri Akuntan Utama')
  })

  it('mengganti peran lama alih-alih menumpuknya', async () => {
    const [peranLain] = await db.insert(roles).values({ kode: 'akuntan', nama: 'Akuntan' }).returning()
    const pengguna = await buatPengguna({ ...BARU, peranId })
    const hasil = await ubahPengguna(pengguna.id, {
      email: BARU.email, nama: BARU.nama, peranId: peranLain.id,
    })
    expect(hasil.peran).toEqual(['Akuntan'])
  })

  it('menolak email milik pengguna lain', async () => {
    await buatPengguna({ ...BARU, peranId })
    const lain = await buatPengguna({ ...BARU, peranId, email: 'lain@furni.local', nama: 'Lain' })
    await expect(ubahPengguna(lain.id, { email: BARU.email, nama: 'Lain', peranId }))
      .rejects.toThrow('sudah terdaftar')
  })
})

describe('aturKataSandi', () => {
  it('mengganti kata sandi sehingga yang lama tidak berlaku lagi', async () => {
    const pengguna = await buatPengguna({ ...BARU, peranId })
    await aturKataSandi(pengguna.id, 'katasandibaru')
    await expect(verifikasiKredensial('akuntan@furni.local', 'rahasia123')).rejects.toThrow()
    await expect(verifikasiKredensial('akuntan@furni.local', 'katasandibaru')).resolves.toBeTruthy()
  })

  it('menolak kata sandi yang terlalu pendek', async () => {
    const pengguna = await buatPengguna({ ...BARU, peranId })
    await expect(aturKataSandi(pengguna.id, 'pendek')).rejects.toThrow('minimal 8 karakter')
  })
})

describe('ubahStatusPengguna', () => {
  it('menonaktifkan pengguna sehingga tidak dapat masuk', async () => {
    const pengguna = await buatPengguna({ ...BARU, peranId })
    await ubahStatusPengguna(pengguna.id, false)
    await expect(verifikasiKredensial('akuntan@furni.local', 'rahasia123'))
      .rejects.toThrow('dinonaktifkan')
  })

  it('menolak penonaktifan pengguna aktif yang terakhir', async () => {
    const pengguna = await buatPengguna({ ...BARU, peranId })
    await expect(ubahStatusPengguna(pengguna.id, false)).rejects.toThrow(
      'Tidak dapat menonaktifkan pengguna aktif terakhir',
    )
  })
})

describe('daftarPengguna', () => {
  it('mengurutkan berdasarkan nama', async () => {
    await buatPengguna({ ...BARU, peranId, email: 'z@furni.local', nama: 'Zaki' })
    await buatPengguna({ ...BARU, peranId, email: 'a@furni.local', nama: 'Andi' })
    expect((await daftarPengguna()).map((p) => p.nama)).toEqual(['Andi', 'Zaki'])
  })

  it('tidak pernah membocorkan hash kata sandi', async () => {
    await buatPengguna({ ...BARU, peranId })
    const [pengguna] = await daftarPengguna()
    expect(Object.keys(pengguna)).not.toContain('passwordHash')
  })
})

describe('daftarPeranDenganIzin', () => {
  it('menghitung jumlah pengguna per peran', async () => {
    await buatPengguna({ ...BARU, peranId })
    await buatPengguna({ ...BARU, peranId, email: 'dua@furni.local', nama: 'Dua' })
    const [peran] = await daftarPeranDenganIzin()
    expect(peran.jumlahPengguna).toBe(2)
  })

  it('mengembalikan daftar izin kosong bila peran belum diberi izin', async () => {
    const [peran] = await daftarPeranDenganIzin()
    expect(peran.izin).toEqual([])
  })
})
```

Pengujian "menolak penonaktifan pengguna aktif yang terakhir" mencegah situasi tidak ada seorang pun yang dapat masuk ke sistem.

- [ ] **Step 2: Jalankan pengujian untuk memastikan gagal**

Run: `pnpm vitest run tests/identitas/pengguna.test.ts`
Expected: GAGAL pada impor modul pengguna

- [ ] **Step 3: Tulis validasi**

`src/modules/identitas/validasi/pengguna.ts`:
```ts
import { z } from 'zod'

export const PANJANG_MINIMAL_SANDI = 8

export const skemaPengguna = z.object({
  email: z.string().trim().toLowerCase()
    .min(1, 'Email wajib diisi')
    .refine((v) => z.string().email().safeParse(v).success, { message: 'Format email tidak sah' }),
  nama: z.string().trim().min(1, 'Nama wajib diisi').max(120),
  peranId: z.string().uuid('Peran wajib dipilih'),
})

export const skemaPenggunaBaru = skemaPengguna.extend({
  kataSandi: z.string().min(PANJANG_MINIMAL_SANDI, `Kata sandi minimal ${PANJANG_MINIMAL_SANDI} karakter`),
})

export type MasukanPengguna = z.input<typeof skemaPengguna>
export type MasukanPenggunaBaru = z.input<typeof skemaPenggunaBaru>
```

Validasi profil perusahaan tidak diletakkan di sini melainkan di `src/modules/akuntansi/validasi/konfigurasi.ts` (Task 15), karena `company_settings` adalah konfigurasi akuntansi yang juga memuat akun default dan tanggal kunci buku.

- [ ] **Step 4: Tulis repositori peran**

`src/modules/identitas/repositori/peran.ts`:
```ts
import { asc, sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import { roles, rolePermissions, permissions, userRoles } from '@/db/schema'

export type PeranDenganIzin = {
  id: string
  kode: string
  nama: string
  isSystem: boolean
  izin: string[]
  jumlahPengguna: number
}

export async function daftarPeranDenganIzin(): Promise<PeranDenganIzin[]> {
  const baris = await db
    .select({
      id: roles.id,
      kode: roles.kode,
      nama: roles.nama,
      isSystem: roles.isSystem,
      kodeIzin: permissions.kode,
    })
    .from(roles)
    .leftJoin(rolePermissions, sql`${rolePermissions.roleId} = ${roles.id}`)
    .leftJoin(permissions, sql`${permissions.id} = ${rolePermissions.permissionId}`)
    .orderBy(asc(roles.kode))

  const hitungan = await db
    .select({ roleId: userRoles.roleId, jumlah: sql<number>`count(*)::int` })
    .from(userRoles)
    .groupBy(userRoles.roleId)

  const jumlahLewatPeran = new Map(hitungan.map((h) => [h.roleId, h.jumlah]))
  const terkumpul = new Map<string, PeranDenganIzin>()

  for (const b of baris) {
    const sudahAda = terkumpul.get(b.id) ?? {
      id: b.id, kode: b.kode, nama: b.nama, isSystem: b.isSystem,
      izin: [], jumlahPengguna: jumlahLewatPeran.get(b.id) ?? 0,
    }
    if (b.kodeIzin) sudahAda.izin.push(b.kodeIzin)
    terkumpul.set(b.id, sudahAda)
  }

  return [...terkumpul.values()]
}
```

- [ ] **Step 5: Tulis layanan pengguna**

`src/modules/identitas/layanan/pengguna.ts`:
```ts
import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { db } from '@/db/klien'
import { users, roles, userRoles } from '@/db/schema'
import { hashKataSandi, PANJANG_MINIMAL } from './kata-sandi'
import {
  skemaPengguna, skemaPenggunaBaru,
  type MasukanPengguna, type MasukanPenggunaBaru,
} from '../validasi/pengguna'
import { ValidasiError } from '@/lib/galat'

export type BarisPengguna = {
  id: string
  email: string
  nama: string
  isActive: boolean
  lastLoginAt: Date | null
  peran: string[]
}

async function ambilBaris(id: string): Promise<BarisPengguna> {
  const baris = await db
    .select({
      id: users.id, email: users.email, nama: users.nama,
      isActive: users.isActive, lastLoginAt: users.lastLoginAt,
      namaPeran: roles.nama,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(users.id, id))

  if (baris.length === 0) throw new ValidasiError('Pengguna tidak ditemukan')
  const { email, nama, isActive, lastLoginAt } = baris[0]
  return {
    id, email, nama, isActive, lastLoginAt,
    peran: baris.map((b) => b.namaPeran).filter((n): n is string => Boolean(n)),
  }
}

async function emailTerpakai(email: string, kecualiId?: string): Promise<boolean> {
  const cocok = sql`lower(${users.email}) = lower(${email})`
  const syarat = kecualiId ? and(cocok, ne(users.id, kecualiId)) : cocok
  const [ada] = await db.select({ id: users.id }).from(users).where(syarat).limit(1)
  return Boolean(ada)
}

async function peranAda(peranId: string): Promise<boolean> {
  const [ada] = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, peranId)).limit(1)
  return Boolean(ada)
}

export async function daftarPengguna(): Promise<BarisPengguna[]> {
  const baris = await db
    .select({
      id: users.id, email: users.email, nama: users.nama,
      isActive: users.isActive, lastLoginAt: users.lastLoginAt,
      namaPeran: roles.nama,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .orderBy(asc(users.nama))

  const terkumpul = new Map<string, BarisPengguna>()
  for (const b of baris) {
    const sudahAda = terkumpul.get(b.id) ?? {
      id: b.id, email: b.email, nama: b.nama,
      isActive: b.isActive, lastLoginAt: b.lastLoginAt, peran: [],
    }
    if (b.namaPeran) sudahAda.peran.push(b.namaPeran)
    terkumpul.set(b.id, sudahAda)
  }
  return [...terkumpul.values()]
}

export async function buatPengguna(masukan: MasukanPenggunaBaru): Promise<BarisPengguna> {
  const hasil = skemaPenggunaBaru.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  if (await emailTerpakai(data.email)) {
    throw new ValidasiError(`Email ${data.email} sudah terdaftar`)
  }
  if (!(await peranAda(data.peranId))) throw new ValidasiError('Peran tidak ditemukan')

  const passwordHash = await hashKataSandi(data.kataSandi)

  const id = await db.transaction(async (tx) => {
    const [pengguna] = await tx.insert(users)
      .values({ email: data.email, nama: data.nama, passwordHash })
      .returning({ id: users.id })
    await tx.insert(userRoles).values({ userId: pengguna.id, roleId: data.peranId })
    return pengguna.id
  })

  return ambilBaris(id)
}

export async function ubahPengguna(id: string, masukan: MasukanPengguna): Promise<BarisPengguna> {
  const hasil = skemaPengguna.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  const data = hasil.data

  if (await emailTerpakai(data.email, id)) {
    throw new ValidasiError(`Email ${data.email} sudah terdaftar`)
  }
  if (!(await peranAda(data.peranId))) throw new ValidasiError('Peran tidak ditemukan')

  await db.transaction(async (tx) => {
    await tx.update(users)
      .set({ email: data.email, nama: data.nama, diubahPada: new Date() })
      .where(eq(users.id, id))
    // Peran diganti, bukan ditambahkan — satu pengguna memegang satu peran.
    await tx.delete(userRoles).where(eq(userRoles.userId, id))
    await tx.insert(userRoles).values({ userId: id, roleId: data.peranId })
  })

  return ambilBaris(id)
}

export async function aturKataSandi(id: string, kataSandi: string): Promise<void> {
  if (kataSandi.length < PANJANG_MINIMAL) {
    throw new ValidasiError(`Kata sandi minimal ${PANJANG_MINIMAL} karakter`)
  }
  const passwordHash = await hashKataSandi(kataSandi)
  await db.update(users)
    .set({ passwordHash, diubahPada: new Date() })
    .where(eq(users.id, id))
}

/**
 * Menonaktifkan pengguna aktif terakhir akan mengunci semua orang di luar
 * sistem tanpa jalan masuk, sehingga ditolak.
 */
export async function ubahStatusPengguna(id: string, aktif: boolean): Promise<void> {
  if (!aktif) {
    const [{ jumlah }] = await db
      .select({ jumlah: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.isActive, true), ne(users.id, id)))
    if (jumlah === 0) {
      throw new ValidasiError('Tidak dapat menonaktifkan pengguna aktif terakhir')
    }
  }
  await db.update(users)
    .set({ isActive: aktif, diubahPada: new Date() })
    .where(eq(users.id, id))
}
```

- [ ] **Step 6: Jalankan pengujian untuk memastikan lulus**

Run: `pnpm vitest run tests/identitas/pengguna.test.ts`
Expected: SELURUH pengujian LULUS

- [ ] **Step 7: Tulis Server Action pengaturan**

`src/app/(app)/pengaturan/perusahaan/aksi.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import { simpanProfilPerusahaan } from '@/modules/akuntansi/layanan/konfigurasi'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanPerusahaan } from '@/modules/akuntansi/validasi/konfigurasi'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

export async function aksiSimpanPerusahaan(masukan: MasukanPerusahaan): Promise<HasilAksi> {
  const sesi = await wajibIzin('pengaturan.perusahaan.kelola')
  try {
    await simpanProfilPerusahaan(masukan)
    await catatAudit({
      penggunaId: sesi.penggunaId,
      entitas: 'company_settings',
      entitasId: null,
      aksi: 'ubah',
      dataBaru: masukan,
    })
    revalidatePath('/pengaturan/perusahaan')
    return { berhasil: true }
  } catch (galat) {
    return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
  }
}
```

`src/app/(app)/pengaturan/pengguna/aksi.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { wajibIzin } from '@/lib/sesi'
import {
  buatPengguna, ubahPengguna, aturKataSandi, ubahStatusPengguna,
} from '@/modules/identitas/layanan/pengguna'
import { catatAudit } from '@/modules/identitas/layanan/audit'
import type { MasukanPengguna, MasukanPenggunaBaru } from '@/modules/identitas/validasi/pengguna'

const IZIN = 'pengaturan.pengguna.kelola'
const RUTE = '/pengaturan/pengguna'

export type HasilAksi = { berhasil: true } | { berhasil: false; pesan: string }

function keHasil(galat: unknown): HasilAksi {
  return { berhasil: false, pesan: galat instanceof Error ? galat.message : 'Terjadi kesalahan' }
}

export async function aksiSimpanPengguna(
  id: string | null,
  masukan: MasukanPengguna & { kataSandi?: string },
): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    if (id) {
      await ubahPengguna(id, masukan)
      if (masukan.kataSandi) await aturKataSandi(id, masukan.kataSandi)
    } else {
      await buatPengguna(masukan as MasukanPenggunaBaru)
    }
    await catatAudit({
      penggunaId: sesi.penggunaId,
      entitas: 'users',
      entitasId: id,
      aksi: id ? 'ubah' : 'buat',
      // Kata sandi sengaja tidak pernah masuk ke log aktivitas.
      dataBaru: { email: masukan.email, nama: masukan.nama, peranId: masukan.peranId },
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}

export async function aksiUbahStatusPengguna(id: string, aktif: boolean): Promise<HasilAksi> {
  const sesi = await wajibIzin(IZIN)
  try {
    await ubahStatusPengguna(id, aktif)
    await catatAudit({
      penggunaId: sesi.penggunaId, entitas: 'users', entitasId: id,
      aksi: 'ubah', dataBaru: { isActive: aktif },
    })
    revalidatePath(RUTE)
    return { berhasil: true }
  } catch (galat) {
    return keHasil(galat)
  }
}
```

Kata sandi tidak pernah dimasukkan ke `dataBaru` log aktivitas. Log adalah catatan permanen yang dapat dibaca administrator mana pun.

- [ ] **Step 8: Tulis formulir profil perusahaan dan halamannya**

`src/app/(app)/pengaturan/perusahaan/formulir-perusahaan.tsx`:
```tsx
'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { aksiSimpanPerusahaan } from './aksi'

export type NilaiAwal = {
  nama: string
  npwp: string
  alamat: string
  kota: string
  provinsi: string
  kodePos: string
  telepon: string
  email: string
}

export function FormulirPerusahaan({ awal }: { awal: NilaiAwal }) {
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const hasil = await aksiSimpanPerusahaan({
        nama: String(data.get('nama') ?? ''),
        npwp: String(data.get('npwp') ?? '') || null,
        alamat: String(data.get('alamat') ?? '') || null,
        kota: String(data.get('kota') ?? '') || null,
        provinsi: String(data.get('provinsi') ?? '') || null,
        kodePos: String(data.get('kodePos') ?? '') || null,
        telepon: String(data.get('telepon') ?? '') || null,
        email: String(data.get('email') ?? '') || null,
      })
      if (hasil.berhasil) toast.success('Profil perusahaan diperbarui')
      else toast.error(hasil.pesan)
    })
  }

  return (
    <form action={simpan} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="nama">Nama Perusahaan</Label>
        <Input id="nama" name="nama" defaultValue={awal.nama} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="npwp">NPWP</Label>
        <Input id="npwp" name="npwp" defaultValue={awal.npwp} placeholder="01.234.567.8-901.000" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="telepon">Telepon</Label>
        <Input id="telepon" name="telepon" defaultValue={awal.telepon} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="alamat">Alamat</Label>
        <Input id="alamat" name="alamat" defaultValue={awal.alamat} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kota">Kota</Label>
        <Input id="kota" name="kota" defaultValue={awal.kota} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="provinsi">Provinsi</Label>
        <Input id="provinsi" name="provinsi" defaultValue={awal.provinsi} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kodePos">Kode Pos</Label>
        <Input id="kodePos" name="kodePos" defaultValue={awal.kodePos} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={awal.email} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={menyimpan}>
          {menyimpan ? 'Menyimpan…' : 'Simpan Perubahan'}
        </Button>
      </div>
    </form>
  )
}
```

`src/app/(app)/pengaturan/perusahaan/page.tsx`:
```tsx
import { wajibIzin } from '@/lib/sesi'
import { ambilPengaturan } from '@/modules/akuntansi/layanan/konfigurasi'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { FormulirPerusahaan } from './formulir-perusahaan'

export const metadata = { title: 'Profil Perusahaan' }

export default async function HalamanPerusahaan() {
  await wajibIzin('pengaturan.perusahaan.kelola')
  const pengaturan = await ambilPengaturan()

  if (!pengaturan) {
    return (
      <>
        <KepalaHalaman judul="Profil Perusahaan" />
        <p className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Pengaturan perusahaan belum dibuat. Jalankan <code>pnpm db:seed</code> terlebih dahulu.
        </p>
      </>
    )
  }

  return (
    <>
      <KepalaHalaman
        judul="Profil Perusahaan"
        deskripsi="Identitas perusahaan yang tampil pada dokumen dan laporan."
      />
      <FormulirPerusahaan
        awal={{
          nama: pengaturan.nama,
          npwp: pengaturan.npwp ?? '',
          alamat: pengaturan.alamat ?? '',
          kota: pengaturan.kota ?? '',
          provinsi: pengaturan.provinsi ?? '',
          kodePos: pengaturan.kodePos ?? '',
          telepon: pengaturan.telepon ?? '',
          email: pengaturan.email ?? '',
        }}
      />
    </>
  )
}
```

- [ ] **Step 9: Tulis dialog pengguna dan halamannya**

`src/app/(app)/pengaturan/pengguna/dialog-pengguna.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { aksiSimpanPengguna } from './aksi'

export type PilihanPeran = { id: string; nama: string }
export type PenggunaTampil = { id: string; email: string; nama: string }

export function DialogPengguna({
  pengguna, peran, peranTerpilihId, pemicu,
}: {
  pengguna?: PenggunaTampil
  peran: PilihanPeran[]
  peranTerpilihId?: string
  pemicu: React.ReactNode
}) {
  const [terbuka, setTerbuka] = useState(false)
  const [menyimpan, mulai] = useTransition()

  function simpan(data: FormData) {
    mulai(async () => {
      const kataSandi = String(data.get('kataSandi') ?? '')
      const hasil = await aksiSimpanPengguna(pengguna?.id ?? null, {
        email: String(data.get('email') ?? ''),
        nama: String(data.get('nama') ?? ''),
        peranId: String(data.get('peranId') ?? ''),
        ...(kataSandi ? { kataSandi } : {}),
      })
      if (hasil.berhasil) {
        toast.success(pengguna ? 'Pengguna berhasil diperbarui' : 'Pengguna berhasil dibuat')
        setTerbuka(false)
      } else {
        toast.error(hasil.pesan)
      }
    })
  }

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>{pemicu}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pengguna ? 'Ubah Pengguna' : 'Tambah Pengguna'}</DialogTitle>
        </DialogHeader>

        <form action={simpan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" defaultValue={pengguna?.nama} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={pengguna?.email} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="peranId">Peran</Label>
            <Select name="peranId" defaultValue={peranTerpilihId} required>
              <SelectTrigger id="peranId"><SelectValue placeholder="Pilih peran" /></SelectTrigger>
              <SelectContent>
                {peran.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kataSandi">
              {pengguna ? 'Kata Sandi Baru' : 'Kata Sandi'}
            </Label>
            <Input
              id="kataSandi" name="kataSandi" type="password"
              required={!pengguna} minLength={8} autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              {pengguna
                ? 'Kosongkan bila tidak ingin mengganti kata sandi.'
                : 'Minimal 8 karakter.'}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTerbuka(false)}>Batal</Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

`src/app/(app)/pengaturan/pengguna/page.tsx`:
```tsx
import { Plus } from 'lucide-react'
import { wajibIzin } from '@/lib/sesi'
import { daftarPengguna, type BarisPengguna } from '@/modules/identitas/layanan/pengguna'
import { daftarPeranDenganIzin } from '@/modules/identitas/repositori/peran'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'
import { DialogPengguna, type PilihanPeran } from './dialog-pengguna'

export const metadata = { title: 'Pengguna' }

const penanggalan = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
})

function kolomPengguna(peran: PilihanPeran[]): Kolom<BarisPengguna>[] {
  return [
    { kunci: 'nama', judul: 'Nama', render: (p) => p.nama },
    { kunci: 'email', judul: 'Email', render: (p) => p.email },
    {
      kunci: 'peran', judul: 'Peran', lebar: '160px',
      render: (p) => (
        <span className="flex gap-1">
          {p.peran.map((n) => <Badge key={n} variant="secondary">{n}</Badge>)}
        </span>
      ),
    },
    {
      kunci: 'masuk', judul: 'Terakhir Masuk', lebar: '200px',
      render: (p) => (p.lastLoginAt ? penanggalan.format(p.lastLoginAt) : 'Belum pernah'),
    },
    {
      kunci: 'status', judul: 'Status', lebar: '100px',
      render: (p) => (
        <Badge variant={p.isActive ? 'secondary' : 'outline'}>
          {p.isActive ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
    {
      kunci: 'aksi', judul: '', lebar: '80px', rataKanan: true,
      render: (p) => (
        <DialogPengguna
          pengguna={{ id: p.id, email: p.email, nama: p.nama }}
          peran={peran}
          pemicu={<Button variant="ghost" size="sm">Ubah</Button>}
        />
      ),
    },
  ]
}

export default async function HalamanPengguna() {
  await wajibIzin('pengaturan.pengguna.kelola')
  const [pengguna, peranLengkap] = await Promise.all([daftarPengguna(), daftarPeranDenganIzin()])
  const peran: PilihanPeran[] = peranLengkap.map((p) => ({ id: p.id, nama: p.nama }))

  return (
    <>
      <KepalaHalaman
        judul="Pengguna"
        deskripsi="Satu pengguna memegang satu peran. Pengguna dinonaktifkan, tidak dihapus."
        aksi={
          <DialogPengguna
            peran={peran}
            pemicu={<Button><Plus className="mr-2 h-4 w-4" />Tambah Pengguna</Button>}
          />
        }
      />
      <TabelData
        kolom={kolomPengguna(peran)}
        baris={pengguna}
        kunciBaris={(p) => p.id}
        pesanKosong="Belum ada pengguna."
      />
    </>
  )
}
```

- [ ] **Step 10: Tulis halaman peran dan penomoran**

`src/app/(app)/pengaturan/peran/page.tsx`:
```tsx
import { wajibIzin } from '@/lib/sesi'
import { daftarPeranDenganIzin, type PeranDenganIzin } from '@/modules/identitas/repositori/peran'
import { daftarKodeIzin } from '@/lib/navigasi'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'

export const metadata = { title: 'Peran & Hak Akses' }

const kolom: Kolom<PeranDenganIzin>[] = [
  { kunci: 'kode', judul: 'Kode', lebar: '140px', render: (p) => <span className="font-mono text-sm">{p.kode}</span> },
  { kunci: 'nama', judul: 'Nama', render: (p) => p.nama },
  {
    kunci: 'izin', judul: 'Izin', render: (p) => (
      p.izin.includes('*')
        ? <Badge>Akses penuh</Badge>
        : <span className="text-sm text-muted-foreground">{p.izin.length} izin</span>
    ),
  },
  {
    kunci: 'pengguna', judul: 'Jumlah Pengguna', lebar: '160px', rataKanan: true,
    render: (p) => p.jumlahPengguna,
  },
  {
    kunci: 'sistem', judul: 'Jenis', lebar: '120px',
    render: (p) => (p.isSystem ? <Badge variant="outline">Sistem</Badge> : '—'),
  },
]

export default async function HalamanPeran() {
  await wajibIzin('pengaturan.peran.kelola')
  const peran = await daftarPeranDenganIzin()
  const totalIzin = daftarKodeIzin().length

  return (
    <>
      <KepalaHalaman
        judul="Peran & Hak Akses"
        deskripsi="Struktur hak akses sudah lengkap sejak awal, meski saat ini hanya peran Superuser yang dipakai."
      />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Tentang Pemecahan Peran</CardTitle>
          <CardDescription>
            Sistem sudah mengenali {totalIzin} kode izin yang mencakup seluruh tujuh fase, termasuk
            modul yang belum dibangun. Ketika peran dipecah nanti — misalnya Akuntan, Sales, atau
            Kepala Gudang — tidak ada kode antarmuka yang perlu diubah; cukup memetakan izin ke
            peran baru. Antarmuka pemetaan itu sendiri dibangun bersamaan dengan pemecahan peran.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>

      <TabelData
        kolom={kolom}
        baris={peran}
        kunciBaris={(p) => p.id}
        pesanKosong="Belum ada peran."
      />
    </>
  )
}
```

`src/app/(app)/pengaturan/penomoran/page.tsx`:
```tsx
import { asc } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { sequences } from '@/db/schema'
import { KepalaHalaman } from '@/components/data/kepala-halaman'
import { TabelData, type Kolom } from '@/components/data/tabel-data'

export const metadata = { title: 'Penomoran Dokumen' }

type BarisUrutan = typeof sequences.$inferSelect

const LABEL_RESET: Record<string, string> = {
  tidak_pernah: 'Tidak pernah',
  tahunan: 'Setiap tahun',
  bulanan: 'Setiap bulan',
}

function contohNomor(u: BarisUrutan): string {
  const nomor = String(u.nomorBerikut).padStart(u.panjangDigit, '0')
  if (u.reset === 'bulanan') return `${u.prefix}/2026/09/${nomor}`
  if (u.reset === 'tahunan') return `${u.prefix}/2026/${nomor}`
  return `${u.prefix}/${nomor}`
}

const kolom: Kolom<BarisUrutan>[] = [
  { kunci: 'kode', judul: 'Kode', lebar: '200px', render: (u) => <span className="font-mono text-sm">{u.kode}</span> },
  { kunci: 'prefix', judul: 'Prefiks', lebar: '100px', render: (u) => u.prefix },
  { kunci: 'reset', judul: 'Reset', lebar: '150px', render: (u) => LABEL_RESET[u.reset] ?? u.reset },
  {
    kunci: 'berikut', judul: 'Nomor Berikutnya', lebar: '160px', rataKanan: true,
    render: (u) => u.nomorBerikut,
  },
  { kunci: 'contoh', judul: 'Contoh', render: (u) => <span className="font-mono text-sm">{contohNomor(u)}</span> },
]

export default async function HalamanPenomoran() {
  await wajibIzin('pengaturan.penomoran.kelola')
  const urutan = await db.select().from(sequences).orderBy(asc(sequences.kode))

  return (
    <>
      <KepalaHalaman
        judul="Penomoran Dokumen"
        deskripsi="Nomor diberikan saat dokumen diposting, bukan saat draft dibuat, sehingga tidak ada lubang nomor."
      />
      <TabelData
        kolom={kolom}
        baris={urutan}
        kunciBaris={(u) => u.id}
        pesanKosong="Belum ada urutan penomoran."
      />
    </>
  )
}
```

Halaman penomoran sengaja hanya menampilkan, tidak mengubah. Mengubah nomor berikutnya secara manual berisiko menghasilkan nomor kembar pada dokumen yang sudah terbit; bila benar-benar diperlukan, itu adalah tindakan pemeliharaan basis data, bukan operasi harian.

- [ ] **Step 11: Jalankan seluruh pengujian dan bangun**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: seluruhnya berhasil

- [ ] **Step 12: Verifikasi akhir menyeluruh di peramban**

```bash
pnpm db:migrate && pnpm db:seed && pnpm dev
```

Sapu seluruh aplikasi. Setiap butir harus berhasil:

**Autentikasi**
1. `http://localhost:3000` mengalihkan ke `/masuk`
2. Login dengan kredensial salah menampilkan "Email atau kata sandi salah"
3. Login benar mendarat di `/dasbor`
4. Menu Keluar mengembalikan ke `/masuk`, dan membuka `/dasbor` setelahnya mengalihkan kembali

**Navigasi**
5. Sidebar memuat empat grup Fase 1: Dasbor, Kontak, Akuntansi, Pengaturan
6. Grup Penjualan, Pembelian, Gudang, Manufaktur, dan Proyek tidak tampil
7. Membuka satu grup menutup grup yang lain
8. `Ctrl+K` membuka palet perintah; mengetik "neraca" tidak memunculkan hasil laporan (Fase 1B) tetapi "bagan" memunculkan Bagan Akun
9. **Tidak ada satu pun menu yang menghasilkan 404**

**Master data akuntansi**
10. Bagan Akun memuat 86 akun dengan tipe berbahasa Indonesia
11. Menambah akun dengan kode yang sudah ada ditolak dengan pesan yang jelas
12. Pajak memuat empat entri dengan tarif benar
13. Jurnal memuat enam entri
14. Syarat Pembayaran memuat empat entri, terurut dari Tunai
15. Mata Uang & Kurs memuat tiga mata uang dan dua kurs contoh; mencatat kurs USD pada tanggal yang sudah ada menimpanya alih-alih menambah baris
16. Tahun Buku memuat Tahun Buku 2026 berstatus Terbuka

**Penguncian periode**
17. Mengisi tanggal kunci `2026-08-31` berhasil dan Dasbor Akuntansi menampilkan "Buku terkunci sampai 31 Agustus 2026"
18. Mencoba memundurkannya ke `2026-07-31` ditolak dengan pesan yang jelas
19. Mengosongkannya berhasil

**Kontak**
20. Menambah mitra dengan NPWP berformat titik berhasil dan NPWP tampil terformat di tabel
21. Menambah mitra tanpa mencentang Pelanggan maupun Pemasok ditolak
22. Halaman Pelanggan dan Pemasok menampilkan bagian yang sesuai dari daftar yang sama

**Pengaturan**
23. Profil Perusahaan memuat data seed dan perubahan tersimpan
24. Pengguna memuat administrator dengan peran Superuser
25. Menambah pengguna baru berhasil, dan pengguna itu dapat login
26. Menonaktifkan administrator ditolak bila ia satu-satunya pengguna aktif
27. Peran & Hak Akses menampilkan Superuser dengan badge "Akses penuh"
28. Penomoran Dokumen memuat enam urutan jurnal dengan contoh nomor yang benar

**Jejak audit**
29. Log Aktivitas memuat jejak seluruh perubahan pada langkah 11, 17, 20, 23, dan 25
30. Log tidak memuat kata sandi dalam bentuk apa pun

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(pengaturan): profil perusahaan, pengguna, peran, dan penomoran

Melengkapi empat menu terakhir Fase 1 sehingga tidak ada lagi menu yang
menghasilkan 404. Penonaktifan pengguna aktif terakhir ditolak agar sistem
tidak terkunci tanpa jalan masuk. Kata sandi tidak pernah masuk ke log
aktivitas. Halaman penomoran hanya menampilkan karena mengubah nomor
berikutnya secara manual berisiko menghasilkan nomor kembar."
```

---

## Setelah Fase 1A Selesai

Aplikasi kini berjalan dengan autentikasi, navigasi lengkap, dan seluruh master data akuntansi terkelola. Yang belum ada adalah pencatatan transaksi itu sendiri.

**Fase 1B — Mesin Jurnal & Laporan** akan menambahkan:

- Tabel `journal_entries` dan `journal_items` beserta `CHECK` constraint dan seluruh invarian dari spec bagian 2.6
- Alur draft → diposting, pembalikan entri, dan tutup buku tahunan
- Delapan laporan: Laba Rugi, Neraca, Arus Kas, Neraca Saldo, Buku Besar, Buku Besar Pembantu, Umur Piutang & Utang, Laporan Pajak
- Property test yang menghasilkan ratusan entri acak dan memastikan Neraca selalu seimbang, total debit sama dengan total kredit, dan Kas Akhir pada Arus Kas sama dengan saldo aktual akun kas dan bank

Naikkan `FASE_AKTIF` di `src/lib/navigasi.ts` hanya setelah menu fase terkait benar-benar berfungsi.
