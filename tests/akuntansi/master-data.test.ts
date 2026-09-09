import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { accounts, partners, journals, sequences, sequencePeriods } from '@/db/schema'
import { buatAkun, ubahAkun, nonaktifkanAkun, daftarAkun } from '@/modules/akuntansi/layanan/akun'
import { skemaAkun, labelTipeAkun, KELOMPOK_TIPE_AKUN } from '@/modules/akuntansi/validasi/akun'
import {
  buatPartner, ubahPartner, nonaktifkanPartner, daftarPartner,
} from '@/modules/akuntansi/layanan/partner'
import { skemaPartner, normalkanNpwp } from '@/modules/akuntansi/validasi/partner'
import { hitungPajak, buatPajak, daftarPajak } from '@/modules/akuntansi/layanan/pajak'
import {
  buatSyaratPembayaran, daftarSyaratPembayaran, hitungJatuhTempo,
} from '@/modules/akuntansi/layanan/syarat-pembayaran'
import {
  buatJurnal, ubahJurnal, nonaktifkanJurnal, daftarJurnal, labelTipeJurnal,
} from '@/modules/akuntansi/layanan/jurnal'
import { ambilNomorBerikut } from '@/modules/akuntansi/layanan/urutan'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'

const SEMUA = ['journals', 'taxes', 'partners', 'payment_terms', 'sequences', 'accounts']

afterAll(async () => { await tutupKoneksi() })

// ── Bagan Akun ───────────────────────────────────────────────────────────────

const AKUN_KAS = {
  kode: '1101', nama: 'Kas', tipeAkun: 'aset_kas',
  mataUangId: null, dapatDirekonsiliasi: false, catatan: null,
}

describe('validasi akun', () => {
  it('menerima masukan yang sah', () => {
    expect(skemaAkun.safeParse(AKUN_KAS).success).toBe(true)
  })

  it('menolak kode kosong', () => {
    const hasil = skemaAkun.safeParse({ ...AKUN_KAS, kode: '' })
    expect(hasil.error!.issues[0].message).toBe('Kode akun wajib diisi')
  })

  it('menolak kode yang memuat spasi', () => {
    expect(skemaAkun.safeParse({ ...AKUN_KAS, kode: '11 01' }).success).toBe(false)
  })

  it('menolak nama kosong', () => {
    const hasil = skemaAkun.safeParse({ ...AKUN_KAS, nama: '   ' })
    expect(hasil.error!.issues[0].message).toBe('Nama akun wajib diisi')
  })

  it('menolak tipe akun di luar daftar', () => {
    expect(skemaAkun.safeParse({ ...AKUN_KAS, tipeAkun: 'aset_ajaib' }).success).toBe(false)
  })

  it('memangkas spasi di awal dan akhir', () => {
    const hasil = skemaAkun.parse({ ...AKUN_KAS, kode: ' 1101 ', nama: ' Kas ' })
    expect([hasil.kode, hasil.nama]).toEqual(['1101', 'Kas'])
  })
})

describe('label tipe akun', () => {
  it('memberi label berbahasa Indonesia untuk setiap tipe', () => {
    for (const tipe of KELOMPOK_TIPE_AKUN.flatMap((k) => k.tipe)) {
      expect(labelTipeAkun(tipe), `label hilang untuk ${tipe}`).not.toBe(tipe)
    }
  })

  it('mencakup dua puluh dua tipe akun dalam lima kelompok laporan', () => {
    expect(KELOMPOK_TIPE_AKUN.flatMap((k) => k.tipe)).toHaveLength(22)
    expect(KELOMPOK_TIPE_AKUN.map((k) => k.label)).toEqual([
      'Aset', 'Liabilitas', 'Ekuitas', 'Pendapatan', 'Beban',
    ])
  })
})

