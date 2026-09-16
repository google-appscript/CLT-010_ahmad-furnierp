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
pnpm test:watch       # mode watch
pnpm db:generate      # hasilkan migrasi dari perubahan skema
pnpm db:migrate       # terapkan migrasi ke furnierp_dev
pnpm db:seed          # data awal (idempoten)
pnpm db:studio        # Drizzle Studio
pnpm exec tsc --noEmit && pnpm build && pnpm lint
```

Menjalankan sebagian uji saja:

```bash
pnpm exec vitest run tests/penjualan/alur.test.ts          # satu berkas
pnpm exec vitest run tests/penjualan                       # satu folder
pnpm exec vitest run -t 'pengiriman membebankan harga pokok'  # satu kasus
```

`pnpm build` menjalankan `db:migrate` lebih dulu, jadi build memerlukan
basis data yang dapat dihubungi. Untuk sekadar memeriksa tipe tanpa
menyentuh basis data, pakai `pnpm exec tsc --noEmit`.

Berkas lingkungan: `.env.local` untuk pengembangan (dimuat Next.js sendiri;
skrip `tsx` memuatnya lewat `muatEnv()` di `src/lib/env.ts`), `.env.test`
untuk pengujian. `DATABASE_URL_UNPOOLED` dipakai `db:migrate` bila ada —
DDL berjalan sebagai satu transaksi panjang dan pooler mode transaksi
dapat memindahkannya ke sesi lain di tengah jalan.

## Aturan yang Tidak Boleh Dilanggar

**Presisi uang.** Uang tidak pernah disimpan atau dihitung sebagai `float`
maupun `number`. PostgreSQL memakai `numeric(18,2)` untuk IDR dan
`numeric(18,6)` untuk valas serta kurs. TypeScript membawa nilai sebagai
`string`; aritmatika hanya lewat `src/lib/uang.ts`.

**Batas modul.** Jalur tulis selalu UI → Server Action → layanan →
(repositori) → basis data. Server Action tidak pernah menulis ke basis data
sendiri; ia memanggil layanan. Jalur baca lebih longgar: komponen server
(`page.tsx` dan `data-pilihan.ts`) boleh melakukan `select` langsung lewat
`db` untuk daftar dan data pilihan formulir — yang tidak boleh adalah
`insert`, `update`, `delete`, dan perhitungan bisnis di luar layanan. Modul
non-akuntansi tidak boleh menulis ke tabel jurnal; satu-satunya kanal adalah
layanan akuntansi.

**Entri terposting tidak pernah diubah.** Koreksi hanya lewat entri pembalik.
Nomor diberikan saat posting, bukan saat draft dibuat.

**Tipe akun adalah dasar pelaporan.** Laporan diturunkan dari `tipe_akun`,
bukan dari hierarki kode akun. Menambah akun baru otomatis muncul di baris
laporan yang benar tanpa konfigurasi tambahan.

**Jurnal dan akun otomatis berasal dari data, bukan dari kode.** Tidak boleh
ada kode akun maupun kode jurnal yang ditulis harfiah di dalam layanan. Jurnal
tujuan setiap posting otomatis dibaca lewat `jurnalUntukDalamTx()` dari tabel
`journal_mappings`, dan akun penampung otomatis lewat `akunOtomatisDalamTx()`
dari `company_settings` — keduanya di
`src/modules/akuntansi/layanan/pemetaan.ts`. Mengubah pemetaan hanya berlaku
untuk transaksi berikutnya; dokumen yang sudah diposting tetap memegang jurnal
yang berlaku saat itu, sesuai aturan bahwa entri terposting tidak pernah
diubah.

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

**Satu proyek satu pesanan penjualan.** Aturan ini yang membuat profitabilitas
proyek dapat dihitung tanpa alokasi: apa pun yang difakturkan dan dikirim atas
pesanan itu adalah pendapatan dan harga pokok proyeknya. Penegakannya struktural
lewat indeks unik pada `projects.so_id`.

**Faktur tidak menunggu pengiriman, pengiriman menunggu produksi.** Seluruh isi
pesanan yang sudah dikonfirmasi boleh difakturkan kapan saja — pekerjaan
pesanan berjalan berbulan-bulan dan pembayaran pertamanya ditagih di muka, jadi
menunggu barang keluar gudang berarti tidak pernah bisa menerbitkan tagihan yang
menjadi dasar uang muka. Yang ditahan adalah pengirimannya: selama proyek masih
punya perintah produksi berstatus draft atau dikonfirmasi, `kirimDariPesanan()`
menolak. Barangnya memang belum berwujud, dan harga pokoknya belum lengkap
karena biaya konversi baru terserap saat perintah produksi diselesaikan.

Uang muka tidak berupa tipe faktur tersendiri: satu proyek satu faktur, dan
pembayarannya dipecah menjadi beberapa penerimaan parsial lewat
`customer_payment_allocations`. Penerimaan yang belum dialokasikan jatuh ke akun
Uang Muka Penjualan.

**Upah tukang menjadi angka buku besar hanya lewat produksi.** Timesheet
sendiri tidak memposting jurnal. Baris yang tertaut sebuah perintah produksi
(`timesheets.wo_id`) diserap ke Barang Dalam Proses sebagai biaya tenaga kerja
saat perintah diselesaikan, lalu menyatu ke harga pokok barang jadi — dan sejak
saat itu **tidak boleh ditambahkan lagi** sebagai beban proyek, sebab itu
berarti menghitung upah yang sama dua kali. Baris yang tidak tertaut tetap
angka manajerial dan hanya mengurangi laba bersih.

Upahnya berasal dari master Pegawai (`partners.is_pegawai`), bukan dari proyek.
Tarif beserta satuannya — harian atau jam — dibekukan ke setiap baris saat
dicatat, sehingga menaikkan upah tidak mengubah biaya pekerjaan yang sudah
lewat. Satuan disimpan apa adanya dan tidak pernah dikonversi: tukang harian
menerima upah satu hari penuh meski pulang lebih awal, jadi membagi tarif
harian dengan jam standar akan melaporkan angka yang tidak pernah terjadi.

**Laba proyek disajikan dua tingkat.** Laba kotor = pendapatan − harga pokok,
seluruhnya angka buku besar dan dapat diadu dengan neraca. Laba bersih
menguranginya dengan beban bertanda proyek dan upah yang belum terserap
produksi. Harga pokok dikenali dari akun bertipe `beban_hpp`; beban lain
sengaja mengecualikan tipe itu agar jurnal pengiriman yang bertanda proyek
tidak terhitung dua kali.

**Dimensi proyek mengalir dari dokumen, bukan diketik di jurnal.** Sama seperti
pos biaya, penanda proyek diteruskan otomatis ke item jurnal oleh dokumen
sumbernya: `stock_operations.proyek_id` (pengiriman atas pesanan berproyek,
konsumsi dan hasil produksi) dan `vendor_bill_lines.proyek_id`. Penandanya
hanya menempel pada sisi beban — menandai persediaan, PPN, atau utang tidak
punya arti karena laporan proyek hanya membaca akun beban.

**Job costing dikunci setelah lunas.** Selama proyek berjalan angkanya dihitung
ulang dari dokumen sumbernya. Begitu seluruh faktur proyek diterima
pembayarannya, proyek boleh dikunci: keenam angkanya dibekukan ke kolom
`…_final` dan laporan membaca snapshot itu, bukan menghitung ulang. Sejak saat
itu `postingJurnalDalamTx()` menolak item jurnal apa pun yang menandai proyek
tersebut, sehingga biaya yang datang terlambat tidak bisa diam-diam mengubah
laba yang sudah dilaporkan. Membuka kunci mengembalikan perhitungan hidup dan
menghapus snapshot-nya, dan siapa yang mengunci beserta kapan selalu tercatat.

**Penampung penerimaan wajib tertutup.** Penerimaan barang mengkredit akun
Penerimaan Barang Belum Ditagih, dan tagihan pemasok mendebitnya kembali.
Saldo akun itu yang tidak nol berarti ada barang diterima yang belum ditagih —
bukan kesalahan, tetapi harus dapat dijelaskan.

**PPN dan PPh diperlakukan berbeda.** PPN Masukan menambah nilai tagihan dan
dapat dikreditkan; PPh adalah pajak yang dipotong dari pembayaran sehingga
mengurangi kas tanpa mengurangi nilai tagihan pemasok.

**Pos biaya tidak memecah item jurnal.** Alokasi ke pos biaya hidup di tabel
sampingan `journal_item_cost_allocations`; baris jurnalnya tetap utuh sehingga
buku besar tidak pernah berubah bentuk hanya karena sebuah beban dibagi ke
beberapa unit kerja. Persentase satu item wajib berjumlah tepat seratus, satu
pos tidak boleh muncul dua kali, dan baris terakhir menyerap sisa pembulatan
agar jumlah nilai alokasi persis sama dengan nilai itemnya. Hanya akun laba
rugi yang boleh dialokasikan. Beban yang belum dialokasikan tidak hilang —
Laporan Laba Rugi per Pos menampilkannya sebagai "Belum dialokasikan" supaya
totalnya selalu sama dengan laba rugi biasa.

**Bagi hasil tidak menutup laba rugi.** Penguncian sebuah periode memindahkan
laba bersihnya dari Laba Tahun Berjalan ke akun modal masing-masing pemilik,
tetapi tidak menyentuh akun pendapatan maupun beban — Laporan Laba Rugi
periode itu tetap terbaca utuh sesudahnya. Setiap pemilik wajib punya akun
modalnya sendiri, porsi satu susunan kepemilikan wajib berjumlah seratus
persen, dan susunan yang sudah dipakai periode terkunci tidak boleh diubah
lagi. Periode dikunci berurutan; membuka kunci membalik jurnal distribusinya,
bukan menghapusnya. Panjang periode — bulanan, kuartalan, atau tahunan —
adalah pengaturan global, dan periode yang sudah terkunci menyimpan tipenya
sendiri sehingga tidak ikut berubah.

**Penomoran dokumen.** Nomor diambil lewat `ambilNomorBerikut()` yang mengunci
baris definisi urutan dengan `FOR UPDATE` di dalam transaksi yang sama dengan
posting. Jangan pernah membaca lalu menaikkan pencacah di luar pola itu.
Pencacahnya disimpan per periode di `sequence_periods`, bukan satu angka
dengan penanda periode terakhir — dokumen bertanggal mundur, seperti
depresiasi beberapa bulan yang diposting sekaligus, tidak boleh menerbitkan
nomor yang sudah terpakai di periode berjalan.

**Kurs dibekukan.** Kurs diambil dari tanggal transaksi dan disimpan pada entri.
Kurs bertanggal setelah tanggal transaksi tidak pernah dipakai.

**Tempo diturunkan sekali lalu disimpan.** `tempoDokumenDalamTx()` di
`src/modules/akuntansi/layanan/syarat-pembayaran.ts` mencari syarat pembayaran
berjenjang — yang dipilih pada dokumen, lalu pesanan asalnya, lalu bawaan
mitranya — menurunkan tanggal jatuh temponya, dan menyimpan keduanya pada
faktur atau tagihan. Mengubah syarat tidak menggeser tempo dokumen yang sudah
terbit, dan tempo yang diketik manual selalu menang.

**Bahasa.** Label, pesan validasi, dan identifier domain berbahasa Indonesia
dengan ejaan lengkap. Nama tabel tetap bahasa Inggris.

## Susunan Kode

```
src/app/(app)/<area>/          # halaman mengikuti struktur navigasi
  page.tsx                     # komponen server; wajibIzin() di baris pertama
  aksi.ts                      # Server Action, satu berkas per area
  data-pilihan.ts              # query pilihan untuk formulir
