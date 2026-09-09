# Restyling Template UI — Desain Menyeluruh

**Tanggal:** 10 September 2026
**Status:** Disetujui
**Cakupan:** Sistem tema warna, layout shell, komponen form, komponen list, dan navigasi untuk
seluruh antarmuka aplikasi. Sesi terpisah dari pengerjaan fitur Proyek (Fase 7) yang berjalan
paralel — modul Proyek ikut dimigrasi karena UI-nya sudah selesai dibangun.

Dokumen ini murni requirement fungsional dan keputusan desain. Detail implementasi kode (nama
fungsi persis, isi komponen, query) sengaja tidak ditulis di sini — akan ditulis langsung saat
implementasi agar tidak dua kali kerja.

---

## 1. Konteks

Template UI saat ini (shadcn/ui + Tailwind v4) memakai palet grayscale murni tanpa warna brand,
sidebar/topbar/canvas berwarna sama sehingga tidak ada pembeda visual "chrome vs konten", form
panjang satu halaman tanpa pengelompokan tab, halaman list tanpa paginasi dengan tombol "Buka"
terpisah dari baris, dan halaman detail beralih antara render form penuh (draft) dan render `<dl>`
ringkas (posted) — dua markup berbeda untuk data yang sama.

Restyling ini mendefinisikan ulang kelimanya sekaligus sebagai satu sistem desain koheren,
terinspirasi struktur dan spacing Odoo 18 (bukan palet warnanya), lalu digulirkan ke seluruh
modul yang sudah ada.

**Keputusan dasar yang mengikat seluruh restyling:**

| Aspek | Keputusan |
|---|---|
| Warna chrome | Sidebar + Topbar + Bilah menu semuanya dark blue (bukan hanya sidebar) |
| Warna aksen | Soft blue jadi aksen penuh: tombol primer, link, focus ring, item aktif |
| Dark mode | Diaktifkan penuh dengan toggle, bukan hanya infrastruktur CSS pasif |
| Acuan visual | Struktur & spacing ala Odoo 18; palet warna orisinal, bukan tiruan warna Odoo |
| Arsitektur form | Primitif komponen yang dirangkai manual per halaman (bukan form generik berbasis skema) |
| Alur data list | Server-driven lewat `searchParams`, bukan client-side data table |
| Kedalaman fitur list | Lengkap: chip filter, group by, favorit tersimpan |
| Cakupan rollout | Seluruh modul yang sudah ada, termasuk Proyek |
| Struktur navigasi sidebar | Tidak diubah — tiga tingkat grup → seksi → halaman di `navigasi.ts` tetap final |

---

## 2. Palet Warna & Design Token

Dua kelompok token baru menumpang di atas sistem token OKLCH yang sudah ada di `globals.css`.

**Token chrome** (dipakai Sidebar, Topbar/`BilahAtas`, `BilahMenu`) — dark navy, terpisah dari
token canvas:

| Token | Nilai (light) | Peran |
|---|---|---|
| `--chrome-background` | `oklch(0.22 0.045 259)` | Latar sidebar/topbar/bilah menu |
| `--chrome-foreground` | `oklch(0.92 0.01 259)` | Teks utama di atas chrome |
| `--chrome-muted-foreground` | `oklch(0.65 0.02 259)` | Teks menu tidak aktif |
| `--chrome-border` | `oklch(0.30 0.04 259)` | Garis pemisah antar seksi chrome |
| `--chrome-active` | `oklch(0.30 0.06 259)` | Latar item menu aktif/hover |

**Token canvas & aksen** (dipakai area konten):

| Token | Nilai (light) | Peran |
|---|---|---|
| `--background` | `oklch(0.97 0.003 259)` | Canvas konten |
| `--card` | `oklch(1 0 0)` | Kartu/panel di atas canvas (elevasi) |
| `--primary` | `oklch(0.60 0.13 259)` | Soft blue — tombol utama, link, focus ring, item aktif |
| `--primary-foreground` | `oklch(0.99 0 0)` | Teks di atas tombol primer |