describe('layanan akun', () => {
  beforeEach(async () => { await bersihkanTabel(SEMUA) })

  it('menyimpan akun baru dalam keadaan aktif', async () => {
    const akun = await buatAkun(AKUN_KAS)
    expect(akun.kode).toBe('1101')
    expect(akun.isActive).toBe(true)
  })

  it('menolak kode yang sudah dipakai dengan pesan berbahasa Indonesia', async () => {
    await buatAkun(AKUN_KAS)
    await expect(buatAkun({ ...AKUN_KAS, nama: 'Kas Lain' }))
      .rejects.toThrow('Kode akun 1101 sudah digunakan')
  })

  it('menolak masukan yang tidak lolos validasi', async () => {
    await expect(buatAkun({ ...AKUN_KAS, kode: '' })).rejects.toThrow('Kode akun wajib diisi')
  })

  it('memperbarui nama dan tipe', async () => {
    const akun = await buatAkun(AKUN_KAS)
    const hasil = await ubahAkun(akun.id, { ...AKUN_KAS, nama: 'Kas Besar', tipeAkun: 'aset_bank' })
    expect([hasil.nama, hasil.tipeAkun]).toEqual(['Kas Besar', 'aset_bank'])
  })

  it('mengizinkan penyimpanan ulang dengan kode yang sama', async () => {
    const akun = await buatAkun(AKUN_KAS)
    await expect(ubahAkun(akun.id, { ...AKUN_KAS, nama: 'Kas Kecil' })).resolves.toBeTruthy()
  })

  it('menolak kode yang sudah dipakai akun lain', async () => {
    await buatAkun(AKUN_KAS)
    const bank = await buatAkun({ ...AKUN_KAS, kode: '1102', nama: 'Bank', tipeAkun: 'aset_bank' })
    await expect(ubahAkun(bank.id, { ...AKUN_KAS, kode: '1101' }))
      .rejects.toThrow('Kode akun 1101 sudah digunakan')
  })

  it('menolak akun yang tidak ada', async () => {
    await expect(ubahAkun('00000000-0000-0000-0000-000000000000', AKUN_KAS))
      .rejects.toThrow('Akun tidak ditemukan')
  })

  it('menandai akun nonaktif alih-alih menghapusnya', async () => {
    const akun = await buatAkun(AKUN_KAS)
    await nonaktifkanAkun(akun.id)
    const [tersimpan] = await db.select().from(accounts).where(eq(accounts.id, akun.id))
    expect(tersimpan).toBeDefined()
    expect(tersimpan.isActive).toBe(false)
  })

  it('mengurutkan daftar berdasarkan kode akun', async () => {
    await buatAkun({ ...AKUN_KAS, kode: '4101', nama: 'Penjualan', tipeAkun: 'pendapatan' })
    await buatAkun(AKUN_KAS)
    await buatAkun({ ...AKUN_KAS, kode: '1102', nama: 'Bank', tipeAkun: 'aset_bank' })
    expect((await daftarAkun()).map((a) => a.kode)).toEqual(['1101', '1102', '4101'])
  })

  it('tetap menyertakan akun nonaktif agar dapat diaktifkan kembali', async () => {
    const akun = await buatAkun(AKUN_KAS)
    await nonaktifkanAkun(akun.id)
    expect(await daftarAkun()).toHaveLength(1)
  })
})

// ── Mitra Usaha ──────────────────────────────────────────────────────────────

const PELANGGAN = {
  kode: 'CUST-001', nama: 'PT Mebel Sejahtera', tipe: 'badan' as const,
  isPelanggan: true, isPemasok: false,
  npwp: '01.234.567.8-901.000', nik: null,
  alamat: 'Jl. Industri No. 12', kota: 'Jepara', provinsi: 'Jawa Tengah', kodePos: '59411',
  telepon: '0291-123456', email: 'kontak@mebelsejahtera.co.id', kontakPerson: 'Budi',
  syaratPembayaranId: null, akunPiutangId: null, akunUtangId: null,
}

describe('normalkanNpwp', () => {
  it('membuang titik, strip, dan spasi', () => {
    expect(normalkanNpwp('01.234.567.8-901.000')).toBe('012345678901000')
  })

  it('membiarkan angka polos apa adanya', () => {
    expect(normalkanNpwp('012345678901000')).toBe('012345678901000')
  })

  it('mengembalikan teks kosong untuk masukan kosong', () => {
    expect(normalkanNpwp('')).toBe('')
  })
})

