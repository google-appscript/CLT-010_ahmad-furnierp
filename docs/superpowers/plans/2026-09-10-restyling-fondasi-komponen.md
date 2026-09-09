# Restyling Template — Fondasi & Pustaka Komponen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bangun fondasi tema (dark blue/soft blue, dark mode), pustaka komponen form (grid 2-kolom, notebook tab, unified view/edit readonly), dan pustaka komponen list (pagination, search, filter chip, group by, favorit tersimpan) — dibuktikan lewat migrasi satu modul pilot (Penjualan → Pesanan Penjualan) sebagai referensi hidup untuk migrasi 7 modul sisanya di rencana lanjutan.

**Architecture:** Token warna baru di atas sistem OKLCH yang sudah ada; komponen form/list baru sebagai primitif yang dirangkai manual per halaman (bukan form generik berbasis skema); paginasi/filter/search/group-by list bersifat server-driven lewat `searchParams`, bukan client-side data table.

**Tech Stack:** Next.js App Router, shadcn/ui + Radix + Tailwind v4, `next-themes` (sudah terpasang), Drizzle ORM, Vitest terhadap PostgreSQL lokal sungguhan.

**Spec:** `docs/superpowers/specs/2026-09-10-restyling-template-design.md`

## Global Constraints

- Spec/plan ini sengaja minim kode penuh (functional requirement + sedikit technical detail) — kode lengkap ditulis langsung saat eksekusi task, bukan diduplikasi di sini.
- Bahasa Indonesia untuk seluruh label, pesan, dan identifier domain (nama variabel/fungsi); nama tabel database tetap bahasa Inggris.
- Uang tidak pernah `number`/`float` — nilai uang dibawa sebagai `string`, aritmatika lewat `src/lib/uang.ts`. (Relevan bila task menyentuh nilai jumlah baris.)
- Pola akses data yang sudah berlaku di codebase — **ikuti, jangan ubah**: Server Component (halaman list/detail) memanggil fungsi `layanan` secara langsung untuk *read*; mutasi dari Client Component lewat fungsi `'use server'` (Server Action). Lihat `src/app/(app)/penjualan/pesanan/page.tsx` + `daftar-pesanan.tsx` (read langsung) vs `formulir-pesanan.tsx` + `./aksi.ts` (`aksiSimpanPesanan`, mutasi lewat Server Action).
- `readOnly` pada field form adalah kontrol UX di client saja — validasi status dokumen tetap ditegakkan di layanan/Server Action, tidak berubah oleh restyling ini.
- Setiap task ditutup dengan `pnpm exec tsc --noEmit && pnpm build && pnpm lint` lolos. Untuk komponen presentasional murni (tidak ada logic testable), tidak ada test Vitest baru — verifikasi lewat type-check + build + cek visual manual di `pnpm dev` (tidak ada infrastruktur React component testing di repo ini — environment Vitest saat ini `node`, bukan `jsdom`, dan tidak ada `@testing-library/react` terpasang; jangan menambahkannya tanpa persetujuan terpisah, ikuti pola pengujian yang sudah ada: Vitest terhadap layanan/repositori dengan Postgres sungguhan).

---

## Bagian A — Fondasi Tema & Layout

### Task 1: Token warna chrome & canvas

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: token CSS baru `--chrome-background`, `--chrome-foreground`, `--chrome-muted-foreground`, `--chrome-border`, `--chrome-active`, dipetakan ke utility Tailwind `bg-chrome-background`, `text-chrome-foreground`, dst. lewat blok `@theme inline`.

- [ ] **Step 1: Tambah token baru ke `@theme inline` (baris 7–49)**

Tambahkan pemetaan berikut ke dalam blok `@theme inline` (pola sama seperti `--color-sidebar: var(--sidebar);` yang sudah ada), supaya utility class `bg-chrome-background` dst. tersedia:

```css
--color-chrome-background: var(--chrome-background);
--color-chrome-foreground: var(--chrome-foreground);
--color-chrome-muted-foreground: var(--chrome-muted-foreground);
--color-chrome-border: var(--chrome-border);
--color-chrome-active: var(--chrome-active);
```

- [ ] **Step 2: Perbarui `:root` (baris 51–84)**

Tambahkan lima token chrome baru, dan ganti nilai `--background`, `--card`, `--primary`, `--primary-foreground`, `--ring` menjadi:

```css
--background: oklch(0.97 0.003 259);
--card: oklch(1 0 0);
--primary: oklch(0.60 0.13 259);
--primary-foreground: oklch(0.99 0 0);
--ring: oklch(0.60 0.13 259);
--chrome-background: oklch(0.22 0.045 259);
--chrome-foreground: oklch(0.92 0.01 259);
--chrome-muted-foreground: oklch(0.65 0.02 259);
--chrome-border: oklch(0.30 0.04 259);
--chrome-active: oklch(0.30 0.06 259);
```

Token lain di `:root` (`--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--sidebar-*`, dll.) **tidak diubah**.

- [ ] **Step 3: Perbarui `.dark` (baris 86–118) dengan pola yang sama**

```css
--background: oklch(0.17 0.02 259);
--card: oklch(0.20 0.02 259);
--primary: oklch(0.70 0.13 259);
--primary-foreground: oklch(0.18 0.02 259);
--ring: oklch(0.70 0.13 259);
--chrome-background: oklch(0.12 0.03 259);
--chrome-foreground: oklch(0.90 0.01 259);
--chrome-muted-foreground: oklch(0.60 0.02 259);
--chrome-border: oklch(0.22 0.035 259);
--chrome-active: oklch(0.20 0.045 259);
```

- [ ] **Step 4: Verifikasi**