**Requirement dark mode:** seluruh token di atas didefinisikan ulang di blok `.dark` dengan relasi
terbalik — canvas gelap sedang (`oklch(0.17 0.02 259)`), chrome lebih gelap lagi
(`oklch(0.12 0.03 259)`) sehingga hierarki chrome-vs-canvas tetap terasa di kedua mode, dan
`--primary` dinaikkan lightness-nya (`oklch(0.70 0.13 259)`) agar kontras cukup di atas latar
gelap. Warna status (destructive, dll.) yang sudah ada dipertahankan strukturnya, hue-nya
disesuaikan agar tidak bentrok dengan `--primary` baru.

Di luar cakupan: tidak menambah token status/semantik baru (success/warning/info) — cukup pakai
yang sudah ada.

---

## 3. Layout Shell & Dark Mode

**Requirement restyle chrome:** `Sidebar`, `BilahAtas`, `BilahMenu` beralih dari `bg-background`
ke token chrome di atas. Item menu aktif/hover mendapat highlight `--chrome-active` plus indikator
soft blue (`--primary`) agar tetap terlihat halaman aktif meski latar gelap. Border pemisah yang
sekarang nyaris tak terlihat (sewarna dengan latar) diganti `--chrome-border` agar tegas tanpa
shadow tambahan. Area `<main>` tetap canvas terang; struktur `flex h-screen` di `layout.tsx`
tidak berubah.

**Requirement dark mode:** root layout dibungkus `ThemeProvider` dari `next-themes`
(strategi `class`, default mengikuti preferensi sistem), memakai kelas `.dark` yang sudah ada di
`globals.css`. Toggle terang/gelap ditaruh di `BilahAtas`, sejajar dropdown user.

---

## 4. Sistem Form

Primitif baru menggantikan pola yang sekarang terduplikasi di `formulir-pesanan.tsx`,
`formulir-operasi.tsx`, `formulir-aset.tsx`:

| Komponen | Requirement fungsional |
|---|---|
| `FormulirBingkai` | Bingkai luar: breadcrumb (lihat §6), nomor dokumen + badge status, slot tombol aksi kontekstual kanan-atas (Kirim Barang, Buat Faktur, dll — tetap seperti sekarang) |
| `FormulirGrid` | Field header dipecah jadi dua kolom eksplisit kiri/kanan (bukan flowing wrap seperti sekarang) — ini "main form" (parent), selalu tampil, tidak masuk tab |
| `FormulirNotebook` | Widget tab gaya Odoo 18 untuk bagian sekunder/child: tab baris pesanan (child list), tab dokumen terkait (pengiriman/faktur — sekarang section terpisah, pindah jadi tab), tab catatan lain bila ada |
| `FormulirBarisTabel` | Konsolidasi tiga implementasi `<table>` mentah yang terduplikasi jadi satu komponen shared dengan sel input inline yang tetap editable |

**Requirement unified view/edit:** satu `FormulirBingkai` yang sama dipakai baik saat draft maupun
setelah diposting/dikonfirmasi — bukan lagi dua render terpisah (form penuh vs `<dl>` ringkasan).
Setiap field menerima status `readOnly` yang diturunkan dari status dokumen. Field readonly
dirender tanpa border/background input (teks polos, gaya field readonly Odoo); field yang masih
bisa diedit tetap tampil sebagai input bergaya biasa.

**Catatan keamanan (bukan sekadar UI):** `readOnly` di client murni kontrol UX. Validasi status
dokumen tetap ditegakkan di layanan/Server Action seperti sekarang — restyling tidak mengubah
lapisan otorisasi/validasi apa pun, hanya lapisan presentasi.

---

## 5. Sistem List

Konsolidasi dua pola tabel yang sekarang terduplikasi (`<table>` mentah di halaman transaksi vs
`TabelData` di halaman master data) jadi satu jalur, alur data server-driven lewat `searchParams`.