describe('validasi mitra usaha', () => {
  it('menerima masukan yang sah', () => {
    expect(skemaPartner.safeParse(PELANGGAN).success).toBe(true)
  })

  it('menyimpan NPWP dalam bentuk angka saja', () => {
    expect(skemaPartner.parse(PELANGGAN).npwp).toBe('012345678901000')
  })

  it('menerima NPWP enam belas digit', () => {
    expect(skemaPartner.safeParse({ ...PELANGGAN, npwp: '0123456789012345' }).success).toBe(true)
  })

  it('menolak NPWP yang panjangnya bukan lima belas atau enam belas digit', () => {
    const hasil = skemaPartner.safeParse({ ...PELANGGAN, npwp: '12345' })
    expect(hasil.error!.issues[0].message).toBe('NPWP harus 15 atau 16 digit')
  })

  it('menerima NPWP kosong karena tidak semua mitra ber-NPWP', () => {
    expect(skemaPartner.parse({ ...PELANGGAN, npwp: '' }).npwp).toBeNull()
  })

  it('menolak NIK yang bukan enam belas digit', () => {
    const hasil = skemaPartner.safeParse({ ...PELANGGAN, tipe: 'perorangan', nik: '123' })
    expect(hasil.error!.issues[0].message).toBe('NIK harus 16 digit')
  })

  it('menolak email yang tidak sah', () => {
    const hasil = skemaPartner.safeParse({ ...PELANGGAN, email: 'bukan-email' })
    expect(hasil.error!.issues[0].message).toBe('Format email tidak sah')
  })

  it('menerima email kosong', () => {
    expect(skemaPartner.safeParse({ ...PELANGGAN, email: '' }).success).toBe(true)
  })

  it('menolak mitra yang bukan pelanggan maupun pemasok', () => {
    const hasil = skemaPartner.safeParse({ ...PELANGGAN, isPelanggan: false, isPemasok: false })
    expect(hasil.error!.issues[0].message)
      .toBe('Mitra harus ditandai sebagai pelanggan, pemasok, atau keduanya')
  })

  it('menerima mitra yang sekaligus pelanggan dan pemasok', () => {
    expect(skemaPartner.safeParse({ ...PELANGGAN, isPemasok: true }).success).toBe(true)
  })
})

describe('layanan mitra usaha', () => {
  beforeEach(async () => { await bersihkanTabel(SEMUA) })

  it('menyimpan mitra baru', async () => {
    const mitra = await buatPartner(PELANGGAN)
    expect(mitra.kode).toBe('CUST-001')
    expect(mitra.isActive).toBe(true)
  })

  it('menolak kode ganda', async () => {
    await buatPartner(PELANGGAN)
    await expect(buatPartner({ ...PELANGGAN, nama: 'Lain' }))
      .rejects.toThrow('Kode mitra CUST-001 sudah digunakan')
  })

  it('memperbarui data mitra', async () => {
    const mitra = await buatPartner(PELANGGAN)
    expect((await ubahPartner(mitra.id, { ...PELANGGAN, kota: 'Semarang' })).kota).toBe('Semarang')
  })

  it('menolak kode milik mitra lain', async () => {
    await buatPartner(PELANGGAN)
    const lain = await buatPartner({ ...PELANGGAN, kode: 'CUST-002', nama: 'CV Kayu Jati' })
    await expect(ubahPartner(lain.id, { ...PELANGGAN, kode: 'CUST-001' }))
      .rejects.toThrow('Kode mitra CUST-001 sudah digunakan')
  })

  it('menolak mitra yang tidak ada', async () => {
    await expect(ubahPartner('00000000-0000-0000-0000-000000000000', PELANGGAN))
      .rejects.toThrow('Mitra tidak ditemukan')
  })

  it('menandai nonaktif alih-alih menghapus', async () => {
    const mitra = await buatPartner(PELANGGAN)
    await nonaktifkanPartner(mitra.id)
    const [tersimpan] = await db.select().from(partners).where(eq(partners.id, mitra.id))
    expect(tersimpan.isActive).toBe(false)
  })
})