Run: `pnpm exec tsc --noEmit && pnpm build && pnpm lint` — harus lolos (perubahan CSS murni, tidak memengaruhi type-check tapi build harus tetap sukses). Task berikutnya (Task 3) yang memverifikasi warna ini secara visual.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(tema): token warna chrome dark blue dan aksen soft blue"
```

---

### Task 2: Aktifkan dark mode (`next-themes`)

**Files:**
- Create: `src/components/tata-letak/penyedia-tema.tsx`
- Create: `src/components/tata-letak/tombol-tema.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `PenyediaTema({ children }: { children: React.ReactNode })` — client component pembungkus `ThemeProvider` dari `next-themes` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`).
- Produces: `TombolTema()` — client component tombol ikon (Sun/Moon dari `lucide-react`) yang memanggil `setTheme` dari `useTheme()` (`next-themes`) untuk toggle `light`/`dark`. Tunda render ikon sampai `useEffect` menandai komponen sudah *mounted* (pola standar `next-themes` untuk menghindari mismatch hydration SSR/client).

- [ ] **Step 1: Buat `PenyediaTema`**

`'use client'`, mengimpor `ThemeProvider` dari `next-themes`, meneruskan `children` apa adanya dengan props di atas.

- [ ] **Step 2: Buat `TombolTema`**

`'use client'`, pakai `useTheme()` untuk baca `theme`/`resolvedTheme` dan `setTheme`. Tombol ikon (`Button variant="ghost" size="icon"`) yang toggle antara `'light'` dan `'dark'`. Guard `mounted` (state boolean di-set `true` di `useEffect`) — sebelum mounted, render placeholder kosong seukuran ikon supaya tidak ada layout shift.

- [ ] **Step 3: Bungkus root layout**

Di `src/app/layout.tsx`: tambahkan `suppressHydrationWarning` ke elemen `<html>` (wajib untuk `next-themes` dengan strategi `class`), lalu bungkus `{children}` (dan `<Toaster/>` tetap di luar atau di dalam, keduanya boleh) dengan `<PenyediaTema>`.

- [ ] **Step 4: Pasang `TombolTema` di topbar**

Modify `src/components/tata-letak/bilah-atas.tsx` — tambahkan `<TombolTema/>` di header, sejajar sebelum `DropdownMenu` user (akan disesuaikan gaya chrome-nya di Task 3).

- [ ] **Step 5: Verifikasi manual**

Run `pnpm dev`, buka halaman apa saja, klik `TombolTema` — pastikan `<html>` mendapat/kehilangan class `dark`, warna berganti sesuai token `.dark` dari Task 1, dan pilihan bertahan setelah reload (localStorage, ditangani otomatis oleh `next-themes`). Tidak ada warning hydration di console.

- [ ] **Step 6: Commit**

```bash
git add src/components/tata-letak/penyedia-tema.tsx src/components/tata-letak/tombol-tema.tsx src/app/layout.tsx src/components/tata-letak/bilah-atas.tsx
git commit -m "feat(tema): aktifkan toggle light/dark mode"
```

---

### Task 3: Restyle chrome — Sidebar, BilahAtas, BilahMenu

**Files:**
- Modify: `src/components/tata-letak/sidebar.tsx`
- Modify: `src/components/tata-letak/bilah-atas.tsx`
- Modify: `src/components/tata-letak/bilah-menu.tsx`

**Interfaces:**
- Consumes: token `bg-chrome-background`, `text-chrome-foreground`, `text-chrome-muted-foreground`, `border-chrome-border`, `bg-chrome-active` dari Task 1.

- [ ] **Step 1: `sidebar.tsx`**

- Baris 33: `bg-background` → `bg-chrome-background text-chrome-foreground`; `border-r` → `border-r border-chrome-border`.
- Baris 35: `border-b` → `border-b border-chrome-border`.
- Item grup tanpa anak aktif (baris 49–51): `bg-accent font-medium text-accent-foreground` → `bg-chrome-active font-medium text-chrome-foreground`; hover (`hover:bg-accent/50`) → `hover:bg-chrome-active/60`.
- Tombol grup dengan anak (baris 68–71): sama, `hover:bg-accent/50` → `hover:bg-chrome-active/60`.
- Item halaman di dalam seksi (baris 92–97): aktif `bg-accent font-medium text-accent-foreground` → `bg-chrome-active font-medium text-chrome-foreground`; tidak aktif `text-muted-foreground hover:bg-accent/50 hover:text-foreground` → `text-chrome-muted-foreground hover:bg-chrome-active/60 hover:text-chrome-foreground`.
- Border kiri list seksi (baris 79, `border-l`) → `border-l border-chrome-border`.

- [ ] **Step 2: `bilah-atas.tsx`**

- Baris 13: `border-b` → `border-b border-chrome-border`, tambahkan `bg-chrome-background text-chrome-foreground`.
- Baris 14–17: `text-muted-foreground` → `text-chrome-muted-foreground`; `kbd` (`bg-muted`) → `bg-chrome-active text-chrome-foreground`.
- Baris 23: badge inisial user (`bg-primary text-primary-foreground`) — **tidak diubah**, tetap kontras soft blue di atas chrome gelap.

- [ ] **Step 3: `bilah-menu.tsx`**

- Baris 24: `border-b` → `border-b border-chrome-border`, tambahkan `bg-chrome-background text-chrome-foreground`.
- Baris 26: label grup·seksi (`text-muted-foreground`) → `text-chrome-muted-foreground`.
- Baris 34–38: item aktif — ganti dari `bg-accent font-medium text-accent-foreground` menjadi indikator underline: `border-b-2 border-primary font-medium text-chrome-foreground` (bukan latar blok, garis bawah soft blue — gaya tab Odoo). Item tidak aktif: `text-muted-foreground hover:bg-accent/50 hover:text-foreground` → `text-chrome-muted-foreground hover:text-chrome-foreground`.

- [ ] **Step 4: Verifikasi manual**

Run `pnpm dev`. Cek: sidebar/topbar/bilah-menu berlatar dark blue konsisten, item aktif jelas terlihat (highlight di sidebar, underline soft blue di bilah menu), kontras teks terbaca di kedua mode (toggle dari Task 2), tidak ada elemen yang masih memakai `bg-accent`/`text-muted-foreground` lama tertinggal di tiga file ini.

- [ ] **Step 5: Commit**

```bash
git add src/components/tata-letak/sidebar.tsx src/components/tata-letak/bilah-atas.tsx src/components/tata-letak/bilah-menu.tsx
git commit -m "feat(tema): restyle sidebar, topbar, dan bilah menu ke chrome dark blue"
```

---

## Bagian B — Pustaka Komponen Form

### Task 4: `FormulirGrid`

**Files:**
- Create: `src/components/formulir/formulir-grid.tsx`

**Interfaces:**
- Produces: `FormulirGrid({ kiri, kanan }: { kiri: React.ReactNode; kanan: React.ReactNode })` — merender `<div className="grid grid-cols-1 gap-x-12 gap-y-4 lg:grid-cols-2">` dengan dua kolom (`<div className="space-y-4">{kiri}</div>` / `...{kanan}`).

- [ ] **Step 1: Implementasi** sesuai interface di atas.
- [ ] **Step 2: Verifikasi** — `pnpm exec tsc --noEmit && pnpm lint` lolos (belum ada pemakaian nyata; diverifikasi visual di Task 16).
- [ ] **Step 3: Commit** — `git commit -m "feat(formulir): tambah FormulirGrid dua kolom"`.

---

### Task 5: `FormulirField`

**Files:**
- Create: `src/components/formulir/formulir-field.tsx`

**Interfaces:**
- Produces: `FormulirField({ label, htmlFor, readOnly, valueTampilan, children }: { label: string; htmlFor?: string; readOnly?: boolean; valueTampilan?: React.ReactNode; children: React.ReactNode })`.
  - `readOnly` falsy (default): render `<Label htmlFor={htmlFor}>{label}</Label>` (dari `@/components/ui/label`) lalu `children` (input/select/textarea aktif) — sama seperti pola `<div className="space-y-2">` yang sudah ada di `formulir-pesanan.tsx` baris 142–154.
  - `readOnly` truthy: render label yang sama, lalu `<div className="py-1.5 text-sm">{valueTampilan}</div>` — **bukan** `children` — tanpa border/background input, mirip field readonly Odoo. Pemanggil bertanggung jawab menyediakan `valueTampilan` (teks/label yang sudah diresolusi, misal nama pelanggan bukan ID-nya).

- [ ] **Step 1: Implementasi** sesuai interface. Bungkus semuanya dalam `<div className="space-y-2">`.
- [ ] **Step 2: Verifikasi** — `pnpm exec tsc --noEmit && pnpm lint` lolos.
- [ ] **Step 3: Commit** — `git commit -m "feat(formulir): tambah FormulirField dengan mode readonly"`.

---

### Task 6: `FormulirBingkai`

**Files:**
- Create: `src/components/formulir/formulir-bingkai.tsx`

**Interfaces:**
- Produces: `FormulirBingkai({ breadcrumb, nomor, status, aksi, children }: { breadcrumb: { label: string; href?: string }[]; nomor: string; status?: React.ReactNode; aksi?: React.ReactNode; children: React.ReactNode })`.
  - Baris breadcrumb: setiap item dipisah `/`; item ber-`href` jadi `<Link>` (`text-muted-foreground hover:text-foreground`), item terakhir (tanpa href) teks biasa.
  - Baris judul: `<h1>{nomor}</h1>` + slot `status` (pemanggil mengirim `<Badge>` yang sudah jadi) sejajar kiri; slot `aksi` (tombol-tombol) rata kanan — layout `flex items-center justify-between`.
  - `children` dirender di bawah, `<div className="mt-6 space-y-6">`.

- [ ] **Step 1: Implementasi** sesuai interface.
- [ ] **Step 2: Verifikasi** — `pnpm exec tsc --noEmit && pnpm lint` lolos.
- [ ] **Step 3: Commit** — `git commit -m "feat(formulir): tambah FormulirBingkai dengan breadcrumb"`.

---

### Task 7: `FormulirNotebook`

**Files:**
- Create: `src/components/formulir/formulir-notebook.tsx`

**Interfaces:**
- Consumes: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` dari `@/components/ui/tabs` — **variant `"line"` sudah ada dan sudah bergaya underline** (lihat `ui/tabs.tsx` baris 26–39, 65–68) — tidak perlu mengubah file itu.
- Produces: `FormulirNotebook({ tab, tabAwal }: { tab: { id: string; label: string; children: React.ReactNode }[]; tabAwal?: string })` — merender `<Tabs defaultValue={tabAwal ?? tab[0]?.id}><TabsList variant="line">{tab.map(t => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList>{tab.map(t => <TabsContent key={t.id} value={t.id}>{t.children}</TabsContent>)}</Tabs>`.

