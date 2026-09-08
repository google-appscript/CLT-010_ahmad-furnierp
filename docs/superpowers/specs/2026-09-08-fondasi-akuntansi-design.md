# Fase 1 — Fondasi Akuntansi

**Tanggal:** 8 September 2026
**Status:** Disetujui
**Acuan induk:** `2026-09-08-arsitektur-erp-design.md`

---

## 1. Tujuan dan Batasan

Membangun inti akuntansi yang menjadi tumpuan seluruh modul lain: bagan akun, mitra usaha, jurnal,
entri dan item jurnal, beserta tiga laporan keuangan utama. Setelah fase ini selesai, sistem harus
mampu mencatat transaksi keuangan secara lengkap dan menghasilkan laporan yang benar — bahkan
sebelum modul penjualan, pembelian, atau gudang ada.

**Termasuk dalam fase ini:**

- Autentikasi dan struktur RBAC lengkap (hanya peran `superuser` yang aktif)
- Konfigurasi perusahaan, tahun buku, penguncian periode, penomoran dokumen
- Mata uang dan kurs
- Bagan Akun, Mitra Usaha, Pajak, Syarat Pembayaran, Jurnal
- Entri Jurnal dan Item Jurnal dengan alur draft → diposting
- Pembalikan entri dan tutup buku tahunan
- Laporan: Laba Rugi, Neraca, Arus Kas, Neraca Saldo, Buku Besar, Buku Besar Pembantu,
  Umur Piutang & Utang, Laporan Pajak
- Log aktivitas

**Tidak termasuk dalam fase ini:**

- Faktur, tagihan, dan pembayaran (Fase 3 dan 4) — menu terkait belum aktif
- Rekonsiliasi antar item jurnal — kolom disiapkan, fungsinya dibangun di Fase 3
- Aset tetap dan depresiasi (Fase 6)
- Seluruh modul gudang, manufaktur, dan proyek

---

## 2. Model Data

Notasi: `?` menandai kolom yang boleh kosong. Kolom audit standar (`dibuat_pada`, `diubah_pada`)
ada di seluruh tabel dan tidak dituliskan.

### 2.1 Identitas dan Akses

```
users              id, email, nama, password_hash, is_active, last_login_at
                   UNIQUE(email)

roles              id, kode, nama, is_system
                   UNIQUE(kode)                    seed: 'superuser'

permissions        id, kode, modul, deskripsi
                   UNIQUE(kode)                    seed diturunkan dari navigasi.ts

role_permissions   role_id, permission_id
                   PRIMARY KEY(role_id, permission_id)

user_roles         user_id, role_id
                   PRIMARY KEY(user_id, role_id)

audit_logs         id, user_id, entitas, entitas_id, aksi,
                   data_lama jsonb, data_baru jsonb, waktu, alamat_ip
```

`audit_logs` termasuk lingkup Fase 1 dan bukan tambahan opsional. Sistem akuntansi memerlukan jejak
siapa mengubah apa; menambahkannya di kemudian hari berarti kehilangan riwayat sejak awal.

Peran `superuser` memegang permission berkode `*` yang dievaluasi sebagai wildcard oleh pemeriksa
hak akses.

### 2.2 Konfigurasi Perusahaan

```
company_settings   id (singleton, selalu satu baris)
                   nama, npwp, alamat, kota, provinsi, kode_pos,
                   telepon, email, logo_url,
                   mata_uang_fungsional            default 'IDR'
                   bulan_awal_tahun_buku           default 1
                   tanggal_kunci_buku?
                   tanggal_kunci_pajak?
                   akun_laba_ditahan_id?
                   akun_selisih_kurs_untung_id?
                   akun_selisih_kurs_rugi_id?
                   akun_pembulatan_id?

fiscal_years       id, nama, tanggal_mulai, tanggal_selesai,
                   status(terbuka|ditutup), entry_penutup_id?

sequences          id, kode, prefix, panjang_digit, nomor_berikut,
                   reset(tidak_pernah|tahunan|bulanan),
                   tahun_terakhir?, bulan_terakhir?
                   UNIQUE(kode)
```