describe('penyaringan mitra usaha', () => {
  beforeEach(async () => {
    await bersihkanTabel(SEMUA)
    await buatPartner(PELANGGAN)
    await buatPartner({
      ...PELANGGAN, kode: 'SUPP-001', nama: 'UD Kayu Nusantara',
      isPelanggan: false, isPemasok: true,
    })
    await buatPartner({
      ...PELANGGAN, kode: 'BOTH-001', nama: 'PT Dwifungsi',
      isPelanggan: true, isPemasok: true,
    })
  })

  it('mengembalikan seluruh mitra tanpa penyaringan', async () => {
    expect(await daftarPartner()).toHaveLength(3)
  })

  it('menyaring hanya pelanggan', async () => {
    expect((await daftarPartner({ peran: 'pelanggan' })).map((m) => m.kode).sort())
      .toEqual(['BOTH-001', 'CUST-001'])
  })

  it('menyaring hanya pemasok', async () => {
    expect((await daftarPartner({ peran: 'pemasok' })).map((m) => m.kode).sort())
      .toEqual(['BOTH-001', 'SUPP-001'])
  })

  it('mengurutkan berdasarkan nama', async () => {
    expect((await daftarPartner()).map((m) => m.nama)).toEqual([
      'PT Dwifungsi', 'PT Mebel Sejahtera', 'UD Kayu Nusantara',
    ])
  })
})

// ── Pajak ────────────────────────────────────────────────────────────────────

describe('hitungPajak — harga belum termasuk pajak', () => {
  it('menambahkan pajak di atas dasar pengenaan', () => {
    expect(hitungPajak('1000000', '11', false)).toEqual({ dasar: '1000000.00', pajak: '110000.00' })
  })

  it('membulatkan hasil ke dua desimal', () => {
    expect(hitungPajak('333333.33', '11', false)).toEqual({ dasar: '333333.33', pajak: '36666.67' })
  })

  it('menghasilkan pajak nol untuk tarif nol', () => {
    expect(hitungPajak('1000000', '0', false)).toEqual({ dasar: '1000000.00', pajak: '0.00' })
  })
})

describe('hitungPajak — harga sudah termasuk pajak', () => {
  it('memisahkan dasar pengenaan dari nilai bruto', () => {
    expect(hitungPajak('1110000', '11', true)).toEqual({ dasar: '1000000.00', pajak: '110000.00' })
  })

  it('menjaga penjumlahan dasar dan pajak tetap sama dengan nilai bruto', () => {
    for (const bruto of ['999999.99', '1110000', '1', '123456.78', '7777777.77']) {
      const { dasar, pajak } = hitungPajak(bruto, '11', true)
      const jumlah = (Number(dasar) + Number(pajak)).toFixed(2)
      expect(jumlah, `bruto ${bruto}`).toBe(Number(bruto).toFixed(2))
    }
  })

  it('mengembalikan nilai apa adanya untuk tarif nol', () => {
    expect(hitungPajak('1000000', '0', true)).toEqual({ dasar: '1000000.00', pajak: '0.00' })
  })
})

describe('layanan pajak', () => {
  let akunPajakId: string

  beforeEach(async () => {
    await bersihkanTabel(SEMUA)
    const [akun] = await db.insert(accounts).values({
      kode: '2103', nama: 'Utang PPN Keluaran', tipeAkun: 'liabilitas_pajak',
    }).returning()
    akunPajakId = akun.id
  })

  it('menyimpan pajak baru', async () => {
    const pajak = await buatPajak({
      kode: 'PPN-K-11', nama: 'PPN Keluaran 11%', ruangLingkup: 'penjualan',
      tarif: '11', hargaTermasukPajak: false, isPemotongan: false, akunPajakId,
    })
    expect(pajak.kode).toBe('PPN-K-11')
    expect(Number(pajak.tarif)).toBe(11)
  })

  it('menolak kode ganda', async () => {
    const masukan = {
      kode: 'PPN-K-11', nama: 'PPN Keluaran 11%', ruangLingkup: 'penjualan' as const,
      tarif: '11', hargaTermasukPajak: false, isPemotongan: false, akunPajakId,
    }
    await buatPajak(masukan)
    await expect(buatPajak(masukan)).rejects.toThrow('Kode pajak PPN-K-11 sudah digunakan')
  })

  it('menolak tarif negatif dan di atas seratus persen', async () => {
    const dasar = {
      kode: 'X', nama: 'X', ruangLingkup: 'penjualan' as const,
      hargaTermasukPajak: false, isPemotongan: false, akunPajakId,
    }
    await expect(buatPajak({ ...dasar, tarif: '-1' })).rejects.toThrow('Tarif tidak boleh negatif')
    await expect(buatPajak({ ...dasar, tarif: '101' })).rejects.toThrow('Tarif maksimal 100 persen')
  })

  it('menyaring berdasarkan ruang lingkup', async () => {
    await buatPajak({
      kode: 'PPN-K-11', nama: 'PPN Keluaran', ruangLingkup: 'penjualan',
      tarif: '11', hargaTermasukPajak: false, isPemotongan: false, akunPajakId,
    })
    await buatPajak({
      kode: 'PPN-M-11', nama: 'PPN Masukan', ruangLingkup: 'pembelian',
      tarif: '11', hargaTermasukPajak: false, isPemotongan: false, akunPajakId,
    })
    expect(await daftarPajak('penjualan')).toHaveLength(1)
    expect(await daftarPajak()).toHaveLength(2)
  })
})