- [ ] **Step 1: Implementasi** sesuai interface.
- [ ] **Step 2: Verifikasi** — `pnpm exec tsc --noEmit && pnpm lint` lolos.
- [ ] **Step 3: Commit** — `git commit -m "feat(formulir): tambah FormulirNotebook berbasis Tabs variant line"`.

---

### Task 8: `FormulirBarisTabel`

**Files:**
- Create: `src/components/formulir/formulir-baris-tabel.tsx`

**Interfaces:**
- Consumes: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` dari `@/components/ui/table`; `Button` dari `@/components/ui/button`; ikon `Plus`, `Trash2` dari `lucide-react`.
- Produces generik `FormulirBarisTabel<T>({ kolom, baris, onTambahBaris, onHapusBaris, labelTambah, minimalBaris, readOnly }: { kolom: { kunci: string; judul: string; render: (baris: T, index: number) => React.ReactNode; lebar?: string; rataKanan?: boolean }[]; baris: T[]; onTambahBaris?: () => void; onHapusBaris?: (index: number) => void; labelTambah?: string; minimalBaris?: number; readOnly?: boolean })`.
  - Header "Tambah Baris" (tombol `Plus`, disembunyikan bila `readOnly` atau `onTambahBaris` tidak diberikan) — pola sama seperti `formulir-pesanan.tsx` baris 209–217.
  - Tabel: kolom dari prop `kolom`, ditutup kolom hapus (ikon `Trash2`, disabled bila `baris.length <= (minimalBaris ?? 1)` atau `readOnly`) — pola sama seperti baris 219–316 tapi generik untuk `T` apa pun, bukan hanya `BarisFormulir` penjualan.
  - Setiap sel body memanggil `k.render(b, i)` — pemanggil (halaman form) yang menaruh `<Input>`/`<Select>` aktual per kolom, `FormulirBarisTabel` sendiri tidak tahu bentuk editor per kolom.

- [ ] **Step 1: Implementasi** sesuai interface di atas.
- [ ] **Step 2: Verifikasi** — `pnpm exec tsc --noEmit && pnpm lint` lolos.
- [ ] **Step 3: Commit** — `git commit -m "feat(formulir): tambah FormulirBarisTabel generik untuk child list"`.

---

## Bagian C — Pustaka Komponen List

### Task 9: Kontrak bersama `ParameterDaftar` / `HasilDaftar<T>`

**Files:**
- Create: `src/lib/daftar.ts`
- Test: `tests/lib/daftar.test.ts`

**Interfaces:**
- Produces:
  - `type ParameterDaftar = { cari?: string; filter?: Record<string, string[]>; kelompokkan?: string; urutkan?: { kolom: string; arah: 'asc' | 'desc' }; halaman: number; ukuranHalaman: number }`
  - `type HasilDaftar<T> = { data: T[]; totalBaris: number; grup?: { nilai: string; jumlah: number }[] }`
  - `uraikanParameterDaftar(searchParams: URLSearchParams): ParameterDaftar` — parsing `?q=`, `?filter=status:draft,posted&filter=pelanggan:xyz` (format `field:nilai1,nilai2`, boleh berulang per field), `?group=`, `?sort=kolom:asc`, `?hal=`, `?ukuran=` (default `halaman=1`, `ukuranHalaman=20`).
  - `serialisasiParameterDaftar(param: Partial<ParameterDaftar>, base: URLSearchParams): URLSearchParams` — kebalikan dari `uraikanParameterDaftar`, dipakai `PanelPencarian` untuk membangun URL baru saat state berubah (mis. ganti halaman tapi pertahankan filter yang ada).

- [ ] **Step 1: Tulis test untuk `uraikanParameterDaftar`**

```typescript
import { describe, expect, it } from 'vitest'
import { uraikanParameterDaftar, serialisasiParameterDaftar } from '@/lib/daftar'

