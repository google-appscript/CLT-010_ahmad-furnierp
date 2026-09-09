/** Satuan dasar berfaktor 1; satuan lain diukur relatif terhadapnya. */
export const SATUAN = [
  { kode: 'UNIT', nama: 'Unit', kategori: 'satuan', faktor: '1' },
  { kode: 'LSN', nama: 'Lusin', kategori: 'satuan', faktor: '12' },
  { kode: 'KODI', nama: 'Kodi', kategori: 'satuan', faktor: '20' },
  { kode: 'SET', nama: 'Set', kategori: 'satuan', faktor: '1' },
  { kode: 'KG', nama: 'Kilogram', kategori: 'berat', faktor: '1' },
  { kode: 'GR', nama: 'Gram', kategori: 'berat', faktor: '0.001' },
  { kode: 'TON', nama: 'Ton', kategori: 'berat', faktor: '1000' },
  { kode: 'M', nama: 'Meter', kategori: 'panjang', faktor: '1' },
  { kode: 'CM', nama: 'Sentimeter', kategori: 'panjang', faktor: '0.01' },
  { kode: 'M2', nama: 'Meter Persegi', kategori: 'luas', faktor: '1' },
  { kode: 'M3', nama: 'Meter Kubik', kategori: 'volume', faktor: '1' },
  { kode: 'LTR', nama: 'Liter', kategori: 'volume', faktor: '0.001' },
] as const

/**
 * Kategori menentukan akun yang dipakai saat pergerakan stok memposting
 * jurnal, sehingga menambah produk baru tidak memerlukan konfigurasi
 * akuntansi tambahan.
 */
export const KATEGORI_PRODUK = [
  {
    kode: 'BB', nama: 'Bahan Baku',
    akunPersediaan: '1131', akunHpp: '5101', akunSelisih: '5105', akunBarangRusak: '5106',
  },
  {
    kode: 'BP', nama: 'Bahan Penolong',
    akunPersediaan: '1132', akunHpp: '5101', akunSelisih: '5105', akunBarangRusak: '5106',
  },
  {
    kode: 'BDP', nama: 'Barang Dalam Proses',
    akunPersediaan: '1133', akunHpp: '5104', akunSelisih: '5105', akunBarangRusak: '5106',
  },
  {
    kode: 'BJ', nama: 'Barang Jadi',
    akunPersediaan: '1134', akunHpp: '5104', akunSelisih: '5105', akunBarangRusak: '5106',
  },
  {
    kode: 'SC', nama: 'Suku Cadang',
    akunPersediaan: '1135', akunHpp: '5103', akunSelisih: '5105', akunBarangRusak: '5106',
  },
] as const

export const GUDANG = { kode: 'GU', nama: 'Gudang Utama', alamat: 'Jepara, Jawa Tengah' }

/**
 * Lokasi virtual membuat seluruh operasi memakai satu mekanisme yang sama:
 * setiap pergerakan selalu antara dua lokasi, dan yang membedakan jenis
 * operasi hanyalah lokasi virtual mana yang berada di seberang gudang.
 */
export const LOKASI = [
  { kode: 'GU/BB', nama: 'Gudang Bahan Baku', tipe: 'internal', diGudang: true },
  { kode: 'GU/BDP', nama: 'Gudang Barang Dalam Proses', tipe: 'internal', diGudang: true },
  { kode: 'GU/BJ', nama: 'Gudang Barang Jadi', tipe: 'internal', diGudang: true },
  { kode: 'VIR/PEMASOK', nama: 'Pemasok', tipe: 'pemasok', diGudang: false },
  { kode: 'VIR/PELANGGAN', nama: 'Pelanggan', tipe: 'pelanggan', diGudang: false },
  { kode: 'VIR/PENYESUAIAN', nama: 'Penyesuaian Persediaan', tipe: 'penyesuaian', diGudang: false },
  { kode: 'VIR/RUSAK', nama: 'Barang Rusak', tipe: 'rusak', diGudang: false },
  { kode: 'VIR/PRODUKSI', nama: 'Produksi', tipe: 'produksi', diGudang: false },
] as const

export const URUTAN_GUDANG = [
  { kode: 'gudang:penerimaan', prefix: 'GRN', reset: 'bulanan' },
  { kode: 'gudang:pengiriman', prefix: 'DO', reset: 'bulanan' },
  { kode: 'gudang:transfer', prefix: 'TRF', reset: 'bulanan' },
  { kode: 'gudang:barang-rusak', prefix: 'SCR', reset: 'bulanan' },
  { kode: 'gudang:opname', prefix: 'OPN', reset: 'bulanan' },
  { kode: 'gudang:packing-list', prefix: 'PL', reset: 'bulanan' },
] as const

/** Produk contoh untuk manufaktur furnitur. */
export const PRODUK_CONTOH = [
  { kode: 'BB-KYU-JT', nama: 'Kayu Jati Papan 2x20x200 cm', kategori: 'BB', satuan: 'UNIT', hargaJual: '0' },
  { kode: 'BB-KYU-MH', nama: 'Kayu Mahoni Papan 2x20x200 cm', kategori: 'BB', satuan: 'UNIT', hargaJual: '0' },
  { kode: 'BB-PLY-18', nama: 'Plywood 18 mm', kategori: 'BB', satuan: 'M2', hargaJual: '0' },
  { kode: 'BP-LEM-PU', nama: 'Lem Polyurethane', kategori: 'BP', satuan: 'KG', hargaJual: '0' },
  { kode: 'BP-CAT-NC', nama: 'Cat Nitrocellulose', kategori: 'BP', satuan: 'LTR', hargaJual: '0' },
  { kode: 'SC-SKR-30', nama: 'Sekrup Kayu 30 mm', kategori: 'SC', satuan: 'UNIT', hargaJual: '0' },
  { kode: 'BJ-KRS-MKN', nama: 'Kursi Makan Jati', kategori: 'BJ', satuan: 'UNIT', hargaJual: '1850000' },
  { kode: 'BJ-MJA-MKN', nama: 'Meja Makan Jati 180 cm', kategori: 'BJ', satuan: 'UNIT', hargaJual: '7500000' },
  { kode: 'BJ-LMR-2P', nama: 'Lemari Pakaian 2 Pintu', kategori: 'BJ', satuan: 'UNIT', hargaJual: '5250000' },
] as const
