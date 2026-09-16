# Alur Proyek — Pemenuhan Kebutuhan Client

Dokumen ini menjawab tujuh kebutuhan alur penjualan berbasis proyek yang
diajukan client, satu per satu: apa yang dikerjakan sistem, di layar mana, dan
apa yang perlu diketahui operatornya.

Ketujuhnya sudah berjalan. Yang berubah dari sistem sebelumnya dirangkum di
bagian [Perubahan Aturan](#perubahan-aturan) di akhir.

---

## Ringkasan Alur

```
Penawaran ──konfirmasi──▶ Pesanan Penjualan (SO)
                              │
              ┌───────────────┼────────────────┬──────────────────┐
              ▼               ▼                ▼                  ▼
          Proyek         Faktur          Permintaan          (menunggu)
       (1 SO = 1 proyek)  (boleh terbit   Pembelian
              │            sejak SO        ber-referensi SO
              │            dikonfirmasi)   → bahan baku
              ▼               │
     Perintah Produksi        ▼
     + Timesheet         Penerimaan Pembayaran
     (upah tukang)       (DP → termin → pelunasan)
              │
        semua selesai
              │
              ▼
        Pengiriman ──▶ HPP dibebankan
              │
              ▼
     Seluruh faktur lunas ──▶ Kunci Proyek ──▶ PnL beku
```

Aturan urutannya hanya dua, dan keduanya ditegakkan sistem:

1. **Pengiriman menunggu produksi.** Selama proyek masih punya perintah
   produksi berstatus draft atau dikonfirmasi, pengiriman ditolak.
2. **Faktur tidak menunggu pengiriman.** Seluruh isi pesanan boleh ditagih
   sejak pesanan dikonfirmasi.

---

## 1. Buat Penawaran → Terbit SO

**Layar:** Penjualan → Penawaran, lalu tombol Konfirmasi.

Penawaran disimpan tanpa nomor dan belum mengikat. Konfirmasi menerbitkan nomor
SO dan mengunci isinya sebagai komitmen kepada pelanggan. Dokumen tidak
berpindah tabel — penawaran yang sudah berlanjut tetap terbaca riwayatnya lewat
penanda `lewat_penawaran`.

| Kebutuhan | Di mana |
|---|---|
| Project base | Proyek dibuat dari SO ini (lihat butir 3); satu SO hanya boleh dipegang satu proyek |
| Deadline pengiriman | Kolom **Tanggal Pengiriman** pada pesanan |
| Biaya total | Terakumulasi di Perintah Produksi proyek: bahan + tenaga kerja + overhead, terbaca di tab **Produksi** proyek |
| Bahan baku yang digunakan | Resep pada Perintah Produksi proyek — lihat butir 3 |

Bahan baku sengaja tidak diketik ulang di penawaran. Sumber kebenarannya adalah
resep pada perintah produksi, dan menyalinnya ke dua tempat hanya membuka
peluang keduanya berbeda.

## 2. Invoice Proyek dan Tagihan DP

**Layar:** Akuntansi → Pelanggan → Faktur, lalu Akuntansi → Pelanggan →
Penerimaan Pembayaran.

**Satu proyek satu faktur.** Faktur menunjuk SO-nya (`customer_invoices.so_id`),
sehingga apa pun yang ditagih atas pesanan itu otomatis menjadi pendapatan
proyeknya tanpa alokasi.

**DP bukan dokumen tersendiri, melainkan pembayaran parsial.** Setelah client
deal, terbitkan faktur penuh proyek itu — tidak perlu menunggu barang dikirim.
Uang muka, termin, dan pelunasan dicatat sebagai beberapa penerimaan terhadap
faktur yang sama. Sisa piutangnya tetap terlihat sampai lunas.

Kenapa begini dan bukan Invoice DP terpisah:

- Bagi PKP, PPN terutang pada saat yang lebih dulu antara penyerahan barang
  atau penerimaan pembayaran. Menerbitkan faktur penuh di awal membuat PPN
  Keluaran tercatat **tidak lebih lambat** dari kewajibannya.
- Satu faktur berarti satu nomor Faktur Pajak. Model DP terpisah memaksa dua
  faktur yang harus saling merujuk beserta baris pengurangnya.
- Tidak ada baris pengurang uang muka yang bisa salah hitung.

**Yang harus diketahui:** pendapatan diakui pada tanggal faktur, sedangkan harga
pokok baru muncul saat pengiriman. Untuk proyek yang melintasi bulan, Laporan
Laba Rugi **bulanan** akan menunjukkan pendapatan lebih dulu daripada harga
pokoknya. PnL **per proyek** tidak terpengaruh, karena keduanya menempel pada
proyek yang sama apa pun tanggalnya.

Penerimaan yang melebihi alokasi ke faktur otomatis masuk ke akun **Uang Muka
Penjualan (2131)**.

## 3. Pembuatan Master Proyek

**Layar:** Proyek → Proyek Baru.

Proyek wajib menunjuk satu SO yang sudah dikonfirmasi, dan satu SO tidak boleh
dipegang dua proyek — ditegakkan indeks unik pada `projects.so_id`. Pelanggan
proyek selalu pelanggan pesanannya.

Halaman detail proyek punya empat tab:

| Tab | Isi |
|---|---|
| Profitabilitas | PnL dua tingkat (lihat butir 7) |
| Produksi | Perintah produksi proyek ini — di sinilah bahan bakunya |
| Tugas | Rincian pekerjaan beserta estimasi dan realisasinya |
| Timesheet | Pekerjaan tukang per tanggal |

### Perintah Produksi

**Layar:** Manufaktur → Perintah Produksi, kolom **Proyek**.

Perintah produksi menunjuk proyek yang dikerjakannya. Resepnya disalin saat
perintah dibuat, bukan dibaca ulang saat diselesaikan — mengubah resep tidak
mengusik perintah yang sedang berjalan. Inilah daftar bahan baku proyek.

Penyelesaian perintah melakukan tiga hal dalam satu transaksi: bahan keluar
gudang menuju lokasi virtual Produksi, biaya konversi diserap ke Barang Dalam
Proses, lalu barang jadi masuk gudang senilai seluruh biaya itu.

### Biaya Harian Tukang

**Layar:** Kontak → **Pegawai** (menu baru), lalu Proyek → Timesheet.

Tukang didaftarkan sebagai mitra bertanda Pegawai, dengan **upah** dan
**satuan upah**: per hari atau per jam.

Satuan disimpan apa adanya dan tidak pernah dikonversi. Tukang harian menerima
upah satu hari penuh meski pulang lebih awal; membagi tarif harian dengan jam
standar akan melaporkan angka yang tidak pernah benar-benar dibayarkan. Setengah
hari ditulis `0,5`.

Tarif beserta satuannya **dibekukan** ke setiap baris timesheet saat dicatat.
Menaikkan upah tidak mengubah biaya pekerjaan yang sudah lewat.

Setiap baris timesheet boleh menunjuk **Perintah Produksi**. Ini menentukan ke
mana upahnya bermuara — lihat butir 7.

## 4. Pembelian Bahan Baku ke Purchasing

**Layar:** Pembelian → Permintaan Penawaran, kolom **Untuk Pesanan Penjualan**.

Permintaan dan pesanan pembelian boleh merujuk SO yang menjadi alasannya
(`purchase_orders.so_id`). Satu SO dapat dirujuk beberapa pembelian sekaligus —
bahan dari pemasok berbeda, atau pembelian bertahap — karena itu tidak ada
pembatasan unik. Pembelian stok umum cukup dibiarkan **Stok umum**.

Alur pembeliannya sendiri tidak berubah: permintaan penawaran → pesanan →
penerimaan barang → tagihan pemasok → pembayaran. Penerimaan barang mengkredit
Penerimaan Barang Belum Ditagih, dan tagihan pemasok mendebitnya kembali.

**Biaya bahan sampai ke proyek lewat harga pokok**, bukan lewat penandaan
langsung: bahan masuk persediaan, dikonsumsi perintah produksi, menjadi nilai
barang jadi, lalu dibebankan sebagai HPP saat dikirim. Untuk biaya yang **bukan**
persediaan — ongkos kirim, jasa tukang luar, sewa alat — tandai barisnya di
tagihan pemasok lewat kolom **Proyek**.

## 5. Pengiriman Proyek

**Layar:** Penjualan → Pesanan → tombol Kirim, atau Gudang → Operasi →
Pengiriman.

Pengiriman membuat pergerakan stok dari gudang menuju lokasi virtual Pelanggan
dan membebankan harga pokok rata-rata lawan persediaan. Jurnalnya bertanda
proyek, sehingga harga pokok itu langsung terbaca di laporan proyek.

**Pengiriman ditahan selama produksi belum tuntas.** Bila proyek masih punya
perintah produksi yang belum selesai, sistem menolak dengan menyebut nomor
perintah yang menahannya. Alasannya dua: barangnya belum berwujud, dan harga
pokoknya belum lengkap karena biaya konversi baru terserap saat perintah
diselesaikan.

## 6. Pelunasan Proyek

**Layar:** Akuntansi → Pelanggan → Penerimaan Pembayaran.

Satu penerimaan dapat dialokasikan ke satu faktur atau beberapa sekaligus.
Pelunasan sebagian sengaja dibiarkan terbuka agar sisanya terlihat; pembayaran
yang melunasi seluruh piutang seorang pelanggan memicu rekonsiliasi otomatis.

**Penjualan tempo.** Syarat pembayaran yang dipilih di pesanan kini mengalir ke
fakturnya, dan tanggal jatuh temponya diturunkan otomatis lalu disimpan.
Pencariannya berjenjang: syarat pada faktur, lalu pada pesanan asalnya, lalu
bawaan pelanggannya. Tempo yang diketik manual selalu menang, karena kesepakatan
khusus dengan satu pelanggan adalah hal biasa.

Karena tempo tersimpan pada dokumennya, mengubah master syarat pembayaran tidak
menggeser tempo faktur yang sudah terbit. **Laporan Umur Piutang** (Akuntansi →
Laporan → Umur) membacanya langsung.

Hal yang sama berlaku untuk tagihan pemasok.

## 7. Laporan PnL Proyek

**Layar:** Proyek → detail proyek → tab Profitabilitas, dan Proyek → Laporan →
Profitabilitas.

Laporan disajikan **dua tingkat**, karena keduanya menjawab pertanyaan berbeda.

### Laba Kotor — angka buku besar

```
Pendapatan (dasar pengenaan pajak)
− Harga Pokok Penjualan
─────────────────────────────────
= Laba Kotor            + Margin Kotor %
```

Keduanya ada di buku besar dan dapat diadu dengan neraca. Harga pokok **sudah
memuat** bahan, upah tukang, dan overhead yang terserap lewat perintah produksi.

Pendapatan memakai dasar pengenaan pajak, bukan total tagihan: PPN Keluaran
adalah titipan untuk negara, bukan pendapatan proyek. Nota kredit menguranginya.

### Laba Bersih — pandangan manajerial

```
Laba Kotor
− Beban Bertanda Proyek
− Upah Belum Terserap Produksi
─────────────────────────────────
= Laba Bersih           + Margin Bersih %
```

Beban bertanda proyek datang dari baris tagihan pemasok yang ditandai, dan dari
item jurnal manual yang menandai proyek ini.

### Ke mana upah tukang bermuara

Ini bagian yang paling mudah salah, jadi ditegaskan:

| Baris timesheet | Bermuara ke | Muncul di |
|---|---|---|
| Tertaut Perintah Produksi | Barang Dalam Proses → harga pokok barang jadi | **Laba Kotor** (di dalam HPP) |
| Tanpa Perintah Produksi | Tidak menyentuh buku besar | **Laba Bersih** saja |

Upah yang sudah terserap **tidak pernah ditambahkan lagi** sebagai beban,
karena itu berarti menghitung upah yang sama dua kali. Laporan tetap
menampilkan angkanya sebagai keterangan agar terlihat berapa upah yang sudah
masuk harga pokok.

Contohnya: tukang bekerja 8 jam di bengkel (tertaut perintah produksi) dan 4 jam
memasang di lokasi pelanggan (tanpa perintah). Yang 8 jam masuk harga pokok
barang jadi; yang 4 jam mengurangi laba bersih saja.

### Penguncian Setelah Lunas

Selama proyek berjalan, angkanya dihitung ulang setiap laporan dibuka. Begitu
seluruh faktur proyek lunas, proyek boleh **dikunci**: keenam angkanya dibekukan
dan laporan membaca snapshot itu.

Sejak saat itu posting jurnal apa pun yang menandai proyek tersebut ditolak,
sehingga biaya yang datang terlambat tidak bisa diam-diam mengubah laba yang
sudah dilaporkan. Sistem menyebutkan penghalangnya bila proyek belum siap
dikunci — masih ada tugas terbuka, atau piutangnya belum lunas.

Membuka kunci mengembalikan perhitungan hidup dan menghapus snapshot-nya. Siapa
yang mengunci beserta kapan selalu tercatat.

---

## Perubahan Aturan

Empat aturan berubah dari sistem sebelumnya. Semuanya disengaja.

**Faktur tidak lagi menunggu pengiriman.** Sebelumnya hanya kuantitas yang sudah
dikirim yang boleh difakturkan. Aturan itu membuat tagihan uang muka mustahil
diterbitkan. Sekarang seluruh isi pesanan yang sudah dikonfirmasi boleh
ditagih, dan yang ditahan adalah pengirimannya.

**Pengiriman menunggu produksi selesai.** Aturan baru, menggantikan aturan lama
di atas sebagai penjaga urutan dokumen.

**Timesheet dapat menjadi angka buku besar.** Sebelumnya upah timesheet selalu
angka manajerial. Sekarang baris yang tertaut perintah produksi diserap ke harga
pokok. Konsekuensinya laporan proyek harus memisahkan upah terserap dari yang
belum — kalau tidak, upah terhitung dua kali.

**Tarif tukang pindah dari proyek ke pegawai.** Kolom `projects.tarif_per_jam`
dihapus; tarif kini milik masing-masing pegawai beserta satuannya.

### Catatan Migrasi

Migrasi `0017_tambahan_alur_proyek.sql` **mengosongkan tabel `timesheets`**.

Pelaksana timesheet berpindah dari `users` (pengguna sistem) ke `partners`
(pegawai), dan tidak ada pemetaan yang sah dari pengguna ke pegawai — keduanya
master yang berbeda. Baris lama tidak dapat dibawa serta.

**Cadangkan tabel `timesheets` sebelum menjalankan migrasi ini di basis data
yang sudah berisi.** Pernyataan `DELETE` itu satu-satunya yang ditulis tangan
di berkas migrasi; sisanya keluaran generator.
