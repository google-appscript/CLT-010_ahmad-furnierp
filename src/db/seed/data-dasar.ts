export const MATA_UANG = [
  { kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 },
  { kode: 'USD', nama: 'Dolar Amerika Serikat', simbol: '$', desimal: 2 },
  { kode: 'EUR', nama: 'Euro', simbol: '€', desimal: 2 },
]

/** Kurs contoh; perbarui lewat menu Mata Uang & Kurs sesuai kurs yang berlaku. */
export const KURS_CONTOH = [
  { kodeMataUang: 'USD', tanggal: '2026-01-01', kurs: '16250' },
  { kodeMataUang: 'EUR', tanggal: '2026-01-01', kurs: '17600' },
]

export const SYARAT_PEMBAYARAN = [
  { nama: 'Tunai', jumlahHari: 0, catatan: 'Dibayar saat penyerahan' },
  { nama: 'Net 14', jumlahHari: 14, catatan: null },
  { nama: 'Net 30', jumlahHari: 30, catatan: null },
  { nama: 'Net 60', jumlahHari: 60, catatan: null },
]

export const JURNAL_STANDAR = [
  { kode: 'PNJ', nama: 'Jurnal Penjualan', tipe: 'penjualan', prefixNomor: 'FJ', resetNomor: 'bulanan' },
  { kode: 'PMB', nama: 'Jurnal Pembelian', tipe: 'pembelian', prefixNomor: 'FB', resetNomor: 'bulanan' },
  { kode: 'KAS', nama: 'Jurnal Kas', tipe: 'kas', prefixNomor: 'BK', resetNomor: 'bulanan' },
  { kode: 'BNK', nama: 'Jurnal Bank', tipe: 'bank', prefixNomor: 'BB', resetNomor: 'bulanan' },
  { kode: 'JU', nama: 'Jurnal Umum', tipe: 'umum', prefixNomor: 'JU', resetNomor: 'bulanan' },
  { kode: 'JPS', nama: 'Jurnal Penyesuaian Persediaan', tipe: 'umum', prefixNomor: 'JPS', resetNomor: 'bulanan' },
] as const

/**
 * Tarif berlaku saat seed disusun dan dapat diubah lewat menu Pajak tanpa
 * penerapan ulang bila regulasi berubah.
 */
export const PAJAK_STANDAR = [
  {
    kode: 'PPN-K-11', nama: 'PPN Keluaran 11%', ruangLingkup: 'penjualan',
    tarif: '11', hargaTermasukPajak: false, isPemotongan: false, kodeAkun: '2111',
  },
  {
    kode: 'PPN-M-11', nama: 'PPN Masukan 11%', ruangLingkup: 'pembelian',
    tarif: '11', hargaTermasukPajak: false, isPemotongan: false, kodeAkun: '1141',
  },
  {
    kode: 'PPH23-2', nama: 'PPh 23 Jasa 2%', ruangLingkup: 'pembelian',
    tarif: '2', hargaTermasukPajak: false, isPemotongan: true, kodeAkun: '2113',
  },
  {
    kode: 'PPHF-05', nama: 'PPh Final 0,5%', ruangLingkup: 'penjualan',
    tarif: '0.5', hargaTermasukPajak: false, isPemotongan: true, kodeAkun: '2115',
  },
] as const
