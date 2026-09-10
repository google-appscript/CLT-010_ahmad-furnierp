# ERP Furni

Sistem ERP internal untuk perusahaan manufaktur furnitur. Seluruh antarmuka
berbahasa Indonesia; alur kerja mengikuti pola Odoo (draft → konfirmasi →
posting, dokumen berevolusi bertahap alih-alih berpindah tabel).

Dibangun dengan Next.js App Router, Drizzle ORM di atas PostgreSQL, dan
Auth.js. Uang tidak pernah disimpan atau dihitung sebagai `float`: PostgreSQL
memakai `numeric`, TypeScript membawa nilai sebagai `string`, dan seluruh
aritmatika lewat satu modul (`src/lib/uang.ts`, berbasis `decimal.js`).

## Latar Belakang Kebutuhan

Di luar alur ERP standar, pemilik usaha mengajukan empat kebutuhan spesifik
yang membentuk arah pengembangan sistem ini. Keempatnya sudah terpenuhi.

### 1. Jurnal otomatis yang dapat dikonfigurasi

Setiap alur — penjualan, pembelian, gudang, produksi, aset, pembayaran —
memposting jurnalnya sendiri tanpa entri manual. Yang membedakannya dari
posting otomatis yang kaku: **jurnal tujuan dan akun penampungnya adalah data,
bukan kode**. Layar *Akuntansi → Konfigurasi → Pemetaan Jurnal* memuat sembilan
pemetaan jurnal dan sembilan akun otomatis yang dapat diubah kapan saja.

Memindahkan pergerakan stok dari Jurnal Penyesuaian Persediaan ke Jurnal Umum,
misalnya, cukup mengganti satu pilihan; penerimaan barang berikutnya langsung
mengikuti, sementara dokumen yang sudah diposting tetap memegang jurnal yang
berlaku saat itu. Kategori produk dan kategori aset punya kelengkapan yang
sama pada tingkat yang lebih rinci — masing-masing menetapkan akun persediaan,
HPP, selisih, dan barang rusaknya sendiri, dan sistem menolak akun yang tipenya
tidak cocok dengan perannya.

### 2. Pos biaya mengambang (floating cost center)

Pengeluaran operasional dikelompokkan ke tiga unit kerja: **Bahan Baku**,
**Workshop**, dan **Showroom Ekspor**. Satu baris jurnal dapat sepenuhnya
menjadi milik satu pos, atau **dibagi berpersentase ke beberapa pos sekaligus**
— karena itulah disebut mengambang. Persentasenya wajib berjumlah tepat
seratus dan baris terakhir menyerap sisa pembulatan, sehingga jumlah alokasi
selalu persis sama dengan nilai bebannya.

Alokasi disimpan di tabel sampingan; baris jurnalnya sendiri tetap utuh,
sehingga buku besar tidak berubah bentuk hanya karena sebuah beban dibagi.
Lokasi gudang internal dapat menunjuk pos bawaannya agar pergerakan stok
teralokasi tanpa dipilih manual. Laporan Laba Rugi per Pos menampilkan beban
yang belum dialokasikan sebagai barisnya sendiri, sehingga totalnya selalu
sama dengan Laporan Laba Rugi biasa.

### 3. Multi-owner dan bagi hasil

Kepemilikan dicatat sebagai susunan berlaku per rentang tanggal, dengan porsi
tiap pemilik yang wajib berjumlah seratus persen. Setiap pemilik memegang akun
modal dan akun prive-nya sendiri — sistem menolak dua pemilik berbagi satu
akun, karena hak masing-masing harus terbaca terpisah di neraca.

