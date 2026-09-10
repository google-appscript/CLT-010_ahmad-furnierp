/**
 * Tiga unit kerja utama yang menanggung beban operasional.
 *
 * Pembagian ini permanen, berbeda dari proyek yang punya awal dan akhir.
 * Keduanya berdampingan sebagai dimensi terpisah: sebuah beban dapat
 * sekaligus milik Workshop dan proyek tertentu.
 */
export const POS_BIAYA = [
  {
    kode: 'BB', nama: 'Bahan Baku',
    deskripsi: 'Pengadaan, penyimpanan, dan penyiapan bahan baku',
  },
  {
    kode: 'WS', nama: 'Workshop',
    deskripsi: 'Produksi dan pengerjaan di bengkel',
  },
  {
    kode: 'SE', nama: 'Showroom Ekspor',
    deskripsi: 'Pemajangan, penjualan, dan pengiriman ekspor',
  },
] as const

/**
 * Pos biaya bawaan tiap gudang. Pergerakan stok mewarisi pos ini sehingga
 * operator tidak perlu memilihnya pada setiap transaksi.
 */
export const POS_BAWAAN_LOKASI = [
  { lokasi: 'GU/BB', pos: 'BB' },
  { lokasi: 'GU/BDP', pos: 'WS' },
  { lokasi: 'GU/BJ', pos: 'SE' },
] as const
