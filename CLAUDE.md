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

**Produksi menutup penampungnya sendiri.** Konsumsi bahan, penyerapan biaya
konversi, dan penerimaan barang jadi terjadi dalam satu transaksi, sehingga
akun Barang Dalam Proses selalu kembali nol begitu perintah produksi selesai.
Saldo akun itu yang tidak nol berarti ada produksi yang belum tuntas. Operasi
`konsumsi_produksi` dan `hasil_produksi` tidak boleh dibuat manual dari menu
gudang karena akan meninggalkan saldo yang tidak pernah tertutup.

**Biaya konversi diserap, bukan dibebankan dua kali.** Tenaga kerja langsung
dan overhead pabrik mendebit Barang Dalam Proses dan mengkredit akun bebannya,
sehingga biaya yang sudah dicatat saat terjadi berpindah ke nilai persediaan
dan baru menyentuh laba rugi ketika barangnya terjual.

**Register aset tidak memposting perolehan.** Nilai aset sudah masuk buku
besar lewat tagihan pembelian atau saldo awal; mencatatnya lagi saat aset
didaftarkan akan menghitung aset yang sama dua kali. Modul aset hanya
menyusutkan dan melepas. Laporan Aset membandingkan register terhadap saldo
akunnya agar selisih apa pun langsung terlihat.

**Jadwal depresiasi berhenti tepat di nilai residu.** Baris terakhir menyerap
sisa pembulatan sehingga jumlah seluruh beban persis sama dengan nilai
perolehan dikurangi residu, dan baris hanya diposting berurutan — melompati
bulan yang lebih awal membuat akumulasi tercatat tidak lagi cocok dengan buku
besar.

**Penampung penerimaan wajib tertutup.** Penerimaan barang mengkredit akun
Penerimaan Barang Belum Ditagih, dan tagihan pemasok mendebitnya kembali.
Saldo akun itu yang tidak nol berarti ada barang diterima yang belum ditagih —
bukan kesalahan, tetapi harus dapat dijelaskan.

**PPN dan PPh diperlakukan berbeda.** PPN Masukan menambah nilai tagihan dan
dapat dikreditkan; PPh adalah pajak yang dipotong dari pembayaran sehingga
mengurangi kas tanpa mengurangi nilai tagihan pemasok.

**Penomoran dokumen.** Nomor diambil lewat `ambilNomorBerikut()` yang mengunci
baris definisi urutan dengan `FOR UPDATE` di dalam transaksi yang sama dengan
posting. Jangan pernah membaca lalu menaikkan pencacah di luar pola itu.
Pencacahnya disimpan per periode di `sequence_periods`, bukan satu angka
dengan penanda periode terakhir — dokumen bertanggal mundur, seperti
depresiasi beberapa bulan yang diposting sekaligus, tidak boleh menerbitkan
nomor yang sudah terpakai di periode berjalan.

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

Fase 1A, 1B, 2, 3, 4, 5, dan 6 selesai. Sistem mencatat transaksi keuangan
lengkap, mengelola persediaan dengan valuasi rata-rata bergerak, menjalankan
alur pembelian dari permintaan penawaran sampai pelunasan pemasok, alur
penjualan dari penawaran sampai penerimaan pembayaran dengan rekonsiliasi item
jurnal, produksi dari resep sampai barang jadi bernilai harga pokok penuh,
serta aset tetap dari pendaftaran sampai pelepasan.

Urutan dokumen penjualan menegakkan satu aturan: yang boleh difakturkan hanya
yang sudah dikirim. Pengiriman membebankan harga pokok rata-rata lawan
persediaan; faktur baru mencatat pendapatan, PPN Keluaran, dan piutang.
Pembayaran yang melunasi seluruh piutang seorang pelanggan memicu rekonsiliasi
otomatis; pelunasan sebagian sengaja dibiarkan terbuka agar sisanya terlihat.

Manufaktur memakai mekanisme pergerakan stok yang sama seperti modul lain:
bahan keluar gudang menuju lokasi virtual Produksi, biaya konversi diserap ke
Barang Dalam Proses, lalu barang jadi masuk gudang senilai seluruh biaya itu.
Resep disalin ke perintah produksi saat dibuat, bukan dibaca ulang saat
diselesaikan, sehingga mengubah resep tidak mengusik perintah yang sedang
berjalan.

Aset tetap menyusun seluruh jadwal depresiasinya sekaligus saat dijalankan,
lalu membebankannya bulan demi bulan — satu per satu atau berkala untuk semua
aset sekaligus. Kategori aset memasangkan akun aset, akumulasi, dan bebannya,
dan kategori yang tidak disusutkan seperti tanah cukup punya akun asetnya
saja.

Fase 7 berikutnya: Proyek — satu proyek satu pesanan penjualan, dengan tugas,
timesheet, dan laporan profitabilitas.

**Kanal integrasi.** Modul memposting jurnal lewat `postingJurnalDalamTx()` di
`src/modules/akuntansi/layanan/entri.ts` bila perubahan datanya perlu segabung
dalam satu transaksi dengan jurnalnya, atau `postingJurnal()` bila berdiri
sendiri. Keduanya menerima `sumberTipe` dan `sumberId` dokumen asalnya.
Modul pembelian, penjualan, dan manufaktur tidak menulis pergerakan stok
sendiri melainkan memanggil `buatOperasi()`/`selesaikanOperasi()` milik modul
gudang — atau varian `…DalamTx()`-nya bila seluruh langkah harus segabung
dalam satu transaksi, seperti pada penyelesaian perintah produksi. Tidak ada
modul yang menulis ke tabel jurnal secara langsung.