**Penguncian periode** diimplementasikan melalui `tanggal_kunci_buku`, bukan melalui tabel periode
bulanan. Entri bertanggal lebih awal atau sama dengan tanggal kunci tidak dapat dibuat, diubah,
maupun dihapus. Pendekatan ini mencapai hasil yang sama dengan tabel periode tanpa memerlukan
pemeliharaan dua belas baris periode setiap tahun.

**Penomoran** menghasilkan format seperti `JU/2026/09/0001`. Pengambilan nomor memakai
`SELECT ... FOR UPDATE` di dalam transaksi yang sama dengan posting sehingga dua pengguna yang
melakukan posting bersamaan tidak dapat memperoleh nomor kembar.

### 2.3 Mata Uang

```
currencies         kode (PK, mis. 'IDR', 'USD', 'EUR'),
                   nama, simbol, desimal, is_active

currency_rates     id, kode_mata_uang, tanggal, kurs numeric(18,6)
                   UNIQUE(kode_mata_uang, tanggal)
```

`kurs` bermakna jumlah IDR per satu unit mata uang asing. Pencarian kurs untuk suatu tanggal
mengambil baris dengan tanggal terbesar yang tidak melampaui tanggal transaksi.

### 2.4 Master Akuntansi

```
accounts           id, kode, nama, tipe_akun,
                   mata_uang_id?, dapat_direkonsiliasi,
                   is_active, catatan
                   UNIQUE(kode)

partners           id, kode, nama, tipe(perorangan|badan),
                   is_pelanggan, is_pemasok,
                   npwp?, nik?, alamat?, kota?, provinsi?, kode_pos?,
                   telepon?, email?, kontak_person?,
                   syarat_pembayaran_id?,
                   akun_piutang_id?, akun_utang_id?,
                   is_active
                   UNIQUE(kode)

taxes              id, kode, nama,
                   ruang_lingkup(penjualan|pembelian),
                   tarif numeric(9,4),
                   harga_termasuk_pajak, is_pemotongan,
                   akun_pajak_id, is_active

payment_terms      id, nama, jumlah_hari, catatan?

journals           id, kode, nama,
                   tipe(penjualan|pembelian|kas|bank|umum),
                   sequence_id,
                   akun_default_debit_id?, akun_default_kredit_id?,
                   mata_uang_id?, is_active
                   UNIQUE(kode)
```

#### Daftar `tipe_akun`

`tipe_akun` adalah dasar seluruh pelaporan. Laporan tidak diturunkan dari hierarki kode akun,
melainkan dari tipe ini. Akibatnya, mengubah kode akun tidak merusak laporan, dan akun baru
otomatis muncul pada baris laporan yang tepat tanpa konfigurasi tambahan.

| Kelompok | Nilai | Laporan |
|---|---|---|
| Aset | `aset_kas`, `aset_bank`, `aset_piutang`, `aset_persediaan`, `aset_lancar_lain`, `aset_tetap`, `aset_akumulasi_depresiasi`, `aset_tidak_lancar_lain` | Neraca |
| Liabilitas | `liabilitas_utang_usaha`, `liabilitas_pajak`, `liabilitas_jangka_pendek`, `liabilitas_jangka_panjang` | Neraca |
| Ekuitas | `ekuitas`, `ekuitas_laba_ditahan`, `ekuitas_laba_berjalan` | Neraca |
| Pendapatan | `pendapatan`, `pendapatan_lain` | Laba Rugi |
| Beban | `beban_hpp`, `beban_operasional`, `beban_depresiasi`, `beban_lain`, `beban_pajak` | Laba Rugi |

`aset_akumulasi_depresiasi` bersifat kontra-aset: saldonya normalnya kredit dan mengurangi
`aset_tetap` pada Neraca.

