/** Bagan akun standar Indonesia untuk manufaktur furnitur. */
export const BAGAN_AKUN_STANDAR = [
  // ASET LANCAR
  { kode: '1101', nama: 'Kas', tipeAkun: 'aset_kas' },
  { kode: '1102', nama: 'Kas Kecil', tipeAkun: 'aset_kas' },
  { kode: '1111', nama: 'Bank BCA', tipeAkun: 'aset_bank' },
  { kode: '1112', nama: 'Bank Mandiri', tipeAkun: 'aset_bank' },
  { kode: '1113', nama: 'Bank Valas USD', tipeAkun: 'aset_bank' },
  { kode: '1121', nama: 'Piutang Usaha', tipeAkun: 'aset_piutang' },
  { kode: '1122', nama: 'Piutang Karyawan', tipeAkun: 'aset_lancar_lain' },
  { kode: '1123', nama: 'Piutang Lain-lain', tipeAkun: 'aset_lancar_lain' },
  { kode: '1129', nama: 'Cadangan Kerugian Piutang', tipeAkun: 'aset_lancar_lain' },
  { kode: '1131', nama: 'Persediaan Bahan Baku', tipeAkun: 'aset_persediaan' },
  { kode: '1132', nama: 'Persediaan Bahan Penolong', tipeAkun: 'aset_persediaan' },
  { kode: '1133', nama: 'Persediaan Barang Dalam Proses', tipeAkun: 'aset_persediaan' },
  { kode: '1134', nama: 'Persediaan Barang Jadi', tipeAkun: 'aset_persediaan' },
  { kode: '1135', nama: 'Persediaan Suku Cadang', tipeAkun: 'aset_persediaan' },
  { kode: '1141', nama: 'PPN Masukan', tipeAkun: 'aset_lancar_lain' },
  { kode: '1142', nama: 'PPh 23 Dibayar di Muka', tipeAkun: 'aset_lancar_lain' },
  { kode: '1143', nama: 'PPh 25 Dibayar di Muka', tipeAkun: 'aset_lancar_lain' },
  { kode: '1151', nama: 'Uang Muka Pembelian', tipeAkun: 'aset_lancar_lain' },
  { kode: '1152', nama: 'Biaya Dibayar di Muka', tipeAkun: 'aset_lancar_lain' },

  // ASET TIDAK LANCAR
  { kode: '1201', nama: 'Tanah', tipeAkun: 'aset_tetap' },
  { kode: '1202', nama: 'Bangunan', tipeAkun: 'aset_tetap' },
  { kode: '1203', nama: 'Mesin Produksi', tipeAkun: 'aset_tetap' },
  { kode: '1204', nama: 'Peralatan Pabrik', tipeAkun: 'aset_tetap' },
  { kode: '1205', nama: 'Kendaraan', tipeAkun: 'aset_tetap' },
  { kode: '1206', nama: 'Peralatan Kantor', tipeAkun: 'aset_tetap' },
  { kode: '1211', nama: 'Akumulasi Depresiasi Bangunan', tipeAkun: 'aset_akumulasi_depresiasi' },
  { kode: '1212', nama: 'Akumulasi Depresiasi Mesin Produksi', tipeAkun: 'aset_akumulasi_depresiasi' },
  { kode: '1213', nama: 'Akumulasi Depresiasi Peralatan Pabrik', tipeAkun: 'aset_akumulasi_depresiasi' },
  { kode: '1214', nama: 'Akumulasi Depresiasi Kendaraan', tipeAkun: 'aset_akumulasi_depresiasi' },
  { kode: '1215', nama: 'Akumulasi Depresiasi Peralatan Kantor', tipeAkun: 'aset_akumulasi_depresiasi' },
  { kode: '1291', nama: 'Aset Tidak Lancar Lainnya', tipeAkun: 'aset_tidak_lancar_lain' },

  // LIABILITAS JANGKA PENDEK
  { kode: '2101', nama: 'Utang Usaha', tipeAkun: 'liabilitas_utang_usaha' },
  { kode: '2102', nama: 'Utang Lain-lain', tipeAkun: 'liabilitas_jangka_pendek' },
  { kode: '2111', nama: 'PPN Keluaran', tipeAkun: 'liabilitas_pajak' },
  { kode: '2112', nama: 'Utang PPh 21', tipeAkun: 'liabilitas_pajak' },
  { kode: '2113', nama: 'Utang PPh 23', tipeAkun: 'liabilitas_pajak' },
  { kode: '2114', nama: 'Utang PPh 29', tipeAkun: 'liabilitas_pajak' },
  { kode: '2115', nama: 'Utang PPh Final', tipeAkun: 'liabilitas_pajak' },
  { kode: '2121', nama: 'Utang Gaji', tipeAkun: 'liabilitas_jangka_pendek' },
  { kode: '2122', nama: 'Biaya yang Masih Harus Dibayar', tipeAkun: 'liabilitas_jangka_pendek' },
  { kode: '2131', nama: 'Uang Muka Penjualan', tipeAkun: 'liabilitas_jangka_pendek' },
  { kode: '2141', nama: 'Utang Bank Jangka Pendek', tipeAkun: 'liabilitas_jangka_pendek' },

  // LIABILITAS JANGKA PANJANG
  { kode: '2201', nama: 'Utang Bank Jangka Panjang', tipeAkun: 'liabilitas_jangka_panjang' },
  { kode: '2202', nama: 'Utang Sewa Pembiayaan', tipeAkun: 'liabilitas_jangka_panjang' },

  // EKUITAS
  { kode: '3101', nama: 'Modal Disetor', tipeAkun: 'ekuitas' },
  { kode: '3102', nama: 'Tambahan Modal Disetor', tipeAkun: 'ekuitas' },
  { kode: '3201', nama: 'Laba Ditahan', tipeAkun: 'ekuitas_laba_ditahan' },
  { kode: '3202', nama: 'Laba Tahun Berjalan', tipeAkun: 'ekuitas_laba_berjalan' },
  { kode: '3301', nama: 'Prive dan Dividen', tipeAkun: 'ekuitas' },

  // PENDAPATAN
  { kode: '4101', nama: 'Penjualan Furnitur', tipeAkun: 'pendapatan' },
  { kode: '4102', nama: 'Penjualan Jasa Custom', tipeAkun: 'pendapatan' },
  { kode: '4109', nama: 'Retur Penjualan', tipeAkun: 'pendapatan' },
  { kode: '4110', nama: 'Potongan Penjualan', tipeAkun: 'pendapatan' },
  { kode: '4201', nama: 'Pendapatan Bunga', tipeAkun: 'pendapatan_lain' },
  { kode: '4202', nama: 'Laba Selisih Kurs', tipeAkun: 'pendapatan_lain' },
  { kode: '4203', nama: 'Pendapatan Lain-lain', tipeAkun: 'pendapatan_lain' },

  // HARGA POKOK PENJUALAN
  { kode: '5101', nama: 'HPP Bahan Baku', tipeAkun: 'beban_hpp' },
  { kode: '5102', nama: 'HPP Tenaga Kerja Langsung', tipeAkun: 'beban_hpp' },
  { kode: '5103', nama: 'HPP Overhead Pabrik', tipeAkun: 'beban_hpp' },
  { kode: '5104', nama: 'HPP Barang Jadi', tipeAkun: 'beban_hpp' },
  { kode: '5105', nama: 'Selisih Persediaan', tipeAkun: 'beban_hpp' },
  { kode: '5106', nama: 'Kerugian Barang Rusak', tipeAkun: 'beban_hpp' },

  // BEBAN OPERASIONAL
  { kode: '6101', nama: 'Beban Gaji dan Upah', tipeAkun: 'beban_operasional' },
  { kode: '6102', nama: 'Beban Tunjangan Karyawan', tipeAkun: 'beban_operasional' },
  { kode: '6103', nama: 'Beban BPJS', tipeAkun: 'beban_operasional' },
  { kode: '6111', nama: 'Beban Listrik dan Air', tipeAkun: 'beban_operasional' },
  { kode: '6112', nama: 'Beban Telepon dan Internet', tipeAkun: 'beban_operasional' },
  { kode: '6113', nama: 'Beban Sewa', tipeAkun: 'beban_operasional' },
  { kode: '6114', nama: 'Beban Perbaikan dan Pemeliharaan', tipeAkun: 'beban_operasional' },
  { kode: '6121', nama: 'Beban Pengiriman', tipeAkun: 'beban_operasional' },
  { kode: '6122', nama: 'Beban Pemasaran dan Promosi', tipeAkun: 'beban_operasional' },
  { kode: '6123', nama: 'Beban Perjalanan Dinas', tipeAkun: 'beban_operasional' },
  { kode: '6131', nama: 'Beban Alat Tulis Kantor', tipeAkun: 'beban_operasional' },
  { kode: '6132', nama: 'Beban Asuransi', tipeAkun: 'beban_operasional' },
  { kode: '6133', nama: 'Beban Jasa Profesional', tipeAkun: 'beban_operasional' },
  { kode: '6141', nama: 'Beban Administrasi Bank', tipeAkun: 'beban_operasional' },
  { kode: '6151', nama: 'Beban Depresiasi Bangunan', tipeAkun: 'beban_depresiasi' },
  { kode: '6152', nama: 'Beban Depresiasi Mesin Produksi', tipeAkun: 'beban_depresiasi' },
  { kode: '6153', nama: 'Beban Depresiasi Peralatan Pabrik', tipeAkun: 'beban_depresiasi' },
  { kode: '6154', nama: 'Beban Depresiasi Kendaraan', tipeAkun: 'beban_depresiasi' },
  { kode: '6155', nama: 'Beban Depresiasi Peralatan Kantor', tipeAkun: 'beban_depresiasi' },

  // PENDAPATAN DAN BEBAN LAIN
  { kode: '7101', nama: 'Beban Bunga', tipeAkun: 'beban_lain' },
  { kode: '7102', nama: 'Rugi Selisih Kurs', tipeAkun: 'beban_lain' },
  { kode: '7103', nama: 'Beban Lain-lain', tipeAkun: 'beban_lain' },
  { kode: '7104', nama: 'Selisih Pembulatan', tipeAkun: 'beban_lain' },

  // PAJAK PENGHASILAN
  { kode: '8101', nama: 'Beban Pajak Penghasilan', tipeAkun: 'beban_pajak' },
] as const

export const AKUN_LABA_DITAHAN = '3201'
export const AKUN_SELISIH_KURS_UNTUNG = '4202'
export const AKUN_SELISIH_KURS_RUGI = '7102'
export const AKUN_PEMBULATAN = '7104'