Panjang periode pembagian — **bulanan, kuartalan, atau tahunan** — adalah
pengaturan global. Mengunci sebuah periode membekukan laba bersihnya lalu
memindahkannya ke akun modal tiap pemilik sesuai porsi yang berlaku saat itu.
Yang penting, penguncian ini **tidak menutup Laporan Laba Rugi**: periode yang
sudah dibagikan tetap terbaca utuh. Periode dikunci berurutan agar tidak ada
laba yang terlewat, dan membuka kunci membalik jurnalnya alih-alih
menghapusnya. Laporan transparansi membaca hak tiap pemilik langsung dari buku
besar, sehingga tidak mungkin berselisih dengan neraca.

### 4. Job costing per proyek — berjalan lalu terkunci pasca-lunas

Selama proyek berjalan, pendapatan, harga pokok, beban bertanda proyek, dan
biaya tenaga kerja dari timesheet terakumulasi dan dihitung ulang setiap kali
laporan dibuka. Begitu seluruh faktur proyek diterima pembayarannya, proyek
boleh **dikunci**: angkanya dibekukan sebagai snapshot, dan sejak saat itu
posting jurnal apa pun yang menandai proyek tersebut **ditolak** —

> Proyek PRJ-001 sudah dikunci sehingga tidak dapat lagi dibebani biaya baru.
> Buka kuncinya terlebih dahulu bila koreksi memang perlu.

sehingga biaya yang datang terlambat tidak bisa diam-diam mengubah laba yang
sudah dilaporkan. Sistem menyebutkan penghalangnya bila proyek belum siap
dikunci (masih ada tugas terbuka, atau piutangnya belum lunas), mencatat siapa
yang mengunci beserta kapan, dan menyediakan pembukaan kunci yang mengembalikan
perhitungan hidup bila koreksi memang diperlukan.

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

Di atasnya berdiri keempat kebutuhan spesifik di bagian sebelumnya: pemetaan
jurnal dan akun otomatis, pos biaya dengan alokasi mengambang, kepemilikan
bersama dengan bagi hasil terkunci, serta penguncian job costing pasca-lunas.

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
  modules/akuntansi/layanan/
    pemetaan.ts               # jurnal & akun otomatis — satu-satunya sumbernya
    pos-biaya.ts              # alokasi beban ke pos biaya
  modules/kepemilikan/        # pemilik, susunan kepemilikan, bagi hasil
  modules/proyek/layanan/
    penguncian.ts             # kesiapan kunci, kunci & buka kunci job costing
  db/
    schema/                   # skema Drizzle, satu berkas per domain
    seed/                     # data awal idempoten
  lib/
    uang.ts                   # satu-satunya jalur aritmatika uang
    navigasi.ts               # sumber tunggal struktur menu + kode izin
```

Batas modul ditegakkan lewat konvensi, bukan hanya dokumentasi: UI dan Server
Action tidak pernah mengimpor repositori atau klien basis data secara
langsung, dan hanya modul akuntansi yang menulis ke tabel jurnal — modul lain
memanggil `postingJurnalDalamTx()` / `postingJurnal()`. Dengan pola yang sama,
tidak ada layanan yang menulis kode akun atau kode jurnal secara harfiah:
semuanya lewat `pemetaan.ts`.

## Uji

604 uji terintegrasi dalam 24 berkas (menyentuh basis data `furnierp_test`
sungguhan, bukan mock) memverifikasi bahwa setiap alur menghasilkan jurnal
yang seimbang, stok yang konsisten dengan kartu stoknya, dan penomoran dokumen
yang tidak pernah kembar — termasuk saat dokumen bertanggal mundur diposting
di luar urutan (kasus nyata yang tersingkap saat memposting depresiasi
berkala). Keempat kebutuhan spesifik punya berkas ujinya sendiri: pemetaan
jurnal, alokasi pos biaya, bagi hasil, dan penguncian job costing.

Uji berbagi satu basis data dan berjalan berurutan (`fileParallelism: false`).
Menjalankan dua suite sekaligus terhadap basis data yang sama akan saling
menghapus data dan menghasilkan kegagalan yang menyesatkan.

```bash
pnpm test              # jalankan sekali
pnpm test:watch        # mode watch
```
