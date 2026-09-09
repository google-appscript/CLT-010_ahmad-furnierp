import { pgEnum } from 'drizzle-orm/pg-core'

export const tipePartnerEnum = pgEnum('tipe_partner', ['perorangan', 'badan'])

/**
 * Tipe akun adalah dasar seluruh pelaporan. Laporan tidak diturunkan dari
 * hierarki kode akun, melainkan dari tipe ini — sehingga mengubah kode akun
 * tidak merusak laporan, dan akun baru otomatis muncul di baris yang tepat.
 */
export const tipeAkunEnum = pgEnum('tipe_akun', [
  'aset_kas', 'aset_bank', 'aset_piutang', 'aset_persediaan', 'aset_lancar_lain',
  'aset_tetap', 'aset_akumulasi_depresiasi', 'aset_tidak_lancar_lain',
  'liabilitas_utang_usaha', 'liabilitas_pajak',
  'liabilitas_jangka_pendek', 'liabilitas_jangka_panjang',
  'ekuitas', 'ekuitas_laba_ditahan', 'ekuitas_laba_berjalan',
  'pendapatan', 'pendapatan_lain',
  'beban_hpp', 'beban_operasional', 'beban_depresiasi', 'beban_lain', 'beban_pajak',
])

export const tipeJurnalEnum = pgEnum('tipe_jurnal', [
  'penjualan', 'pembelian', 'kas', 'bank', 'umum',
])

export const ruangLingkupPajakEnum = pgEnum('ruang_lingkup_pajak', ['penjualan', 'pembelian'])

export const statusTahunBukuEnum = pgEnum('status_tahun_buku', ['terbuka', 'ditutup'])

export const resetUrutanEnum = pgEnum('reset_urutan', ['tidak_pernah', 'tahunan', 'bulanan'])

export const aksiAuditEnum = pgEnum('aksi_audit', [
  'buat', 'ubah', 'hapus', 'posting', 'balik', 'masuk',
])

/**
 * Ketiga status tidak saling menggantikan:
 *   draft      — sedang disusun, belum bernomor, belum masuk laporan
 *   diposting  — resmi, bernomor, masuk laporan, tidak dapat diubah
 *   dibatalkan — draft yang dibatalkan namun sengaja disimpan sebagai jejak
 * Status 'dibatalkan' hanya dapat dicapai dari 'draft'; entri terposting
 * dikoreksi lewat entri pembalik, bukan dengan pembatalan.
 */
export const statusEntriEnum = pgEnum('status_entri', ['draft', 'diposting', 'dibatalkan'])

export const tipeProdukEnum = pgEnum('tipe_produk', ['disimpan', 'jasa', 'konsumsi'])

export const kategoriUomEnum = pgEnum('kategori_uom', [
  'satuan', 'berat', 'panjang', 'luas', 'volume', 'waktu',
])

/**
 * Setiap pergerakan stok selalu antara dua lokasi. Lokasi virtual membuat
 * seluruh operasi memakai satu mekanisme yang sama: penerimaan adalah
 * pemasok → internal, pengiriman internal → pelanggan, barang rusak
 * internal → rusak, dan stock opname penyesuaian ↔ internal.
 */
export const tipeLokasiEnum = pgEnum('tipe_lokasi', [
  'internal', 'pemasok', 'pelanggan', 'penyesuaian', 'rusak', 'produksi', 'transit',
])

export const tipeOperasiEnum = pgEnum('tipe_operasi', [
  'penerimaan', 'pengiriman', 'transfer', 'barang_rusak', 'opname',
  // Produksi memakai mekanisme yang sama: bahan keluar ke lokasi virtual
  // Produksi, barang jadi masuk kembali dari sana. Keduanya tidak dibuat
  // manual melainkan selalu lahir dari sebuah perintah produksi.
  'konsumsi_produksi', 'hasil_produksi',
])

/**
 * Operasi draft belum menyentuh stok. Menyelesaikannya membuat pergerakan
 * stok dan memposting jurnal; setelah itu isinya tidak dapat diubah.
 */
export const statusOperasiEnum = pgEnum('status_operasi', ['draft', 'selesai', 'dibatalkan'])

/**
 * Permintaan penawaran dan pesanan pembelian adalah dokumen yang sama pada
 * tahap berbeda, persis seperti di Odoo. Mengonfirmasi permintaan mengubahnya
 * menjadi pesanan dan memberinya nomor.
 */
export const statusPembelianEnum = pgEnum('status_pembelian', [
  'permintaan', 'dikonfirmasi', 'selesai', 'dibatalkan',
])

export const statusTagihanEnum = pgEnum('status_tagihan', ['draft', 'diposting', 'dibatalkan'])

/** Nota debit membalik arah tagihan, dipakai untuk retur atau koreksi. */
export const tipeTagihanEnum = pgEnum('tipe_tagihan', ['tagihan', 'nota_debit'])

export const statusPembayaranEnum = pgEnum('status_pembayaran', ['draft', 'diposting', 'dibatalkan'])

/**
 * Penawaran dan pesanan penjualan adalah dokumen yang sama pada tahap
 * berbeda, sama seperti permintaan penawaran dan pesanan pembelian.
 */
export const statusPenjualanEnum = pgEnum('status_penjualan', [
  'penawaran', 'dikonfirmasi', 'selesai', 'dibatalkan',
])

/** Nota kredit membalik arah faktur, dipakai untuk retur atau koreksi. */
export const tipeFakturEnum = pgEnum('tipe_faktur', ['faktur', 'nota_kredit'])

/**
 * Perintah produksi mengikuti pola dokumen lain: draft belum bernomor dan belum
 * menyentuh stok, konfirmasi memberi nomor dan mengunci kebutuhan bahan, dan
 * penyelesaian mencatat konsumsi, biaya, serta hasil produksinya sekaligus.
 */
export const statusPerintahProduksiEnum = pgEnum('status_perintah_produksi', [
  'draft', 'dikonfirmasi', 'selesai', 'dibatalkan',
])

/**
 * Garis lurus membebankan jumlah yang sama setiap bulan. Saldo menurun ganda
 * membebankan dua kali tarif garis lurus atas nilai buku berjalan, sehingga
 * beban besar di awal dan mengecil kemudian; keduanya berhenti tepat di nilai
 * residu.
 */
export const metodeDepresiasiEnum = pgEnum('metode_depresiasi', [
  'garis_lurus', 'saldo_menurun_ganda',
])

/**
 * Aset draft belum punya jadwal depresiasi. Menjalankannya menyusun jadwal
 * dan mengubah status menjadi berjalan; setelah seluruh barisnya diposting
 * aset menjadi selesai. Aset yang dilepas berhenti disusutkan apa pun sisa
 * masa manfaatnya.
 */
export const statusAsetEnum = pgEnum('status_aset', [
  'draft', 'berjalan', 'selesai', 'dilepas',
])

export const statusDepresiasiEnum = pgEnum('status_depresiasi', ['draft', 'diposting'])

/**
 * Proyek mengikuti pesanan penjualannya: dimulai saat pekerjaan berjalan dan
 * ditutup saat pekerjaan selesai. Menutup proyek menghentikan pencatatan
 * timesheet baru tanpa menghapus riwayatnya.
 */
export const statusProyekEnum = pgEnum('status_proyek', [
  'draft', 'berjalan', 'selesai', 'dibatalkan',
])

export const statusTugasEnum = pgEnum('status_tugas', [
  'belum_mulai', 'berjalan', 'selesai', 'dibatalkan',
])
