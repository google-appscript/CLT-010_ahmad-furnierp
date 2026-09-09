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
