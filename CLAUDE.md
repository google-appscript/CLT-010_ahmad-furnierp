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

**Entri terposting tidak pernah diubah.** Koreksi hanya lewat entri pembalik.
Nomor diberikan saat posting, bukan saat draft dibuat.

**Tipe akun adalah dasar pelaporan.** Laporan diturunkan dari `tipe_akun`,
bukan dari hierarki kode akun. Menambah akun baru otomatis muncul di baris
laporan yang benar tanpa konfigurasi tambahan.

**Master data dinonaktifkan, tidak dihapus.** Akun, mitra, pajak, jurnal, dan
produk dapat sudah dirujuk dokumen lain.

**Stok dihitung dari pergerakan.** Saldo stok tidak pernah disimpan sebagai
angka tersendiri melainkan dijumlahkan dari `stock_moves`, sehingga tidak bisa
menyimpang dari kartu stoknya. Setiap pergerakan selalu antara dua lokasi;
lokasi virtual (Pemasok, Pelanggan, Penyesuaian, Barang Rusak, Produksi)
membuat seluruh jenis operasi memakai satu mekanisme yang sama.

**Operasi gudang selesai tidak pernah diubah.** Pergerakan stok dan jurnalnya
dicatat dalam satu transaksi; koreksi dilakukan lewat operasi baru.

**Penomoran dokumen.** Nomor diambil lewat `ambilNomorBerikut()` yang mengunci
baris dengan `FOR UPDATE` di dalam transaksi yang sama dengan posting. Jangan
pernah membaca lalu menaikkan `nomor_berikut` di luar pola itu.

**Kurs dibekukan.** Kurs diambil dari tanggal transaksi dan disimpan pada entri.
Kurs bertanggal setelah tanggal transaksi tidak pernah dipakai.

**Bahasa.** Label, pesan validasi, dan identifier domain berbahasa Indonesia
dengan ejaan lengkap. Nama tabel tetap bahasa Inggris.

## Navigasi dan Izin

`src/lib/navigasi.ts` adalah sumber tunggal struktur menu beserta kode izin
untuk seluruh tujuh fase. Strukturnya tiga tingkat: **grup → seksi → halaman**.
Sidebar hanya menampilkan dua tingkat teratas; halaman di dalam sebuah seksi
muncul sebagai bilah menu mendatar di atas isi halaman, sehingga sidebar tetap
pendek. Grup yang halamannya sedikit boleh langsung memuat halaman tanpa seksi.

Seksi hanya wadah — tidak punya rute maupun izin; visibilitasnya diturunkan
dari halaman di dalamnya. Menu difilter di server berdasarkan izin
sesi dan nomor fase; naikkan `FASE_AKTIF` hanya setelah menu fase itu benar-benar
berfungsi.

Saat ini hanya peran `superuser` (wildcard `*`) yang dipakai. Memecah peran
nanti tidak menyentuh kode UI — cukup mengisi tabel `role_permissions`.

## Status

Fase 1A, 1B, dan 2 selesai. Sistem mencatat transaksi keuangan lengkap,
menghasilkan laporan yang benar, dan mengelola persediaan dengan valuasi
rata-rata bergerak yang terhubung ke buku besar.

Fase 3 berikutnya: Pembelian — permintaan penawaran, pesanan pembelian,
penerimaan barang yang merujuk pesanan, dan tagihan pembelian yang menutup
akun Penerimaan Barang Belum Ditagih.

**Kanal integrasi.** Modul berikutnya memposting jurnal lewat
`postingJurnalDalamTx()` di `src/modules/akuntansi/layanan/entri.ts` bila
perubahan datanya perlu segabung dalam satu transaksi dengan jurnalnya, atau
`postingJurnal()` bila berdiri sendiri. Keduanya menerima `sumberTipe` dan
`sumberId` dokumen asalnya. Tidak ada modul yang menulis ke tabel jurnal
secara langsung.
