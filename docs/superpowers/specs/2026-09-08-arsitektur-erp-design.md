# Arsitektur ERP Furni — Desain Menyeluruh

**Tanggal:** 8 September 2026
**Status:** Disetujui
**Cakupan:** Peta modul, stack teknis, navigasi, dan urutan pembangunan untuk seluruh sistem.

Dokumen ini adalah acuan lintas fase. Setiap fase memiliki dokumen desain terpisah yang merinci
model data dan alur kerjanya sendiri.

---

## 1. Konteks

Sistem ERP internal untuk perusahaan manufaktur furnitur. Seluruh antarmuka berbahasa Indonesia.
Alur kerja mengikuti pola Odoo karena pola tersebut sudah teruji dan familiar bagi pengguna ERP.

**Keputusan dasar yang mengikat seluruh sistem:**

| Aspek | Keputusan |
|---|---|
| Cakupan organisasi | Satu perusahaan (bukan multi-tenant, bukan multi-company) |
| Mata uang | Multi-currency, dengan IDR sebagai mata uang fungsional |
| Perpajakan | Lokalisasi Indonesia penuh (PPN, PPh) dan format laporan PSAK |
| Kontrol akuntansi | Alur draft → diposting, dengan penguncian periode |
| Metode arus kas | Tidak langsung |
| Valuasi persediaan | Perpetual dengan harga pokok rata-rata bergerak |
| Produksi | Ada, berbasis Bill of Materials dan Perintah Produksi |
| Relasi Proyek–Penjualan | Satu Proyek terhubung ke tepat satu Sales Order |
| Hak akses | Tabel RBAC lengkap sejak awal; sementara hanya peran `superuser` |

---

## 2. Stack Teknis

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | Next.js (App Router), Server Components + Server Actions | Satu basis kode, cepat dibangun, cocok untuk Vercel |
| Database (dev) | PostgreSQL lokal | Paritas penuh dengan produksi |
| Database (produksi) | Neon PostgreSQL | Terkelola, terintegrasi dengan Vercel |
| ORM | Drizzle | Skema sebagai kode, migrasi terversi, tipe aman |
| Autentikasi | Auth.js (credentials) + tabel RBAC sendiri | Kebutuhan internal sederhana; menghindari vendor lock |
| UI | shadcn/ui + Tailwind CSS | Komponen dapat dimodifikasi, tidak terkunci pada tema |
| Pengujian | Vitest terhadap PostgreSQL lokal sungguhan | Perilaku `numeric` dan constraint DB adalah bagian yang diuji |

### 2.1 Struktur Proyek — Modular Monolith

```
src/
  app/(auth)/masuk/            # halaman login
  app/(app)/<modul>/           # halaman aplikasi per modul
  db/schema/                   # definisi tabel Drizzle
  modules/<modul>/             # service + repository + validasi (Zod)
  lib/uang.ts                  # aritmatika desimal
  lib/navigasi.ts              # definisi tunggal seluruh menu sidebar
```

**Aturan batas modul:** UI memanggil Server Action, Action memanggil service, dan hanya service
yang menyentuh repository. Modul non-akuntansi **tidak boleh** menulis ke tabel jurnal secara
langsung — satu-satunya kanal adalah `AkuntansiService.postingJurnal()`. Aturan ini menjaga
integritas buku besar saat jumlah modul bertambah.

### 2.2 Presisi Angka

Uang tidak pernah disimpan atau dihitung sebagai `float` maupun `number` JavaScript.

- PostgreSQL: `numeric(18,2)` untuk nilai IDR; `numeric(18,6)` untuk nilai mata uang asing dan kurs
- TypeScript: nilai dibawa sebagai `string`; aritmatika lewat `decimal.js` di `lib/uang.ts`
- Pembulatan dilakukan satu kali di titik akhir perhitungan, mengikuti `desimal` mata uang terkait

### 2.3 Multi-Currency

IDR adalah mata uang fungsional; seluruh laporan disajikan dalam IDR. Setiap Item Jurnal
menyimpan dua nilai: `debit`/`kredit` yang sudah dalam IDR, dan `nilai_mata_uang` yang memuat
nilai asli dalam mata uang asing (bertanda positif untuk debit, negatif untuk kredit).

