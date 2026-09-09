/**
 * Kategori aset memasangkan akun aset, akumulasi depresiasi, dan bebannya.
 * Tanah tidak disusutkan sehingga hanya punya akun asetnya sendiri.
 */
export const KATEGORI_ASET = [
  {
    kode: 'TNH', nama: 'Tanah',
    akunAset: '1201', akunAkumulasi: null, akunBeban: null,
    dapatDidepresiasi: false, metodeBawaan: 'garis_lurus', masaManfaatBulanBawaan: 12,
  },
  {
    kode: 'BGN', nama: 'Bangunan',
    akunAset: '1202', akunAkumulasi: '1211', akunBeban: '6151',
    dapatDidepresiasi: true, metodeBawaan: 'garis_lurus', masaManfaatBulanBawaan: 240,
  },
  {
    kode: 'MSN', nama: 'Mesin Produksi',
    akunAset: '1203', akunAkumulasi: '1212', akunBeban: '6152',
    dapatDidepresiasi: true, metodeBawaan: 'garis_lurus', masaManfaatBulanBawaan: 96,
  },
  {
    kode: 'PRL', nama: 'Peralatan Pabrik',
    akunAset: '1204', akunAkumulasi: '1213', akunBeban: '6153',
    dapatDidepresiasi: true, metodeBawaan: 'garis_lurus', masaManfaatBulanBawaan: 48,
  },
  {
    kode: 'KND', nama: 'Kendaraan',
    akunAset: '1205', akunAkumulasi: '1214', akunBeban: '6154',
    dapatDidepresiasi: true, metodeBawaan: 'saldo_menurun_ganda', masaManfaatBulanBawaan: 96,
  },
  {
    kode: 'KTR', nama: 'Peralatan Kantor',
    akunAset: '1206', akunAkumulasi: '1215', akunBeban: '6155',
    dapatDidepresiasi: true, metodeBawaan: 'garis_lurus', masaManfaatBulanBawaan: 48,
  },
] as const