describe('uraikanParameterDaftar', () => {
  it('mem-parsing filter jamak per field sebagai OR, field berbeda sebagai entri terpisah', () => {
    const sp = new URLSearchParams('q=budi&filter=status:draft,posted&filter=pelanggan:xyz&group=pelanggan&sort=tanggal:desc&hal=2&ukuran=50')
    const hasil = uraikanParameterDaftar(sp)
    expect(hasil).toEqual({
      cari: 'budi',
      filter: { status: ['draft', 'posted'], pelanggan: ['xyz'] },
      kelompokkan: 'pelanggan',
      urutkan: { kolom: 'tanggal', arah: 'desc' },
      halaman: 2,
      ukuranHalaman: 50,
    })
  })

  it('memberi default halaman=1 dan ukuranHalaman=20 saat kosong', () => {
    const hasil = uraikanParameterDaftar(new URLSearchParams(''))
    expect(hasil.halaman).toBe(1)
    expect(hasil.ukuranHalaman).toBe(20)
  })
})

describe('serialisasiParameterDaftar', () => {
  it('mempertahankan parameter lain saat hanya mengubah halaman', () => {
    const base = new URLSearchParams('q=budi&filter=status:draft&hal=1')
    const hasil = serialisasiParameterDaftar({ halaman: 3 }, base)
    expect(hasil.get('hal')).toBe('3')
    expect(hasil.get('q')).toBe('budi')
    expect(hasil.get('filter')).toBe('status:draft')
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal (fungsi belum ada)**

Run: `pnpm exec vitest run tests/lib/daftar.test.ts` — Expected: FAIL (`uraikanParameterDaftar is not defined` atau serupa).

- [ ] **Step 3: Implementasikan `src/lib/daftar.ts`** sesuai kontrak Interfaces di atas hingga test lolos.

- [ ] **Step 4: Jalankan test lagi**

Run: `pnpm exec vitest run tests/lib/daftar.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/daftar.ts tests/lib/daftar.test.ts
git commit -m "feat(list): kontrak ParameterDaftar/HasilDaftar dan parsing URL"
```

---

### Task 10: Tabel `filter_tersimpan`

**Files:**
- Create: `src/db/schema/filter-tersimpan.ts`
- Modify: `src/db/schema/index.ts`

**Interfaces:**
- Produces: tabel Drizzle `filterTersimpan` — kolom: `id` (uuid, pk, default random), `penggunaId` (uuid, fk ke tabel `users`, not null), `kunciDaftar` (text, not null — contoh nilai: `'penjualan.pesanan'`), `nama` (text, not null), `kriteria` (jsonb, not null — menyimpan `ParameterDaftar` minus `halaman`), `dibuatPada` (timestamp, default `now()`).

- [ ] **Step 1: Definisikan skema** di `src/db/schema/filter-tersimpan.ts`, ikuti persis konvensi yang dipakai `src/db/schema/proyek.ts` (`pgTable`, `uuid('id').primaryKey().defaultRandom()`, `timestamp(..., { withTimezone: true }).notNull().defaultNow()`, `references(() => users.id)` dari `./identitas`):

```typescript
import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { users } from './identitas'

export const filterTersimpan = pgTable('filter_tersimpan', {
  id: uuid('id').primaryKey().defaultRandom(),
  penggunaId: uuid('pengguna_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kunciDaftar: text('kunci_daftar').notNull(),
  nama: text('nama').notNull(),
  kriteria: jsonb('kriteria').notNull(),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
})
```

- [ ] **Step 2: Re-export** dari `src/db/schema/index.ts` mengikuti pola export tabel lain di file itu (cek isi file itu dulu untuk tahu apakah pola-nya `export *` per file atau named export manual).
- [ ] **Step 3: Generate migrasi**

Run: `pnpm db:generate` — periksa file migrasi baru di `drizzle/` masuk akal (satu tabel baru, kolom sesuai Step 1).

- [ ] **Step 4: Terapkan migrasi**

Run: `pnpm db:migrate`.

- [ ] **Step 5: Verifikasi**

Run: `pnpm exec tsc --noEmit` — lolos (tidak ada test langsung untuk skema, diuji lewat Task 11).

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/filter-tersimpan.ts src/db/schema/index.ts drizzle/
git commit -m "feat(list): tabel filter_tersimpan untuk favorit pencarian"
```

---

### Task 11: Layanan + Server Action `filter_tersimpan`

**Files:**
- Create: `src/modules/preferensi/repositori/filter-tersimpan.ts`
- Create: `src/modules/preferensi/layanan/filter-tersimpan.ts`
- Create: `src/app/(app)/_bersama/aksi-filter-tersimpan.ts`
- Test: `tests/preferensi/filter-tersimpan.test.ts`

**Interfaces:**
- Produces (repositori): `simpanFilter(data: { penggunaId: string; kunciDaftar: string; nama: string; kriteria: unknown }): Promise<{ id: string }>`, `daftarFilter(penggunaId: string, kunciDaftar: string): Promise<{ id: string; nama: string; kriteria: unknown }[]>`, `hapusFilter(id: string, penggunaId: string): Promise<void>` (hapus hanya jika `penggunaId` cocok — tidak boleh menghapus favorit pengguna lain).
- Produces (layanan): fungsi dengan nama sama, membungkus repositori + validasi Zod untuk `kunciDaftar`/`nama` (tidak kosong).
- Produces (Server Action, `'use server'`): `simpanFilterFavoritAction(kunciDaftar: string, nama: string, kriteria: unknown)`, `hapusFilterFavoritAction(id: string)` — ambil `penggunaId` dari sesi (`ambilSesi()`, pola sama seperti `aksi-keluar.ts`), panggil layanan, `return { berhasil: boolean; pesan?: string }`.

- [ ] **Step 1: Tulis test layanan (Postgres sungguhan)**

Tidak ada helper pembuat "pengguna uji" bersama di `tests/bantuan/` — yang ada hanya `bersihkanTabel(namaTabel: string[])` dan `tutupKoneksi()` (`tests/bantuan/db.ts`). Setiap file test menyiapkan fixture-nya sendiri lewat `db.insert(...)` langsung di `beforeEach` (lihat pola di `tests/penjualan/alur.test.ts` baris 49–52). Test ini jauh lebih ringan — tidak butuh fixture akuntansi/gudang, hanya tabel `users` dan `filter_tersimpan`:

```typescript
import { describe, expect, it, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/klien'
import { users } from '@/db/schema'
import { simpanFilter, daftarFilter, hapusFilter } from '@/modules/preferensi/layanan/filter-tersimpan'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

async function buatPengguna(email: string) {
  const [u] = await db.insert(users)
    .values({ email, nama: 'Pengguna Uji', passwordHash: 'x' })
    .returning()
  return u
}

describe('filter tersimpan', () => {
  beforeEach(async () => {
    await bersihkanTabel(['filter_tersimpan', 'users'])
  })
  afterAll(tutupKoneksi)

  it('menyimpan lalu memunculkan favorit di daftarFilter', async () => {
    const pengguna = await buatPengguna('a@uji.test')
    await simpanFilter({
      penggunaId: pengguna.id, kunciDaftar: 'penjualan.pesanan',
      nama: 'Draft Bulan Ini', kriteria: { filter: { status: ['penawaran'] } },
    })
    const daftar = await daftarFilter(pengguna.id, 'penjualan.pesanan')
    expect(daftar).toHaveLength(1)
    expect(daftar[0].nama).toBe('Draft Bulan Ini')
  })

  it('tidak menghapus favorit milik pengguna lain', async () => {
    const a = await buatPengguna('a@uji.test')
    const b = await buatPengguna('b@uji.test')
    const { id } = await simpanFilter({
      penggunaId: a.id, kunciDaftar: 'penjualan.pesanan', nama: 'X', kriteria: {},
    })
    await hapusFilter(id, b.id)
    const daftar = await daftarFilter(a.id, 'penjualan.pesanan')
    expect(daftar).toHaveLength(1) // masih ada, tidak terhapus oleh pengguna lain
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `pnpm test -- tests/preferensi/filter-tersimpan.test.ts` — Expected: FAIL (modul belum ada).

- [ ] **Step 3: Implementasikan repositori lalu layanan** sesuai Interfaces di atas hingga test lolos.

- [ ] **Step 4: Jalankan test lagi** — Expected: PASS.

- [ ] **Step 5: Implementasikan Server Action** `src/app/(app)/_bersama/aksi-filter-tersimpan.ts` sesuai Interfaces (tidak perlu test terpisah — logic intinya sudah diuji di layanan; Server Action hanya pemetaan sesi + pemanggilan).

- [ ] **Step 6: Verifikasi tipe**

Run: `pnpm exec tsc --noEmit && pnpm lint`.

- [ ] **Step 7: Commit**

```bash
git add src/modules/preferensi tests/preferensi src/app/\(app\)/_bersama/aksi-filter-tersimpan.ts
git commit -m "feat(list): layanan dan aksi simpan/hapus filter favorit"
```

---

### Task 12: `PanelPencarian`

**Files:**
- Create: `src/components/data/panel-pencarian.tsx`

**Interfaces:**
- Consumes: `uraikanParameterDaftar`/`serialisasiParameterDaftar` dari `@/lib/daftar` (Task 9); `simpanFilterFavoritAction`/`hapusFilterFavoritAction` dari Task 11; `useRouter`/`useSearchParams`/`usePathname` dari `next/navigation`.
- Produces: `PanelPencarian({ kunciDaftar, kolomFilter, kolomGroupBy, favorit }: { kunciDaftar: string; kolomFilter: { kunci: string; label: string; opsi: { nilai: string; label: string }[] }[]; kolomGroupBy: { kunci: string; label: string }[]; favorit: { id: string; nama: string; kriteria: ParameterDaftar }[] })`.
  - Search box: `Input` terkontrol, `onChange` men-debounce (300ms) lalu `router.push` dengan `q` baru via `serialisasiParameterDaftar` (reset `hal` ke 1).
  - Dropdown "Filter": per `kolomFilter`, checkbox multi-pilih per opsi → menambah/menghapus dari `filter[kunci]` di URL. Chip aktif dirender di bawah search box (label `field: nilai`, tombol × menghapus satu nilai).
  - Dropdown "Group By": daftar `kolomGroupBy`, memilih satu mengisi `group` di URL (pilih ulang yang sama = hapus/nonaktifkan).
  - Dropdown "Favorit": menampilkan `favorit`, klik salah satu menerapkan `kriteria`-nya ke URL sekaligus (replace semua parameter filter/search/group); tombol "Simpan filter saat ini" membuka `Dialog` kecil minta `nama`, memanggil `simpanFilterFavoritAction(kunciDaftar, nama, parameterSaatIni)` lalu `router.refresh()`.
  - Semua interaksi mengubah URL (`router.push(pathname + '?' + params, { scroll: false })`) — komponen ini **tidak menyimpan hasil query**, hanya mengubah `searchParams`; Server Component pemanggil (halaman list) yang membaca ulang data.

- [ ] **Step 1: Implementasi** sesuai interface di atas, pakai `Input`, `Button`, `DropdownMenu*`/`Popover` (untuk checkbox multi-pilih), `Dialog` yang sudah ada di `@/components/ui/*`.
- [ ] **Step 2: Verifikasi** — `pnpm exec tsc --noEmit && pnpm lint` lolos (verifikasi perilaku nyata di Task 15 saat dipakai halaman list Penjualan).
- [ ] **Step 3: Commit** — `git commit -m "feat(list): tambah PanelPencarian (search, filter chip, group by, favorit)"`.

---

### Task 13: Evolusi `TabelData`

**Files:**
- Modify: `src/components/data/tabel-data.tsx`

**Interfaces:**
- Produces (tambahan pada `TabelData<T>`, props existing `kolom`/`baris`/`kunciBaris`/`pesanKosong` **tidak berubah** — backward compatible untuk pemakai lama di halaman master data): tambahan props opsional `{ hrefBaris?: (baris: T) => string; pagination?: { halaman: number; ukuranHalaman: number; totalBaris: number }; pengelompokan?: { kelompokkanDari: (baris: T) => string; label: (nilaiGrup: string) => string } }`.
  - `hrefBaris` diberikan: bungkus `<TableRow>` jadi bisa diklik (`onClick` → `router.push(hrefBaris(b))`, `className="cursor-pointer"`), kolom aksi "Buka" **tidak lagi ditulis oleh pemanggil** (halaman list menghapusnya dari `kolom`).
  - `pagination` diberikan: render pager di bawah tabel — teks `"${dari}-${sampai} / ${totalBaris}"` + tombol prev/next (`Button variant="outline" size="icon"`, disabled di batas), mengubah `hal` di URL lewat `serialisasiParameterDaftar` (pola sama seperti `PanelPencarian`).
  - `pengelompokan` diberikan: kelompokkan `baris` di client (input `baris` sudah terfilter dari server, grouping hanya mengelompokkan tampilan pada baris-baris yang sudah diterima untuk *page* saat ini — bukan re-query), render tiap grup sebagai `<TableRow>` header (judul grup + jumlah baris, `onClick` toggle collapse via `useState<Set<string>>`) diikuti baris-baris anggotanya bila grup terbuka.

- [ ] **Step 1: Implementasi penambahan** di atas struktur `TabelData` yang sudah ada (baris 12–58 saat ini) — pertahankan seluruh perilaku lama saat props baru tidak diberikan.
- [ ] **Step 2: Verifikasi** — `pnpm exec tsc --noEmit && pnpm lint` lolos; pastikan halaman master data existing yang sudah memakai `TabelData` (cek beberapa di `pengaturan/*`, `akuntansi/konfigurasi/*`) tetap render tanpa error (props baru semua opsional).
- [ ] **Step 3: Commit** — `git commit -m "feat(list): TabelData dukung klik baris, pagination, dan group by"`.

---

## Bagian D — Pilot Migrasi: Penjualan → Pesanan Penjualan

### Task 14: Extend `daftarPesanan()` menerima `ParameterDaftar`

**Files:**
- Modify: `src/modules/penjualan/layanan/pesanan.ts`
- Test: `tests/penjualan/alur.test.ts` — satu-satunya file test modul penjualan saat ini (tidak ada test khusus `daftarPesanan` sebelumnya); tambahkan `describe` baru di file ini, ikuti pola fixture `beforeEach` yang sudah ada di sana (baris 49 dst. — insert `currencies`, `accounts`, `companySettings`, dll. sebelum bisa membuat pesanan lewat `buatPesanan()`).

**Interfaces:**
- Modifies: `daftarPesanan(param: ParameterDaftar & { status?: Pesanan['status'] }): Promise<HasilDaftar<Pesanan>>` — signature lama `daftarPesanan(filter?: { status?: ... })` diperluas, **bukan** breaking di pemanggil lama karena seluruh field `ParameterDaftar` opsional kecuali `halaman`/`ukuranHalaman` (beri default di dalam fungsi bila pemanggil lama tidak mengirim keduanya).
  - `cari` mencari di kolom `nomor` dan nama mitra terkait (join `partners`).
  - `filter.status` bila ada menyaring `IN (...)` (selaras dengan `status` lama, gabungkan keduanya).
  - `urutkan` default `{ kolom: 'tanggal', arah: 'desc' }` bila tidak diberikan.
  - `halaman`/`ukuranHalaman` diterjemahkan ke `limit`/`offset` Drizzle.
  - Return `{ data, totalBaris }` — `totalBaris` dari `count(*)` query terpisah dengan filter yang sama (tanpa limit/offset).

- [ ] **Step 1: Tambahkan `describe('daftarPesanan', ...)` baru** di `tests/penjualan/alur.test.ts`, memakai fixture yang sudah dibangun `beforeEach` (partner/produk/lokasi/dst. dari baris 49 dst.) dan `buatPesanan()` yang sudah diimpor untuk membuat 2–3 pesanan dengan status/tanggal berbeda. Test minimal: (a) `cari` menyaring berdasarkan nomor atau nama mitra, (b) `filter: { status: [...] }` menyaring status, (c) `halaman`/`ukuranHalaman` membatasi jumlah `data` dan `totalBaris` tetap menghitung total sesungguhnya (bukan cuma panjang `data`).
- [ ] **Step 2: Jalankan test, pastikan test baru gagal**

Run: `pnpm test -- tests/penjualan/alur.test.ts`.

- [ ] **Step 3: Implementasikan** perluasan `daftarPesanan()` sesuai Interfaces.
- [ ] **Step 4: Jalankan test lagi** — semua (lama + baru) harus lolos.
- [ ] **Step 5: Commit**

```bash
git add src/modules/penjualan/layanan/pesanan.ts tests/penjualan/
git commit -m "feat(penjualan): daftarPesanan dukung search, filter, sort, dan pagination"
```

---

### Task 15: Migrasi halaman list Pesanan Penjualan

**Files:**
- Modify: `src/app/(app)/penjualan/daftar-pesanan.tsx`
- Modify: `src/app/(app)/penjualan/pesanan/page.tsx`

**Interfaces:**
- Consumes: `PanelPencarian` (Task 12), `TabelData` yang dievolusi (Task 13), `daftarPesanan()` baru (Task 14), `daftarFilter()` (Task 11) untuk memuat favorit tersimpan milik `kunciDaftar: 'penjualan.pesanan'`.

- [ ] **Step 1: `pesanan/page.tsx`** — terima `searchParams` (Next.js App Router page prop), urai lewat `uraikanParameterDaftar`, teruskan ke `DaftarPesanan`. Render `<PanelPencarian kunciDaftar="penjualan.pesanan" .../>` di atas `<DaftarPesanan/>` (di bawah `KepalaHalaman` yang sudah ada, tidak diubah).
- [ ] **Step 2: `daftar-pesanan.tsx`** — ganti pemanggilan `daftarPesanan(status ? {status} : {})` (baris 18) jadi `daftarPesanan(param)` dengan `param: ParameterDaftar` dari props. Hapus `<table>` mentah (baris 34–71), ganti dengan `<TabelData kolom={...} baris={hasil.data} kunciBaris={p => p.id} hrefBaris={p => \`/penjualan/pesanan/${p.id}\`} pagination={{halaman: param.halaman, ukuranHalaman: param.ukuranHalaman, totalBaris: hasil.totalBaris}} pengelompokan={param.kelompokkan ? {...} : undefined} />`. Kolom "Buka" (baris 61–65 lama) dihapus — navigasi sekarang lewat klik baris.
- [ ] **Step 3: Verifikasi tipe & lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`.

- [ ] **Step 4: Verifikasi manual**

Run `pnpm dev`, buka `/penjualan/pesanan`. Cek: search box menyaring hasil, dropdown filter status menambah chip dan menyaring, group by mengelompokkan baris, pager muncul dan berfungsi, klik baris mana pun membuka detail (bukan tombol terpisah), simpan filter sebagai favorit lalu panggil ulang dari dropdown favorit.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/penjualan/daftar-pesanan.tsx src/app/\(app\)/penjualan/pesanan/page.tsx
git commit -m "feat(penjualan): migrasi daftar pesanan ke PanelPencarian dan TabelData baru"
```

---

### Task 16: Migrasi `FormulirPesanan` ke primitif form baru

**Files:**
- Modify: `src/app/(app)/penjualan/formulir-pesanan.tsx`

**Interfaces:**
- Consumes: `FormulirBingkai`, `FormulirGrid`, `FormulirField`, `FormulirNotebook`, `FormulirBarisTabel` (Bagian B).
- Modifies `NilaiAwalPesanan['baris']` (tipe `BarisFormulir`, baris 22–29 saat ini): tambah dua field opsional `kuantitasDikirim?: string` dan `kuantitasDifakturkan?: string` — hanya terisi saat `readOnly` (datanya dari `barisDenganSisa()`, lihat Task 17), `undefined` saat draft (field-field ini tidak pernah ada saat status masih `penawaran` karena belum ada pengiriman/faktur).
- Modifies `FormulirPesanan` props — tambah: `readOnly?: boolean` (default `false`), `nomor?: string` (nomor dokumen sesungguhnya, hanya ada untuk dokumen ber-status non-draft — draft belum bernomor), `aksiTambahan?: React.ReactNode` (slot untuk `AksiPenawaran` saat draft atau `DialogKirimBarang`/tombol Buat Faktur saat non-draft — keduanya sekarang dirender di level halaman `[id]/page.tsx`, lihat Task 17), `dokumenTerkait?: { pengiriman: { operasiId: string; nomor: string; tanggal: string }[]; faktur: { id: string; nomor: string | null; status: string }[] }` (untuk tab "Lainnya", `undefined`/kosong saat draft).

**Catatan penting — dua set kolom baris, bukan satu kolom yang sekadar di-readonly-kan:** halaman detail non-draft saat ini menampilkan kolom **Dipesan/Dikirim/Difakturkan** (progres, dari `barisDenganSisa()`), bukan kolom **Kuantitas/Satuan** yang editable seperti draft (lihat `pesanan/[id]/page.tsx` baris 128–134 vs `formulir-pesanan.tsx` baris 223–229 saat ini). Jangan coba memaksakan satu `kolom` yang sama untuk kedua mode — definisikan dua konstanta terpisah di dalam file ini, `KOLOM_EDIT` (6 kolom + Jumlah, seperti sekarang) dan `KOLOM_READONLY` (Produk, Dipesan, Dikirim, Difakturkan, Harga Jual, Pajak, Jumlah — tanpa kolom Hapus), lalu pilih salah satu berdasarkan `readOnly` saat memanggil `FormulirBarisTabel`.

- [ ] **Step 1: Bungkus dengan `FormulirBingkai`**

Breadcrumb `[{label: 'Penjualan'}, {label: 'Pesanan Penjualan', href: '/penjualan/pesanan'}, {label: nomor ?? 'Penawaran Baru'}]`. `status` slot: `undefined` saat draft (tidak ada badge status di draft sekarang), diisi pemanggil saat non-draft (lihat Task 17). `aksi` slot: gabungan `aksiTambahan` (dari prop) + tombol Simpan/Batal yang sekarang ada di baris 335–340 (Simpan/Batal **disembunyikan sepenuhnya** saat `readOnly`, karena dokumen non-draft tidak lagi bisa disimpan lewat form ini).

- [ ] **Step 2: Ganti grid header field (baris 141–182 dan 184–206) jadi `FormulirGrid`**

Field yang sama seperti sekarang (Pelanggan, Tanggal, Tanggal Pengiriman di kolom kiri; Gudang Asal, Syarat Pembayaran, Referensi, Catatan di kolom kanan — pembagian persis bebas ditentukan implementer). Setiap field dibungkus `FormulirField` dengan `readOnly={readOnly}` dan `valueTampilan` terisi dari data yang sudah tersedia di komponen (mis. Pelanggan: `pelanggan.find(p => p.id === partnerId)?.nama ?? '—'`).

- [ ] **Step 3: Bungkus tabel baris + dokumen terkait dengan `FormulirNotebook`**

Tab `"Baris Pesanan"`: `FormulirBarisTabel` dengan `kolom={readOnly ? KOLOM_READONLY : KOLOM_EDIT}`, `baris={baris}`, `onTambahBaris`/`onHapusBaris` hanya diteruskan saat `!readOnly`. `KOLOM_EDIT.render` sama seperti isi `<td>` baris 236–301 sekarang (Select/Input aktif). `KOLOM_READONLY.render` sama seperti isi `<td>` `pesanan/[id]/page.tsx` baris 140–158 sekarang, dibaca dari `baris[i].kuantitasDikirim`/`kuantitasDifakturkan`. Ringkasan `dl` (baris 318–332 sekarang) tetap di bawah tabel, tidak berubah — nilainya tetap dihitung dari state `baris` yang sama baik saat edit maupun readOnly. Tab kedua `"Lainnya"`: render `dokumenTerkait` bila ada (dua daftar Pengiriman/Faktur seperti `pesanan/[id]/page.tsx` baris 181–227 sekarang, dipindah ke sini apa adanya) — kosongkan/sembunyikan tab ini bila `dokumenTerkait` tidak diberikan (draft).

- [ ] **Step 4: Sembunyikan area aksi lama (baris 335–340)** — sudah pindah ke slot `aksi` `FormulirBingkai` di Step 1.

- [ ] **Step 5: Verifikasi tipe & lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/penjualan/formulir-pesanan.tsx
git commit -m "feat(penjualan): migrasi FormulirPesanan ke primitif formulir baru dengan mode readOnly"
```

---

### Task 17: Satukan halaman detail Pesanan Penjualan (view = edit)

**Files:**
- Modify: `src/app/(app)/penjualan/pesanan/[id]/page.tsx`

**Interfaces:**
- Consumes: `FormulirPesanan` dengan props `readOnly`/`nomor`/`aksiTambahan`/`dokumenTerkait` (Task 16).

- [ ] **Step 1: Satukan kedua cabang (baris 37–68 dan 70–236 saat ini) jadi satu alur**

Ambil `sisa`, `total`, `pengiriman`, `semuaMitra`, `semuaLokasi`, `semuaPajak`, `fakturTerkait` (baris 70–80 sekarang) **selalu**, bukan hanya di cabang non-draft — `barisDenganSisa()` untuk pesanan draft akan mengembalikan baris dengan `kuantitasDikirim`/`kuantitasDifakturkan` bernilai nol, aman dipakai. Map `sisa` ke `awal.baris` (tipe `BarisFormulir` yang sudah diperluas Task 16) **hanya saat non-draft**; saat draft tetap map dari `pesanan.baris` seperti kode lama baris 55–62 (supaya baris kosong/baru yang belum tersimpan tidak hilang saat draft diedit ulang — `barisDenganSisa()` hanya mengenal baris yang sudah tersimpan di DB).

- [ ] **Step 2: Hapus `KepalaHalaman` dari halaman ini** — breadcrumb, judul (`nomor`), dan slot aksi sekarang semuanya berasal dari `FormulirBingkai` di dalam `FormulirPesanan` (Task 16). `KepalaHalaman` sendiri **tidak dihapus dari codebase** — tetap dipakai halaman lain seperti `pesanan/page.tsx`.

- [ ] **Step 3: Render satu `<FormulirPesanan>`**

```
readOnly={pesanan.status !== 'penawaran'}
nomor={pesanan.nomor ?? undefined}
aksiTambahan={
  pesanan.status === 'penawaran'
    ? <AksiPenawaran id={pesanan.id} />
    : pesanan.status === 'dikonfirmasi'
      ? <div className="flex gap-3"><DialogKirimBarang .../>{adaSisaDifakturkan && <Button ...>Buat Faktur</Button>}</div>
      : undefined
}
dokumenTerkait={pesanan.status !== 'penawaran' ? { pengiriman, faktur: fakturTerkait } : undefined}
```
(`DialogKirimBarang`/`adaSisaDifakturkan` dibangun persis seperti baris 92–109 sekarang, dipindah ke sini.)

- [ ] **Step 4: Hapus tombol "Kembali ke Daftar" (baris 229–233 sekarang)** — breadcrumb `FormulirBingkai` sudah menggantikan fungsinya (klik "Pesanan Penjualan" di breadcrumb kembali ke daftar).

- [ ] **Step 5: Verifikasi tipe & lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`.

- [ ] **Step 6: Verifikasi manual**

Run `pnpm dev`. Buka satu pesanan berstatus `penawaran` (draft) — seluruh field bisa diedit seperti sebelumnya, tombol konfirmasi (`AksiPenawaran`) tetap berfungsi. Buka satu pesanan berstatus `dikonfirmasi` — field header tampil readonly (teks polos), tabel baris menampilkan kolom Dipesan/Dikirim/Difakturkan (bukan input), tombol Kirim Barang/Buat Faktur tetap berfungsi, tab "Lainnya" menampilkan link Pengiriman/Faktur yang bisa diklik, breadcrumb bisa dipakai kembali ke daftar.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/penjualan/pesanan/\[id\]/page.tsx
git commit -m "feat(penjualan): satukan halaman detail pesanan jadi satu form dengan mode readonly"
```

---

### Task 18: Verifikasi menyeluruh Bagian D

**Files:** tidak ada file baru — task verifikasi murni.

- [ ] **Step 1: Full check**

Run: `pnpm exec tsc --noEmit && pnpm build && pnpm lint && pnpm test`.

- [ ] **Step 2: Smoke test manual end-to-end** di `pnpm dev`, modul Penjualan → Pesanan Penjualan saja (modul lain belum dimigrasi, masih tampil dengan pola lama — itu wajar untuk task ini):

  - Toggle dark mode dari topbar — chrome & canvas berganti konsisten.
  - Daftar Pesanan: search, filter status (chip), group by pelanggan, pagination, klik baris membuka detail.
  - Buat penawaran baru — grid 2 kolom, tab notebook, tambah/hapus baris, simpan berhasil.
  - Buka penawaran (draft) — seluruh field editable.
  - Konfirmasi lalu buka lagi — field readonly, tombol aksi kontekstual & link dokumen terkait masih berfungsi.

- [ ] **Step 3: Catat penyimpangan bila ada** (tidak wajib memperbaiki di task ini bila ternyata di luar scope Bagian D — cukup dicatat untuk rencana lanjutan Bagian E).

---

## Rencana Lanjutan (di luar plan ini)

Setelah Bagian D terbukti berjalan, sisa 7 modul (Kontak, Pembelian, Gudang, Manufaktur, Akuntansi, Aset, Proyek) dimigrasi lewat rencana implementasi terpisah yang ditulis setelah pola dari Bagian D tervalidasi — supaya detail per-modul (kolom filter apa saja, field mana yang dikelompokkan kiri/kanan, dst.) ditulis dari observasi kode yang sesungguhnya per modul, bukan diasumsikan di muka.