### 2.5 Transaksi

```
journal_entries    id, nomor?, journal_id, tanggal,
                   referensi?, keterangan?,
                   status(draft|diposting|dibatalkan),
                   mata_uang_id, kurs numeric(18,6),
                   partner_id?,
                   sumber_tipe?, sumber_id?,
                   membalik_entry_id?,
                   diposting_pada?, diposting_oleh?, dibuat_oleh
                   UNIQUE(nomor) WHERE nomor IS NOT NULL

journal_items      id, entry_id, urutan,
                   account_id, partner_id?, label,
                   debit  numeric(18,2)  NOT NULL DEFAULT 0,
                   kredit numeric(18,2)  NOT NULL DEFAULT 0,
                   nilai_mata_uang numeric(18,6)?,
                   mata_uang_id?,
                   tax_id?, project_id?,
                   rekonsiliasi_id?
```

`debit` dan `kredit` selalu dalam IDR. `nilai_mata_uang` memuat nilai asli mata uang asing dengan
tanda positif untuk sisi debit dan negatif untuk sisi kredit; kolom ini kosong bila transaksi
dalam IDR.

Ketiga nilai `status` memiliki makna yang berbeda dan tidak saling menggantikan:

| Status | Makna | Transisi yang diizinkan |
|---|---|---|
| `draft` | Entri sedang disusun, belum bernomor, belum masuk laporan | → `diposting`, → `dibatalkan`, atau dihapus |
| `diposting` | Entri resmi, bernomor, masuk laporan, tidak dapat diubah | tidak ada; koreksi hanya lewat entri pembalik |
| `dibatalkan` | Draft yang dibatalkan namun sengaja disimpan sebagai jejak | tidak ada |

Status `dibatalkan` hanya dapat dicapai dari `draft`. Entri terposting tidak pernah berpindah ke
`dibatalkan`; pembatalan efeknya dilakukan dengan membuat entri pembalik.

`sumber_tipe` dan `sumber_id` membentuk relasi polimorfik ke dokumen asal (`faktur`, `tagihan`,
`pergerakan_stok`, `depresiasi_aset`). Kolom ini adalah satu-satunya kanal integrasi antar modul:
setiap modul menyerahkan data melalui `AkuntansiService.postingJurnal()` dengan menyebutkan
asal-usulnya, dan tidak pernah menulis langsung ke tabel jurnal.

`project_id` disiapkan sejak Fase 1 agar profitabilitas proyek di Fase 7 dapat dihitung dari data
jurnal historis tanpa migrasi.

### 2.6 Invarian Sistem

1. `SUM(debit) = SUM(kredit)` untuk setiap entri, diperiksa di lapisan service dalam satu transaksi
   basis data sebelum posting.
2. Satu item jurnal tidak boleh memiliki nilai debit dan kredit sekaligus, dan keduanya tidak boleh
   negatif. Ditegakkan sebagai `CHECK` constraint PostgreSQL:
   `debit >= 0 AND kredit >= 0 AND NOT (debit > 0 AND kredit > 0)`.
3. Entri berstatus `diposting` tidak dapat diubah maupun dihapus. Koreksi hanya melalui entri
   pembalik.
4. Entri bertanggal lebih awal atau sama dengan `tanggal_kunci_buku` ditolak, termasuk bila berasal
   dari pemanggilan otomatis modul lain.
5. Nomor entri diberikan pada saat posting, bukan saat draft dibuat.
6. Kurs yang dipakai dibekukan pada entri; perubahan kurs di kemudian hari tidak mengubah jurnal
   yang sudah tercatat.

### 2.7 Index

- `journal_items(account_id)`
- `journal_items(entry_id)`
- `journal_items(partner_id)` untuk Buku Besar Pembantu
- `journal_entries(tanggal, status)`
- `journal_entries(sumber_tipe, sumber_id)`

---

## 3. Alur Kerja

### 3.1 Entri Jurnal Manual

