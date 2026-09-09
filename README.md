# ERP Furni

Sistem ERP internal untuk perusahaan manufaktur furnitur. Seluruh antarmuka
berbahasa Indonesia; alur kerja mengikuti pola Odoo (draft → konfirmasi →
posting, dokumen berevolusi bertahap alih-alih berpindah tabel).

Dibangun dengan Next.js App Router, Drizzle ORM di atas PostgreSQL, dan
Auth.js. Uang tidak pernah disimpan atau dihitung sebagai `float`: PostgreSQL
memakai `numeric`, TypeScript membawa nilai sebagai `string`, dan seluruh
aritmatika lewat satu modul (`src/lib/uang.ts`, berbasis `decimal.js`).

## Cakupan

Ketujuh fase pengembangan sudah selesai:

| Fase | Cakupan |
|---|---|
| 1A/1B | Fondasi teknis, master data, mesin jurnal, delapan laporan keuangan |
| 2 | Gudang — lokasi virtual, valuasi rata-rata bergerak, operasi stok |
| 3 | Pembelian — permintaan penawaran sampai pelunasan pemasok |
| 4 | Penjualan — penawaran sampai pelunasan pelanggan, rekonsiliasi item jurnal |
| 5 | Manufaktur — bill of materials, perintah produksi, penyerapan biaya konversi |
| 6 | Aset Tetap — register aset, jadwal depresiasi, pelepasan |
| 7 | Proyek — satu proyek satu pesanan penjualan, tugas, timesheet, profitabilitas |

Rincian aturan bisnis yang tidak boleh dilanggar (presisi uang, batas antar
modul, penomoran dokumen, dsb.) ada di [`CLAUDE.md`](CLAUDE.md). Dokumen
arsitektur dan spesifikasi awal ada di `docs/superpowers/`.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **Drizzle ORM** di atas **PostgreSQL** — lokal untuk pengembangan, Neon untuk produksi
- **Auth.js v5** (JWT) untuk sesi; RBAC sudah disiapkan strukturnya (tabel
  `role_permissions`), tapi baru dipakai peran `superuser` tunggal
- **Zod** untuk validasi, **shadcn/ui** untuk komponen
- **Vitest** untuk pengujian (termasuk uji berbasis properti untuk logika
  keuangan seperti jadwal depresiasi dan valuasi persediaan)

## Menjalankan Secara Lokal

### Prasyarat

- Node.js 24+ dan pnpm
- PostgreSQL berjalan secara lokal

### Langkah

```bash
pnpm install

# Salin dan sesuaikan variabel lingkungan
cp .env.example .env.local
# isi DATABASE_URL, AUTH_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD

pnpm db:migrate   # terapkan migrasi ke basis data pengembangan
pnpm db:seed      # data awal: bagan akun, satuan, lokasi gudang, dsb. (idempoten)
pnpm dev          # server pengembangan di http://localhost:3000
```

### Perintah lain

```bash
pnpm test             # Vitest terhadap furnierp_test (migrasi berjalan otomatis)
pnpm db:generate      # hasilkan migrasi baru dari perubahan skema
pnpm db:studio        # Drizzle Studio untuk menjelajahi basis data
pnpm exec tsc --noEmit && pnpm build && pnpm lint   # verifikasi penuh sebelum commit
```

## Struktur Kode

```
src/
  app/(app)/<fase>/...        # halaman per fase, mengikuti struktur navigasi
  modules/<fase>/
    layanan/                  # logika bisnis — satu-satunya lapisan yang menyentuh DB
    validasi/                 # skema Zod dan tipe masukan
  db/
    schema/                   # skema Drizzle, satu berkas per domain
    seed/                     # data awal idempoten
  lib/
    uang.ts                   # satu-satunya jalur aritmatika uang
    navigasi.ts                # sumber tunggal struktur menu + kode izin
```

Batas modul ditegakkan lewat konvensi, bukan hanya dokumentasi: UI dan Server
Action tidak pernah mengimpor repositori atau klien basis data secara
langsung, dan hanya modul akuntansi yang menulis ke tabel jurnal — modul lain
memanggil `postingJurnalDalamTx()` / `postingJurnal()`.

## Uji

399+ uji terintegrasi (menyentuh basis data `furnierp_test` sungguhan, bukan
mock) memverifikasi bahwa setiap alur menghasilkan jurnal yang seimbang, stok
yang konsisten dengan kartu stoknya, dan penomoran dokumen yang tidak pernah
kembar — termasuk saat dokumen bertanggal mundur diposting di luar urutan
(kasus nyata yang tersingkap saat memposting depresiasi berkala).

```bash
pnpm test              # jalankan sekali
pnpm test:watch        # mode watch
```