Kurs diambil dari tabel `currency_rates` berdasarkan tanggal transaksi dan **dibekukan** pada entri
tersebut. Perubahan kurs di kemudian hari tidak boleh mengubah jurnal yang sudah tercatat. Selisih
kurs yang timbul saat pelunasan diposting ke akun Laba/Rugi Selisih Kurs.

Arah penyimpanan kurs: `kurs` berarti **jumlah IDR per satu unit mata uang asing**
(misalnya USD → 16.250). Arah ini dipilih karena sesuai cara kurs dibaca di Indonesia.

---

## 3. Peta Modul

```
                    ┌─────────────────────────────────────┐
             ┌─────>│  FASE 1 · FONDASI AKUNTANSI         │<─────┐
             │      │  COA · Partner · Journal · Entry    │      │
             │      │  Laba Rugi · Neraca · Arus Kas      │      │
             │      └─────────────────────────────────────┘      │
             │                       ^                            │
   posting   │                       │ posting                    │ posting
             │                       │                            │
    ┌────────┴──────┐    ┌──────────┴─────────┐      ┌───────────┴────────┐
    │ FASE 4        │    │ FASE 2             │      │ FASE 6             │
    │ PENJUALAN     │    │ PRODUK & GUDANG    │      │ ASET TETAP         │
    │ Penawaran→SO  │    │ Terima · Opname    │      │ Depresiasi         │
    │ →Faktur       │    │ Scrap · Packing    │      └────────────────────┘
    └───────┬───────┘    └─────────┬──────────┘
            │ surat jalan          │ konsumsi & hasil produksi
            └─────────────>┌───────┴──────────┐
                           │ FASE 5           │
    ┌──────────────────┐   │ MANUFAKTUR       │
    │ FASE 3           │──>│ BOM · MO         │
    │ PEMBELIAN        │   └──────────────────┘
    │ PO→Terima→Tagihan│
    └──────────────────┘   ┌──────────────────┐
                           │ FASE 7 · PROYEK  │
                           │ 1 Proyek = 1 SO  │
                           └──────────────────┘
```

### Urutan Pembangunan

| Fase | Modul | Isi |
|---|---|---|
| 1 | Fondasi Akuntansi | Bagan Akun, Partner, Jurnal, Entri & Item Jurnal, Laba Rugi, Neraca, Arus Kas, multi-currency, penguncian periode, autentikasi & RBAC |
| 2 | Produk & Gudang | Produk, Satuan, Gudang & Lokasi, Pergerakan Stok dengan valuasi rata-rata bergerak, Penerimaan, Stock Opname, Barang Rusak, Packing List |
| 3 | Pembelian | Permintaan Penawaran → Pesanan Pembelian → Penerimaan (Fase 2) → Tagihan Pembelian (posting ke Fase 1) |
| 4 | Penjualan | Penawaran → Pesanan Penjualan → Surat Jalan (Fase 2) → Faktur Penjualan (posting ke Fase 1) |
| 5 | Manufaktur | Bill of Materials, Perintah Produksi, konsumsi bahan baku menjadi barang jadi, pembentukan HPP |
| 6 | Aset Tetap | Registrasi aset, jadwal depresiasi, posting depresiasi otomatis |
| 7 | Proyek | Proyek (satu-ke-satu dengan Sales Order), Tugas, Timesheet, Profitabilitas |

**Alasan Pembelian didahulukan atas Penjualan:** alur "beli bahan baku → terima di gudang" adalah
titik masuk paling awal dalam bisnis manufaktur, dan pengujiannya memvalidasi mekanisme valuasi
persediaan sebelum modul penjualan dibangun di atasnya.

---

## 4. Navigasi

Sidebar terdiri atas sembilan grup, diurutkan mengikuti alur bisnis.