```
[Draft] ──validasi keseimbangan──> [Diposting] ──> terkunci permanen
   │                                     │
   └─ dapat diubah / dihapus             └─ hanya: Balik (reverse) atau Duplikat
```

Draft yang dibuang tidak meninggalkan lubang nomor karena nomor baru diberikan saat posting.

### 3.2 Pembalikan Entri

Entri terposting tidak pernah dihapus. Koreksi dilakukan dengan membuat entri baru pada tanggal
tertentu yang menukar posisi debit dan kredit, terhubung ke entri asal melalui `membalik_entry_id`.
Entri asal tetap berstatus diposting dan diberi penanda "Sudah Dibalik" pada antarmuka. Jejak audit
tetap utuh.

### 3.3 Tutup Buku Tahunan

Menutup seluruh akun pendapatan dan beban ke akun Laba Ditahan, kemudian mengubah
`fiscal_years.status` menjadi `ditutup` dan menggeser `tanggal_kunci_buku`.

Neraca tidak bergantung pada tutup buku. Baris "Laba Tahun Berjalan" dihitung dinamis dari selisih
pendapatan dikurangi beban sejak awal tahun buku, sehingga Neraca selalu seimbang bahkan sebelum
tutup buku dilakukan. Tutup buku merupakan formalitas administratif, bukan prasyarat kebenaran
laporan.

---

## 4. Laporan

Seluruh laporan mendukung filter rentang tanggal, kolom pembanding periode sebelumnya, drill-down
dari angka ke daftar item jurnal pembentuknya, serta ekspor Excel dan PDF. Perhitungan dilakukan
melalui agregasi SQL (`SUM(debit) - SUM(kredit) GROUP BY account_id`), bukan iterasi di aplikasi.

Hanya entri berstatus `diposting` yang masuk ke laporan.

### 4.1 Laba Rugi

Disajikan bertingkat sesuai praktik Indonesia:

```
  Pendapatan                                 pendapatan
− Harga Pokok Penjualan                      beban_hpp
= LABA KOTOR
− Beban Operasional                          beban_operasional, beban_depresiasi
= LABA USAHA
+ Pendapatan Lain-lain                       pendapatan_lain
− Beban Lain-lain                            beban_lain
= LABA SEBELUM PAJAK
− Beban Pajak Penghasilan                    beban_pajak
= LABA BERSIH
```

### 4.2 Neraca

Format PSAK:

```
ASET
  Aset Lancar         aset_kas, aset_bank, aset_piutang,
                      aset_persediaan, aset_lancar_lain
  Aset Tidak Lancar   aset_tetap + aset_akumulasi_depresiasi,
                      aset_tidak_lancar_lain
LIABILITAS
  Jangka Pendek       liabilitas_utang_usaha, liabilitas_pajak,
                      liabilitas_jangka_pendek
  Jangka Panjang      liabilitas_jangka_panjang
EKUITAS
  Modal               ekuitas
  Laba Ditahan        ekuitas_laba_ditahan
  Laba Tahun Berjalan dihitung dinamis
```

Kesetaraan Aset = Liabilitas + Ekuitas ditampilkan di bagian bawah laporan. Bila tidak seimbang,
laporan menampilkan peringatan yang menonjol, bukan menyembunyikan selisih.

### 4.3 Arus Kas — Metode Tidak Langsung

```
ARUS KAS DARI AKTIVITAS OPERASI
  Laba Bersih
  + Depresiasi dan Amortisasi          mutasi beban_depresiasi
  ± Perubahan Piutang Usaha            −Δ aset_piutang
  ± Perubahan Persediaan               −Δ aset_persediaan
  ± Perubahan Utang Usaha              +Δ liabilitas_utang_usaha
  ± Perubahan Utang Pajak              +Δ liabilitas_pajak
  = Kas Bersih dari Aktivitas Operasi

ARUS KAS DARI AKTIVITAS INVESTASI
  ± Perubahan Aset Tetap (bruto)       −Δ aset_tetap
  ± Perubahan Aset Tidak Lancar Lain
  = Kas Bersih dari Aktivitas Investasi

ARUS KAS DARI AKTIVITAS PENDANAAN
  ± Perubahan Utang Jangka Panjang
  ± Perubahan Ekuitas
  = Kas Bersih dari Aktivitas Pendanaan

  Kenaikan (Penurunan) Kas Bersih
  + Kas dan Setara Kas Awal Periode
  = Kas dan Setara Kas Akhir Periode
```