| Komponen | Requirement fungsional |
|---|---|
| `PanelPencarian` (baru) | Control panel di atas tabel: search box bebas teks, dropdown Filter yang menambah chip (klik chip untuk hapus), dropdown Group By, dropdown Favorit (simpan/panggil kombinasi search+filter+group by). Semua state ditulis ke URL, bukan state client lokal |
| `TabelData` (dievolusi) | Tambahan: seluruh baris bisa diklik untuk membuka dokumen (kolom "Buka" dihapus); pager gaya Odoo ("1-80 / 245" + prev/next, bukan nomor halaman); mode grup collapsible per field saat Group By aktif, dengan jumlah baris per grup |

**Requirement semantik filter:** antar-field bersifat AND; nilai jamak dalam satu field yang sama
bersifat OR (mis. Status: Draft atau Dikonfirmasi) — sama seperti perilaku Odoo.

**Requirement grouping + paginasi:** saat Group By aktif, paginasi pindah ke level grup (grup
collapsible, baris di dalamnya dimuat saat grup dibuka) alih-alih paginasi per baris flat.

**Requirement favorit tersimpan:** tabel baru `filter_tersimpan` (pengguna, kunci daftar, nama,
kriteria) dengan layanan CRUD sederhana lewat kanal Server Action → layanan → repositori standar
proyek — bukan tabel per modul, satu tabel generik dipakai semua daftar.

Di luar cakupan: tidak ada view switcher Kanban/Kalender.

---

## 6. Navigasi & Breadcrumb

Struktur sidebar tiga-tingkat di `navigasi.ts` tidak diubah — bukan bagian restyling ini.

**Requirement breadcrumb:** setiap halaman detail/form menampilkan jejak
"Modul / Sub-halaman / Nomor Dokumen" di `FormulirBingkai`, diturunkan dari `navigasi.ts` + nomor
dokumen. Klik pada bagian tengah breadcrumb kembali ke daftar — menggantikan tombol
"Kembali ke Daftar" yang sekarang ada di bawah halaman.

**Requirement bilah menu:** tab sub-halaman horizontal memakai indikator aktif underline soft
blue di atas chrome gelap (lihat §3).

Command palette (`Ctrl+K`) yang sudah ada tidak diubah — sudah cukup dekat dengan "search
everywhere" ala Odoo, hanya perlu dipastikan kontras di chrome baru.

---

## 7. Rencana Rollout & Migrasi

Urutan pengerjaan (dasar fase-fase rencana implementasi):

1. **Fondasi** — token warna, `ThemeProvider` + toggle, restyle Sidebar/BilahAtas/BilahMenu
2. **Pustaka komponen form** — `FormulirBingkai`, `FormulirGrid`, `FormulirNotebook`, `FormulirBarisTabel`
3. **Pustaka komponen list** — `PanelPencarian`, evolusi `TabelData`, tabel `filter_tersimpan` + layanannya
4. **Migrasi per modul** — Kontak → Penjualan → Pembelian → Gudang → Manufaktur → Akuntansi → Aset → Proyek

**Requirement verifikasi tiap batch:** `pnpm exec tsc --noEmit && pnpm build && pnpm lint` lolos;
`pnpm test` tetap hijau (logika Server Action/layanan tidak disentuh, hanya presentasi — tapi test
yang mengasumsikan fetch-semua-baris tanpa paginasi perlu ditinjau ulang); dicek langsung di dev
server per modul (list dengan search/filter/group/pagination, form draft yang bisa diedit, dokumen
posted yang readonly, toggle dark mode).

Karena cakupannya besar (8 modul + dua pustaka komponen baru + satu tabel baru), rencana
implementasi memecah ini jadi beberapa PR bertahap mengikuti urutan di atas, bukan satu PR
raksasa.

---

## 8. Di Luar Cakupan

- Token warna status/semantik baru (success/warning/info) di luar yang sudah ada
- View switcher Kanban/Kalender pada halaman list
- Mengubah struktur/paradigma sidebar tiga-tingkat
- Mengubah logika bisnis, validasi, atau lapisan otorisasi apa pun di layanan/repositori
- Modul Proyek: hanya restyling UI-nya; tidak mengubah fitur yang sedang dikembangkan di sesi lain
