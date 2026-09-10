/**
 * Pemetaan jurnal bawaan. Setiap jenis posting otomatis diarahkan ke jurnal
 * yang lazim dipakai, dan seluruhnya dapat diubah lewat Konfigurasi →
 * Pemetaan Jurnal tanpa menyentuh kode.
 */
export const PEMETAAN_JURNAL_BAWAAN = [
  {
    kode: 'gudang:stok', nama: 'Pergerakan Stok', jurnal: 'JPS',
    deskripsi: 'Penerimaan, pengiriman, barang rusak, stock opname, dan pergerakan produksi',
  },
  {
    kode: 'pembelian:tagihan', nama: 'Tagihan Pembelian', jurnal: 'PMB',
    deskripsi: 'Tagihan dan nota debit dari pemasok',
  },
  {
    kode: 'penjualan:faktur', nama: 'Faktur Penjualan', jurnal: 'PNJ',
    deskripsi: 'Faktur dan nota kredit kepada pelanggan',
  },
  {
    kode: 'pembayaran:kas', nama: 'Pembayaran Tunai', jurnal: 'KAS',
    deskripsi: 'Pembayaran dan penerimaan lewat akun bertipe kas',
  },
  {
    kode: 'pembayaran:bank', nama: 'Pembayaran Bank', jurnal: 'BNK',
    deskripsi: 'Pembayaran dan penerimaan lewat akun bertipe bank',
  },
  {
    kode: 'manufaktur:biaya', nama: 'Biaya Produksi', jurnal: 'JU',
    deskripsi: 'Penyerapan tenaga kerja dan overhead ke Barang Dalam Proses',
  },
  {
    kode: 'aset:depresiasi', nama: 'Depresiasi Aset', jurnal: 'JU',
    deskripsi: 'Beban depresiasi bulanan aset tetap',
  },
  {
    kode: 'aset:pelepasan', nama: 'Pelepasan Aset', jurnal: 'JU',
    deskripsi: 'Pengeluaran aset dari neraca beserta laba atau ruginya',
  },
  {
    kode: 'bagi-hasil:distribusi', nama: 'Distribusi Bagi Hasil', jurnal: 'JU',
    deskripsi: 'Pemindahan laba bersih periode ke akun modal masing-masing pemilik',
  },
] as const