Baris terakhir divalidasi silang terhadap saldo aktual akun `aset_kas` dan `aset_bank`. Bila
terdapat selisih, laporan menampilkan baris "Selisih Belum Teridentifikasi" secara eksplisit.
Laporan arus kas tidak langsung tanpa validasi ini merupakan sumber kesalahan yang umum: angkanya
tampak rapi padahal keliru.

### 4.4 Laporan Pendukung

| Laporan | Isi |
|---|---|
| Neraca Saldo | Per akun: saldo awal, mutasi debit, mutasi kredit, saldo akhir. Total debit harus sama dengan total kredit. |
| Buku Besar | Per akun: seluruh item jurnal berurut tanggal dengan saldo berjalan. |
| Buku Besar Pembantu | Sama seperti Buku Besar, dikelompokkan per mitra usaha. |
| Umur Piutang & Utang | Pengelompokan saldo per rentang umur: 0–30, 31–60, 61–90, di atas 90 hari. |
| Laporan Pajak | Rekap PPN Keluaran dan PPN Masukan per masa pajak. |

---

## 5. Strategi Pengujian

Service akuntansi dikembangkan dengan TDD dan diuji terhadap PostgreSQL lokal sungguhan. Perilaku
tipe `numeric` dan penegakan constraint basis data justru merupakan bagian yang perlu diuji,
sehingga mock tidak dipakai untuk lapisan ini.

**Pengujian yang wajib lulus:**

- Entri yang tidak seimbang ditolak
- Entri terposting tidak dapat diubah maupun dihapus
- Entri pada periode terkunci ditolak, termasuk melalui pemanggilan otomatis modul lain
- Posting paralel tidak menghasilkan nomor kembar
- Entri asal digabung entri pembaliknya menghasilkan saldo nol
- Konversi valas memakai kurs tanggal transaksi, bukan kurs saat laporan dibuka
- Item jurnal dengan debit dan kredit terisi bersamaan ditolak oleh basis data
- Entri berstatus draft tidak muncul di laporan mana pun

**Property test:** menghasilkan ratusan entri jurnal acak yang valid, kemudian memastikan tiga
sifat berikut selalu terpenuhi:

1. Neraca seimbang: Aset = Liabilitas + Ekuitas
2. Neraca Saldo: total debit = total kredit
3. Arus Kas: Kas Akhir Periode = saldo aktual akun kas dan bank

Pengujian berbasis contoh tunggal terlalu mudah lolos untuk logika akuntansi; ketiga sifat inilah
yang harus dijamin.

---

## 6. Data Awal

| Kelompok | Isi |
|---|---|
| Bagan Akun | Standar Indonesia untuk manufaktur furnitur, sekitar 80 akun |
| Jurnal | Penjualan, Pembelian, Kas, Bank, Umum, Penyesuaian Persediaan |
| Mata Uang | IDR (fungsional), USD, EUR, beserta contoh kurs |
| Syarat Pembayaran | Tunai, Net 14, Net 30, Net 60 |
| Pajak | PPN Keluaran 11%, PPN Masukan 11%, PPh 23 2%, PPh Final 0,5% |
| Pengguna | Satu akun `superuser` |
| Peran | `superuser` dengan permission wildcard `*` |

Tarif pajak tersimpan di tabel `taxes` dan dapat diubah melalui antarmuka tanpa perubahan kode,
sehingga penyesuaian regulasi tidak memerlukan penerapan ulang.