// ── Syarat Pembayaran ────────────────────────────────────────────────────────

describe('syarat pembayaran', () => {
  beforeEach(async () => { await bersihkanTabel(SEMUA) })

  it('menyimpan syarat baru', async () => {
    expect((await buatSyaratPembayaran({ nama: 'Net 30', jumlahHari: 30, catatan: null })).jumlahHari)
      .toBe(30)
  })

  it('menolak nama ganda', async () => {
    await buatSyaratPembayaran({ nama: 'Tunai', jumlahHari: 0, catatan: null })
    await expect(buatSyaratPembayaran({ nama: 'Tunai', jumlahHari: 0, catatan: null }))
      .rejects.toThrow('Syarat pembayaran Tunai sudah ada')
  })

  it('menolak jumlah hari negatif', async () => {
    await expect(buatSyaratPembayaran({ nama: 'Aneh', jumlahHari: -5, catatan: null }))
      .rejects.toThrow('Jumlah hari tidak boleh negatif')
  })

  it('mengurutkan berdasarkan jumlah hari', async () => {
    await buatSyaratPembayaran({ nama: 'Net 60', jumlahHari: 60, catatan: null })
    await buatSyaratPembayaran({ nama: 'Tunai', jumlahHari: 0, catatan: null })
    await buatSyaratPembayaran({ nama: 'Net 30', jumlahHari: 30, catatan: null })
    expect((await daftarSyaratPembayaran()).map((s) => s.nama)).toEqual(['Tunai', 'Net 30', 'Net 60'])
  })
})

describe('hitungJatuhTempo', () => {
  it('menambahkan jumlah hari ke tanggal faktur', () => {
    expect(hitungJatuhTempo(new Date('2026-09-08T00:00:00Z'), 30).toISOString().slice(0, 10))
      .toBe('2026-10-08')
  })

  it('mengembalikan tanggal yang sama untuk pembayaran tunai', () => {
    expect(hitungJatuhTempo(new Date('2026-09-08T00:00:00Z'), 0).toISOString().slice(0, 10))
      .toBe('2026-09-08')
  })

  it('melintasi pergantian bulan dan tahun dengan benar', () => {
    expect(hitungJatuhTempo(new Date('2026-12-20T00:00:00Z'), 30).toISOString().slice(0, 10))
      .toBe('2027-01-19')
  })
})

// ── Jurnal ───────────────────────────────────────────────────────────────────

const JURNAL_UMUM = {
  kode: 'JU', nama: 'Jurnal Umum', tipe: 'umum' as const,
  prefixNomor: 'JU', resetNomor: 'bulanan' as const,
  akunDefaultDebitId: null, akunDefaultKreditId: null, mataUangId: null,
}

describe('label tipe jurnal', () => {
  it('memberi label berbahasa Indonesia', () => {
    expect([
      labelTipeJurnal('penjualan'), labelTipeJurnal('pembelian'),
      labelTipeJurnal('kas'), labelTipeJurnal('bank'), labelTipeJurnal('umum'),
    ]).toEqual(['Penjualan', 'Pembelian', 'Kas', 'Bank', 'Umum'])
  })
})

