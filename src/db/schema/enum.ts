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