src/modules/<domain>/
  layanan/                     # logika bisnis dan transaksi
  repositori/                  # query yang dipakai ulang (opsional — hanya
                               #   akuntansi, gudang, identitas, preferensi)
  validasi/                    # skema Zod, tipe masukan, label enum
src/db/schema/                 # Drizzle, satu berkas per domain
src/lib/                       # uang, navigasi, izin, sesi, daftar, galat, env
src/components/{data,formulir,laporan,tata-letak,ui}/
```

Modul tanpa `repositori/` menaruh querinya langsung di `layanan/`; tidak perlu
membuat lapisan itu hanya demi simetri.

**Server Action.** Berkas `aksi.ts` di dalam folder rute, diawali
`'use server'`. Polanya seragam dan harus diikuti: fungsi berawalan `aksi…`,
memanggil `wajibIzin(IZIN)` sebagai langkah pertama, membungkus pemanggilan
layanan dalam `try/catch`, mencatat `catatAudit()`, memanggil helper
`segarkan()` berisi `revalidatePath()` untuk seluruh rute yang terpengaruh,
lalu mengembalikan `HasilAksi` — `{ berhasil: true; id?: string }` atau
`{ berhasil: false; pesan: string }`. Galat dikembalikan sebagai nilai, tidak
dilempar ke klien.

**Galat yang boleh dibaca pengguna.** Layanan melempar `ValidasiError`
(`src/lib/galat.ts`) untuk pelanggaran aturan bisnis; pesannya ditulis
lengkap dalam bahasa Indonesia karena tampil apa adanya di antarmuka.

**Transaksi.** Fungsi berakhiran `…DalamTx(tx, …)` adalah varian yang ikut
transaksi pemanggil; tipe `tx` adalah `Transaksi` dari `src/db/klien.ts`.
Sediakan varian ini setiap kali sebuah operasi mungkin perlu segabung dengan
posting jurnal atau pergerakan stok. Pasangan non-`DalamTx`-nya membuka
transaksinya sendiri.

**Daftar.** Pencarian, filter, pengelompokan, pengurutan, dan paginasi dibaca
dari URL lewat `uraikanParameterDaftar()` di `src/lib/daftar.ts`
(`ParameterDaftar` / `HasilDaftar<T>`), bukan state klien.

## Skema dan Migrasi

Nama tabel bahasa Inggris `snake_case` (`sales_orders`); properti TypeScript
bahasa Indonesia `camelCase` (`lewatPenawaran`, `tanggalPengiriman`) dengan
nama kolom `snake_case` sebagai argumennya. Kolom teknis seperti `isActive`
tetap bahasa Inggris.

Alurnya: ubah berkas di `src/db/schema/`, ekspor lewat `index.ts`, jalankan
`pnpm db:generate`, baca SQL yang dihasilkan, lalu `pnpm db:migrate`. Berkas
SQL di `drizzle/` adalah keluaran generator — jangan diedit tangan.

## Pengujian

Uji bersifat integrasi terhadap basis data `furnierp_test` yang sungguhan,
bukan mock. `tests/setup-global.ts` menjalankan migrasi sekali di awal;
`DATABASE_URL` diambil dari `.env.test`. Seluruh berkas berbagi satu basis
data dan berjalan berurutan (`fileParallelism: false`) — jangan pernah
menjalankan dua suite sekaligus terhadap basis data yang sama.

Pola satu berkas uji: daftarkan `TABEL` dalam urutan aman terhadap foreign
key, panggil `bersihkanTabel(TABEL)` di `beforeEach` (`tests/bantuan/db.ts`,
`TRUNCATE … RESTART IDENTITY CASCADE`), dan `tutupKoneksi()` di `afterAll`.
Fixture yang memicu posting otomatis wajib memanggil `seedPemetaanJurnal()`
dari `tests/bantuan/pemetaan.ts` lebih dulu — tanpa itu posting gagal karena
jurnal tujuannya adalah data, bukan kode.

Uji memanggil layanan secara langsung, bukan Server Action, sehingga tidak
memerlukan sesi maupun izin.

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

## Antarmuka

Halaman disusun dari komponen bersama, bukan markup sendiri-sendiri:
`KepalaHalaman`, `TabelData`/`TabelDataInteraktif` (kolom dideklarasikan
sebagai `Kolom<T>`), `PanelPencarian`, `TombolBuat`/`TombolUbah`/`TombolHapus`,
serta keluarga `Formulir*` (`FormulirBingkai`, `FormulirNotebook`,
`FormulirGrid`, `FormulirField`, `FormulirBarisTabel`). Komponen `src/components/ui/`
berasal dari shadcn dan tidak diubah tangan.

**Warna status mengikuti makna, bukan nama.** `LencanaStatus`
(`src/components/data/lencana-status.tsx`) memetakan status seluruh modul ke
enam nada: `netral` (belum mengikat), `proses` (berjalan), `tuntas`, `beku`,
`batal`, `perhatian`. `selesai` di gudang dan `diposting` di akuntansi
sama-sama tuntas sehingga warnanya sama. Status baru didaftarkan di peta
`NADA` di berkas itu — jangan menulis kelas warna di halaman.

## Catatan Lingkungan Kerja

`AGENTS.md` ditulis ulang oleh `next dev`; blok isinya mengingatkan bahwa
Next.js 16 berbeda dari versi yang dikenal model, dan dokumentasinya ada di
`node_modules/next/dist/docs/`. Commit berkas itu bersama pekerjaan lain
alih-alih mengembalikannya.

Folder `.claude/` berisi worktree sesi kerja lain di dalam repositori ini dan
dikecualikan dari Vitest maupun ESLint. Tanpa pengecualian itu, uji dari dua
worktree berjalan terhadap satu basis data yang sama.

## Status

Ketujuh fase selesai, ditambah empat kebutuhan spesifik pemilik usaha:
konfigurasi jurnal otomatis, pos biaya mengambang, kepemilikan bersama dengan
bagi hasil, dan job costing yang terkunci pasca-lunas. Sistem mencatat
transaksi keuangan lengkap, mengelola
persediaan dengan valuasi rata-rata bergerak, menjalankan alur pembelian dari
permintaan penawaran sampai pelunasan pemasok, alur penjualan dari penawaran
sampai penerimaan pembayaran dengan rekonsiliasi item jurnal, produksi dari
resep sampai barang jadi bernilai harga pokok penuh, aset tetap dari
pendaftaran sampai pelepasan, serta proyek dari pembukaan sampai laporan
profitabilitasnya.

Urutan dokumen penjualan menegakkan satu aturan: pengiriman menunggu produksi
selesai, sedangkan faktur tidak menunggu pengiriman. Pengiriman membebankan
harga pokok rata-rata lawan persediaan; faktur mencatat pendapatan, PPN
Keluaran, dan piutang. Pembayaran yang melunasi seluruh piutang seorang
pelanggan memicu rekonsiliasi otomatis; pelunasan sebagian sengaja dibiarkan
terbuka agar sisanya terlihat — itulah yang membuat uang muka dan termin
berjalan tanpa dokumen khusus.

Manufaktur memakai mekanisme pergerakan stok yang sama seperti modul lain:
bahan keluar gudang menuju lokasi virtual Produksi, biaya konversi diserap ke
Barang Dalam Proses, lalu barang jadi masuk gudang senilai seluruh biaya itu.
Resep disalin ke perintah produksi saat dibuat, bukan dibaca ulang saat
diselesaikan, sehingga mengubah resep tidak mengusik perintah yang sedang
berjalan.

Aset tetap menyusun seluruh jadwal depresiasinya sekaligus saat dijalankan,
lalu membebankannya bulan demi bulan — satu per satu atau berkala untuk semua
aset sekaligus. Register aset tidak memposting perolehan; Laporan Aset
membandingkannya terhadap saldo akun agar selisih apa pun langsung terlihat.

Proyek memegang tepat satu pesanan penjualan, sehingga pendapatan dan harga
pokoknya terbaca langsung dari dokumen penjualan tanpa alokasi. Beban lain
ditandai lewat kolom proyek pada item jurnal, dan jam kerja dicatat di
timesheet dengan tarif yang dibekukan saat pencatatan. Setelah seluruh faktur
proyek lunas, angkanya dibekukan dan proyek tidak lagi menerima biaya baru.

Seluruh posting otomatis mengambil jurnal tujuan dan akun penampungnya dari
konfigurasi, bukan dari kode. Layar Pemetaan Jurnal menampilkan sembilan
pemetaan — stok, tagihan pembelian, pembayaran kas dan bank, faktur penjualan,
biaya produksi, depresiasi, pelepasan aset, distribusi bagi hasil — beserta
sembilan akun otomatis yang menyertainya. Pemetaan pembayaran memilih jurnal
kas atau bank sendiri berdasarkan tipe akun yang dipakai.

Beban operasional dikelompokkan ke pos biaya. Satu baris jurnal boleh
sepenuhnya milik satu pos atau dibagi berpersentase ke beberapa pos sekaligus,
dan lokasi gudang internal dapat menunjuk pos bawaannya sehingga pergerakan
stok teralokasi tanpa dipilih manual. Pos biaya dan proyek adalah dua dimensi
yang berdiri sendiri di atas item jurnal yang sama.

Kepemilikan dicatat sebagai susunan berlaku per rentang tanggal. Laba bersih
sebuah periode dikunci lalu dipindahkan ke akun modal tiap pemilik sesuai
porsinya, tanpa menutup laba rugi periode itu. Laporan transparansi membaca
hak tiap pemilik langsung dari buku besar, sehingga tidak mungkin berselisih
dengan neraca.

**Kanal integrasi.** Modul memposting jurnal lewat `postingJurnalDalamTx()` di
`src/modules/akuntansi/layanan/entri.ts` bila perubahan datanya perlu segabung
dalam satu transaksi dengan jurnalnya, atau `postingJurnal()` bila berdiri
sendiri. Keduanya menerima `sumberTipe` dan `sumberId` dokumen asalnya.
Modul pembelian, penjualan, dan manufaktur tidak menulis pergerakan stok
sendiri melainkan memanggil `buatOperasi()`/`selesaikanOperasi()` milik modul
gudang — atau varian `…DalamTx()`-nya bila seluruh langkah harus segabung
dalam satu transaksi, seperti pada penyelesaian perintah produksi. Modul proyek
tidak memposting jurnal sama sekali; ia membaca dokumen penjualan dan penanda
proyek pada item jurnal. Tidak ada modul yang menulis ke tabel jurnal secara
langsung.

Jurnal tujuan dan akun penampung diambil lewat `jurnalUntukDalamTx()` dan
`akunOtomatisDalamTx()` di `src/modules/akuntansi/layanan/pemetaan.ts`;
konstanta `PEMETAAN_JURNAL` dan `AKUN_OTOMATIS` di berkas itu adalah daftar
lengkap titik konfigurasinya. Modul kepemilikan memposting distribusi bagi
hasil lewat kanal yang sama dan membalikkannya dengan `balikEntri()` saat
kunci dibuka.