```
1. DASBOR                                              [Fase 1]
     Ringkasan KPI, grafik kas, piutang jatuh tempo

2. KONTAK                                              [Fase 1]
     Semua Kontak · Pelanggan · Pemasok
     (satu tabel `partners`, tiga tampilan terfilter)

3. PENJUALAN                                           [Fase 4]
     Penawaran · Pesanan Penjualan · Laporan Penjualan

4. PEMBELIAN                                           [Fase 3]
     Permintaan Penawaran · Pesanan Pembelian · Laporan Pembelian

5. GUDANG                                              [Fase 2]
     Operasi      Penerimaan Barang · Pengiriman (Surat Jalan) · Packing List
                  Transfer Internal · Barang Rusak · Stock Opname
     Produk       Produk · Kategori Produk · Satuan
     Laporan      Kartu Stok · Stok Tersedia · Valuasi Persediaan
     Konfigurasi  Gudang · Lokasi

6. MANUFAKTUR                                          [Fase 5]
     Perintah Produksi · Bill of Materials · Analisis HPP Produksi

7. AKUNTANSI                              [Fase 1; Aset Tetap Fase 6]
     Dasbor Akuntansi
     Pelanggan    Faktur Penjualan · Nota Kredit · Pembayaran Masuk
     Pemasok      Tagihan Pembelian · Nota Debit · Pembayaran Keluar
     Jurnal       Entri Jurnal · Item Jurnal · Rekonsiliasi
     Aset Tetap   Daftar Aset · Jadwal Depresiasi
     Laporan      Laba Rugi · Neraca · Arus Kas
                  Buku Besar · Neraca Saldo
                  Buku Besar Pembantu · Umur Piutang & Utang
                  Laporan Pajak (PPN & PPh)
     Konfigurasi  Bagan Akun · Jurnal · Pajak
                  Mata Uang & Kurs · Syarat Pembayaran
                  Tahun Buku & Penguncian Periode

8. PROYEK                                              [Fase 7]
     Proyek · Tugas · Timesheet · Profitabilitas Proyek

9. PENGATURAN                                          [Fase 1]
     Profil Perusahaan · Pengguna · Peran & Hak Akses
     Penomoran Dokumen · Log Aktivitas
```

### 4.1 Keputusan Navigasi

**Faktur dan Tagihan berada di Akuntansi, bukan di Penjualan/Pembelian.** Sales Order menyediakan
tombol "Buat Faktur", tetapi daftar fakturnya hidup di modul Akuntansi. Faktur adalah dokumen
akuntansi yang memicu jurnal, sedangkan Sales Order adalah dokumen komersial yang belum menyentuh
buku besar.

**Sidebar accordion, bukan app-switcher.** Total menu mencapai sekitar enam puluh item. Pola
app-switcher ala Odoo membutuhkan dua langkah untuk berpindah modul. Sistem ini memakai sidebar
dengan grup yang dapat dilipat — hanya satu grup terbuka pada satu waktu — dilengkapi command
palette (Ctrl+K) untuk melompat langsung ke menu mana pun.

**Setiap item menu memiliki kode permission sejak awal.** Sidebar dirender dari satu berkas
definisi, `src/lib/navigasi.ts`, yang memuat label, route, ikon, dan kode permission.

| Menu | Kode Permission | Route |
|---|---|---|
| Entri Jurnal (lihat) | `akuntansi.jurnal.lihat` | `/akuntansi/jurnal/entri` |
| Entri Jurnal (posting) | `akuntansi.jurnal.posting` | — (aksi) |
| Bagan Akun (kelola) | `akuntansi.coa.kelola` | `/akuntansi/konfigurasi/bagan-akun` |
| Laporan Neraca | `akuntansi.laporan.neraca` | `/akuntansi/laporan/neraca` |
| Penerimaan Barang | `gudang.penerimaan.kelola` | `/gudang/operasi/penerimaan` |

Peran `superuser` memegang wildcard `*` sehingga seluruh menu tampil. Ketika peran dipecah nanti,
tidak ada kode antarmuka yang perlu diubah — cukup mengisi tabel `role_permissions`.

---

## 5. Dokumen Turunan

| Fase | Dokumen Desain |
|---|---|
| 1 | `2026-09-08-fondasi-akuntansi-design.md` |
| 2–7 | Dibuat saat fase tersebut dimulai |
