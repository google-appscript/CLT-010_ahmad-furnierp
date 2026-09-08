# ERP Furni

Sistem ERP internal untuk perusahaan manufaktur furnitur. Antarmuka berbahasa
Indonesia, alur kerja mengikuti pola Odoo.

## Dokumen Acuan

- `docs/superpowers/specs/2026-09-08-arsitektur-erp-design.md` — peta 7 fase, stack, navigasi
- `docs/superpowers/specs/2026-09-08-fondasi-akuntansi-design.md` — spesifikasi Fase 1
- `docs/superpowers/plans/2026-09-08-fase-1a-fondasi-teknis-master-data.md` — acuan teknis Fase 1A

## Perintah

```bash
pnpm dev              # server pengembangan
pnpm test             # Vitest terhadap furnierp_test (migrasi berjalan otomatis)
pnpm db:generate      # hasilkan migrasi dari perubahan skema
pnpm db:migrate       # terapkan migrasi ke furnierp_dev
pnpm db:seed          # data awal (idempoten)
pnpm exec tsc --noEmit && pnpm build && pnpm lint
```

## Aturan yang Tidak Boleh Dilanggar

**Presisi uang.** Uang tidak pernah disimpan atau dihitung sebagai `float`
maupun `number`. PostgreSQL memakai `numeric(18,2)` untuk IDR dan
`numeric(18,6)` untuk valas serta kurs. TypeScript membawa nilai sebagai
`string`; aritmatika hanya lewat `src/lib/uang.ts`.

**Batas modul.** UI → Server Action → layanan → repositori. Komponen UI dan
Server Action tidak boleh mengimpor repositori atau klien basis data secara
langsung. Modul non-akuntansi tidak boleh menulis ke tabel jurnal; satu-satunya
kanal adalah layanan akuntansi.

**Tipe akun adalah dasar pelaporan.** Laporan diturunkan dari `tipe_akun`,
bukan dari hierarki kode akun. Menambah akun baru otomatis muncul di baris
laporan yang benar tanpa konfigurasi tambahan.

**Master data dinonaktifkan, tidak dihapus.** Akun, mitra, pajak, dan jurnal
dapat sudah dirujuk dokumen lain.

**Penomoran dokumen.** Nomor diambil lewat `ambilNomorBerikut()` yang mengunci
baris dengan `FOR UPDATE` di dalam transaksi yang sama dengan posting. Jangan
pernah membaca lalu menaikkan `nomor_berikut` di luar pola itu.

**Kurs dibekukan.** Kurs diambil dari tanggal transaksi dan disimpan pada entri.
Kurs bertanggal setelah tanggal transaksi tidak pernah dipakai.

**Bahasa.** Label, pesan validasi, dan identifier domain berbahasa Indonesia
dengan ejaan lengkap. Nama tabel tetap bahasa Inggris.

## Navigasi dan Izin

`src/lib/navigasi.ts` adalah sumber tunggal struktur menu sembilan grup beserta
kode izin untuk seluruh tujuh fase. Menu difilter di server berdasarkan izin
sesi dan nomor fase; naikkan `FASE_AKTIF` hanya setelah menu fase itu benar-benar
berfungsi. Fase 1 adalah fondasi dan master data; fase 1,5 adalah mesin jurnal
dan laporan.

Saat ini hanya peran `superuser` (wildcard `*`) yang dipakai. Memecah peran
nanti tidak menyentuh kode UI — cukup mengisi tabel `role_permissions`.

## Status

Fase 1A selesai: autentikasi, RBAC, navigasi, dan seluruh master data akuntansi.

Fase 1B berikutnya: tabel `journal_entries` dan `journal_items` beserta seluruh
invarian, alur draft → diposting, pembalikan entri, tutup buku, dan delapan
laporan (Laba Rugi, Neraca, Arus Kas, Neraca Saldo, Buku Besar, Buku Besar
Pembantu, Umur Piutang & Utang, Laporan Pajak).