describe('layanan jurnal', () => {
  beforeEach(async () => { await bersihkanTabel(SEMUA) })

  it('membuat jurnal beserta urutan penomorannya', async () => {
    const jurnal = await buatJurnal(JURNAL_UMUM)
    const [urutan] = await db.select().from(sequences).where(eq(sequences.id, jurnal.sequenceId))
    expect(urutan.kode).toBe('jurnal:JU')
    expect(urutan.prefix).toBe('JU')
    expect(urutan.reset).toBe('bulanan')
    expect(urutan.nomorBerikut).toBe(1)
  })

  it('menghasilkan urutan yang langsung dapat dipakai', async () => {
    await buatJurnal(JURNAL_UMUM)
    const nomor = await db.transaction((tx) =>
      ambilNomorBerikut(tx, 'jurnal:JU', new Date('2026-09-08T00:00:00Z')),
    )
    expect(nomor).toBe('JU/2026/09/0001')
  })

  it('menolak kode jurnal ganda', async () => {
    await buatJurnal(JURNAL_UMUM)
    await expect(buatJurnal({ ...JURNAL_UMUM, nama: 'Jurnal Lain' }))
      .rejects.toThrow('Kode jurnal JU sudah digunakan')
  })

  it('tidak meninggalkan urutan yatim saat pembuatan jurnal gagal', async () => {
    await buatJurnal(JURNAL_UMUM)
    await expect(buatJurnal({ ...JURNAL_UMUM, nama: 'Duplikat' })).rejects.toThrow()
    expect((await db.select().from(sequences)).map((u) => u.kode)).toEqual(['jurnal:JU'])
  })

  it('menolak kode jurnal kosong dan tipe di luar daftar', async () => {
    await expect(buatJurnal({ ...JURNAL_UMUM, kode: '' })).rejects.toThrow('Kode jurnal wajib diisi')
    await expect(buatJurnal({ ...JURNAL_UMUM, tipe: 'aneh' as never }))
      .rejects.toThrow('Tipe jurnal tidak dikenali')
  })

  it('memperbarui nama jurnal', async () => {
    const jurnal = await buatJurnal(JURNAL_UMUM)
    expect((await ubahJurnal(jurnal.id, { ...JURNAL_UMUM, nama: 'Jurnal Memorial' })).nama)
      .toBe('Jurnal Memorial')
  })

  it('tidak mengubah urutan yang sudah terpakai saat kode jurnal diubah', async () => {
    const jurnal = await buatJurnal(JURNAL_UMUM)
    await db.transaction((tx) => ambilNomorBerikut(tx, 'jurnal:JU', new Date('2026-09-08T00:00:00Z')))
    await ubahJurnal(jurnal.id, { ...JURNAL_UMUM, kode: 'JUM' })
    const [urutan] = await db.select().from(sequences).where(eq(sequences.id, jurnal.sequenceId))
    expect(urutan.kode).toBe('jurnal:JU')

    // Pencacahnya ada di periode, bukan di definisi urutan.
    const [periode] = await db.select().from(sequencePeriods)
      .where(eq(sequencePeriods.sequenceId, jurnal.sequenceId))
    expect(periode.nomorBerikut).toBe(2)
  })

  it('menolak jurnal yang tidak ada', async () => {
    await expect(ubahJurnal('00000000-0000-0000-0000-000000000000', JURNAL_UMUM))
      .rejects.toThrow('Jurnal tidak ditemukan')
  })

  it('menyaring berdasarkan tipe dan mengurutkan berdasarkan kode', async () => {
    await buatJurnal({
      ...JURNAL_UMUM, kode: 'PNJ', nama: 'Jurnal Penjualan',
      tipe: 'penjualan', prefixNomor: 'FJ',
    })
    await buatJurnal(JURNAL_UMUM)
    expect(await daftarJurnal('penjualan')).toHaveLength(1)
    expect((await daftarJurnal()).map((j) => j.kode)).toEqual(['JU', 'PNJ'])
  })

  it('menandai nonaktif alih-alih menghapus', async () => {
    const jurnal = await buatJurnal(JURNAL_UMUM)
    await nonaktifkanJurnal(jurnal.id)
    const [tersimpan] = await db.select().from(journals).where(eq(journals.id, jurnal.id))
    expect(tersimpan.isActive).toBe(false)
  })
})
