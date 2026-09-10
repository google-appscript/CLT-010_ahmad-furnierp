import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  users, accounts, journals, sequences, companySettings, currencies,
  uoms, productCategories, products, warehouses, locations, partners, taxes,
} from '@/db/schema'
import { buatPesanan, konfirmasiPesanan } from '@/modules/penjualan/layanan/pesanan'
import { kirimDariPesanan } from '@/modules/penjualan/layanan/pengiriman'
import { buatFaktur, postingFaktur } from '@/modules/penjualan/layanan/faktur'
import { buatOperasi, selesaikanOperasi } from '@/modules/gudang/layanan/operasi'
import { postingJurnal } from '@/modules/akuntansi/layanan/entri'
import {
  buatProyek, ubahProyek, mulaiProyek, selesaikanProyek, batalkanProyek,
  hapusProyek, ambilProyek, daftarProyek, proyekUntukPesanan, pesananTanpaProyek,
} from '@/modules/proyek/layanan/proyek'
import {
  buatTugas, ubahStatusTugas, hapusTugas, daftarTugas,
} from '@/modules/proyek/layanan/tugas'
import {
  catatTimesheet, hapusTimesheet, daftarTimesheet, rekapTimesheetProyek,
} from '@/modules/proyek/layanan/timesheet'
import { profitabilitasProyek } from '@/modules/proyek/layanan/laporan'
import {
  kunciProyek, bukaKunciProyek, kesiapanKunci,
} from '@/modules/proyek/layanan/penguncian'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'
import { seedPemetaanJurnal } from '../bantuan/pemetaan'

const TABEL = [
  'timesheets', 'project_tasks', 'projects',
  'customer_payment_allocations', 'customer_payments',
  'customer_invoice_lines', 'customer_invoices',
  'sales_order_lines', 'sales_orders',
  'stock_moves', 'stock_operation_lines', 'stock_operations',
  'products', 'product_categories', 'uoms', 'locations', 'warehouses',
  'journal_items', 'journal_entries', 'reconciliations', 'journal_mappings', 'journals', 'sequences',
  'company_settings', 'accounts', 'currency_rates', 'currencies',
  'audit_logs', 'user_roles', 'users', 'partners', 'payment_terms', 'taxes',
]

let penggunaId: string
let pelangganId: string
let produkId: string
let lokasiGudangId: string
let lokasiPemasokId: string
let satuanUnitId: string
let pajakPpnId: string
const akun: Record<string, string> = {}

beforeEach(async () => {
  await bersihkanTabel(TABEL)
  await db.insert(currencies).values({ kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 })

  const dibuatAkun = await db.insert(accounts).values([
    { kode: '1101', nama: 'Kas', tipeAkun: 'aset_kas' },
    { kode: '1121', nama: 'Piutang Usaha', tipeAkun: 'aset_piutang', dapatDirekonsiliasi: true },
    { kode: '1134', nama: 'Persediaan Barang Jadi', tipeAkun: 'aset_persediaan' },
    { kode: '2111', nama: 'PPN Keluaran', tipeAkun: 'liabilitas_pajak' },
    { kode: '2151', nama: 'Penerimaan Barang Belum Ditagih', tipeAkun: 'liabilitas_jangka_pendek' },
    { kode: '4101', nama: 'Penjualan Furnitur', tipeAkun: 'pendapatan' },
    { kode: '5104', nama: 'HPP Barang Jadi', tipeAkun: 'beban_hpp' },
    { kode: '5105', nama: 'Selisih Persediaan', tipeAkun: 'beban_hpp' },
    { kode: '5106', nama: 'Kerugian Barang Rusak', tipeAkun: 'beban_hpp' },
    { kode: '6101', nama: 'Beban Angkut', tipeAkun: 'beban_operasional' },
  ]).returning()
  for (const a of dibuatAkun) akun[a.kode] = a.id

  await db.insert(companySettings).values({
    nama: 'PT Uji', akunPenerimaanBelumDitagihId: akun['2151'],
  })

  const dibuatPengguna = await db.insert(users).values([
    { email: 'manajer@uji.id', nama: 'Manajer Proyek', passwordHash: 'x' },
    { email: 'tukang@uji.id', nama: 'Tukang Kayu', passwordHash: 'x' },
  ]).returning()
  penggunaId = dibuatPengguna[0].id

  const dibuatUrutan = await db.insert(sequences).values([
    { kode: 'jurnal:JPS', prefix: 'JPS', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'jurnal:PNJ', prefix: 'FJ', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'jurnal:JU', prefix: 'JU', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'gudang:penerimaan', prefix: 'GRN', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'gudang:pengiriman', prefix: 'DO', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'penjualan:pesanan', prefix: 'SO', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'penjualan:faktur', prefix: 'FJ', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'penjualan:nota-kredit', prefix: 'NK', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'penjualan:pembayaran', prefix: 'BKM', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
    { kode: 'jurnal:KAS', prefix: 'BK', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan' },
  ]).returning()
  const urutan = new Map(dibuatUrutan.map((u) => [u.kode, u.id]))

  await db.insert(journals).values([
    { kode: 'JPS', nama: 'Jurnal Penyesuaian Persediaan', tipe: 'umum', sequenceId: urutan.get('jurnal:JPS')! },
    { kode: 'PNJ', nama: 'Jurnal Penjualan', tipe: 'penjualan', sequenceId: urutan.get('jurnal:PNJ')! },
    { kode: 'JU', nama: 'Jurnal Umum', tipe: 'umum', sequenceId: urutan.get('jurnal:JU')! },
    { kode: 'KAS', nama: 'Jurnal Kas', tipe: 'kas', sequenceId: urutan.get('jurnal:KAS')! },
  ])
  await seedPemetaanJurnal()

  const [satuan] = await db.insert(uoms).values({
    kode: 'UNIT', nama: 'Unit', kategori: 'satuan', faktor: '1',
  }).returning()
  satuanUnitId = satuan.id

  const [kategori] = await db.insert(productCategories).values({
    kode: 'BJ', nama: 'Barang Jadi',
    akunPersediaanId: akun['1134'], akunHppId: akun['5104'],
    akunSelisihId: akun['5105'], akunBarangRusakId: akun['5106'],
  }).returning()

  const [produk] = await db.insert(products).values({
    kode: 'BJ-KURSI', nama: 'Kursi Makan Jati', kategoriId: kategori.id, uomId: satuan.id,
    hargaJual: '2000000',
  }).returning()
  produkId = produk.id

  const [gudang] = await db.insert(warehouses).values({ kode: 'GU', nama: 'Gudang Utama' }).returning()
  const dibuatLokasi = await db.insert(locations).values([
    { kode: 'GU/BJ', nama: 'Gudang Barang Jadi', tipe: 'internal', warehouseId: gudang.id },
    { kode: 'VIR/PEMASOK', nama: 'Pemasok', tipe: 'pemasok' },
    { kode: 'VIR/PELANGGAN', nama: 'Pelanggan', tipe: 'pelanggan' },
  ]).returning()
  lokasiGudangId = dibuatLokasi[0].id
  lokasiPemasokId = dibuatLokasi[1].id

  const [pelanggan] = await db.insert(partners).values({
    kode: 'CUST-001', nama: 'PT Mebel Sejahtera', isPelanggan: true,
  }).returning()
  pelangganId = pelanggan.id

  const [pajak] = await db.insert(taxes).values({
    kode: 'PPN-K-11', nama: 'PPN Keluaran 11%', ruangLingkup: 'penjualan',
    tarif: '11', hargaTermasukPajak: false, isPemotongan: false, akunPajakId: akun['2111'],
  }).returning()
  pajakPpnId = pajak.id
})

afterAll(async () => { await tutupKoneksi() })

// ── Pembantu ─────────────────────────────────────────────────────────────────

async function sediakanStok(kuantitas = '20', harga = '1200000') {
  const op = await buatOperasi({
    tipe: 'penerimaan', tanggal: '2026-01-05',
    lokasiAsalId: lokasiPemasokId, lokasiTujuanId: lokasiGudangId,
    partnerId: null, referensi: null, catatan: null,
    baris: [{ produkId, kuantitas, uomId: satuanUnitId, hargaSatuan: harga, catatan: null }],
  }, penggunaId)
  await selesaikanOperasi(op.id, penggunaId)
}

async function pesananDikonfirmasi(kuantitas = '10') {
  const pesanan = await buatPesanan({
    partnerId: pelangganId, tanggal: '2026-02-01', tanggalPengiriman: null,
    lokasiAsalId: lokasiGudangId, syaratPembayaranId: null, mataUangId: 'IDR',
    referensi: null, catatan: null,
    baris: [{
      produkId, deskripsi: 'Kursi Makan Jati', kuantitas,
      uomId: satuanUnitId, hargaSatuan: '2000000', taxId: pajakPpnId,
    }],
  }, penggunaId)
  return konfirmasiPesanan(pesanan.id, penggunaId)
}

function isiProyek(soId: string, ubah: Record<string, unknown> = {}) {
  return {
    kode: 'PRJ-001',
    nama: 'Pengadaan Kursi Kantor Cabang',
    soId,
    tanggalMulai: '2026-02-01',
    tanggalTarget: '2026-04-30',
    manajerId: penggunaId,
    tarifPerJam: '75000',
    catatan: null,
    ...ubah,
  }
}

// ── Proyek ───────────────────────────────────────────────────────────────────

describe('proyek', () => {
  it('proyek baru berstatus draft dan mewarisi pelanggan pesanannya', async () => {
    const so = await pesananDikonfirmasi()
    const proyek = await buatProyek(isiProyek(so.id), penggunaId)

    expect(proyek.status).toBe('draft')
    expect(proyek.soId).toBe(so.id)
    expect(proyek.partnerId).toBe(pelangganId)
  })

  it('satu pesanan penjualan hanya boleh dipegang satu proyek', async () => {
    const so = await pesananDikonfirmasi()
    await buatProyek(isiProyek(so.id), penggunaId)

    await expect(buatProyek(isiProyek(so.id, { kode: 'PRJ-002' }), penggunaId))
      .rejects.toThrow(/hanya boleh dipegang satu proyek/)
  })

  it('menolak pesanan yang masih berupa penawaran', async () => {
    const penawaran = await buatPesanan({
      partnerId: pelangganId, tanggal: '2026-02-01', tanggalPengiriman: null,
      lokasiAsalId: lokasiGudangId, syaratPembayaranId: null, mataUangId: 'IDR',
      referensi: null, catatan: null,
      baris: [{
        produkId, deskripsi: 'Kursi', kuantitas: '1',
        uomId: satuanUnitId, hargaSatuan: '2000000', taxId: null,
      }],
    }, penggunaId)

    await expect(buatProyek(isiProyek(penawaran.id), penggunaId))
      .rejects.toThrow(/konfirmasikan dulu/)
  })

  it('menolak target selesai yang mendahului tanggal mulai', async () => {
    const so = await pesananDikonfirmasi()
    await expect(buatProyek(isiProyek(so.id, { tanggalTarget: '2026-01-01' }), penggunaId))
      .rejects.toThrow(/mendahului tanggal mulai/)
  })

  it('memulai proyek mengubah statusnya menjadi berjalan', async () => {
    const so = await pesananDikonfirmasi()
    const proyek = await buatProyek(isiProyek(so.id), penggunaId)
    const berjalan = await mulaiProyek(proyek.id)

    expect(berjalan.status).toBe('berjalan')
    await expect(mulaiProyek(proyek.id)).rejects.toThrow(/sudah dimulai/)
  })

  it('proyek dapat ditemukan lewat pesanannya', async () => {
    const so = await pesananDikonfirmasi()
    const proyek = await buatProyek(isiProyek(so.id), penggunaId)
    expect((await proyekUntukPesanan(so.id))!.id).toBe(proyek.id)
  })

  it('pesanan yang sudah dipegang tidak ditawarkan lagi', async () => {
    const so = await pesananDikonfirmasi()
    expect((await pesananTanpaProyek()).map((s) => s.id)).toContain(so.id)

    await buatProyek(isiProyek(so.id), penggunaId)
    expect((await pesananTanpaProyek()).map((s) => s.id)).not.toContain(so.id)
    // Kecuali saat proyek itu sendiri sedang dibuka untuk diubah.
    expect((await pesananTanpaProyek(so.id)).map((s) => s.id)).toContain(so.id)
  })

  it('draft dapat diubah dan dihapus', async () => {
    const so = await pesananDikonfirmasi()
    const proyek = await buatProyek(isiProyek(so.id), penggunaId)

    const diubah = await ubahProyek(proyek.id, isiProyek(so.id, { nama: 'Nama Baru' }))
    expect(diubah.nama).toBe('Nama Baru')

    await hapusProyek(proyek.id)
    expect(await ambilProyek(proyek.id)).toBeNull()
  })

  it('proyek yang sudah berjalan dibatalkan, tidak dihapus', async () => {
    const so = await pesananDikonfirmasi()
    const proyek = await buatProyek(isiProyek(so.id), penggunaId)
    await mulaiProyek(proyek.id)

    await expect(hapusProyek(proyek.id)).rejects.toThrow(/berstatus draft/)
    expect((await batalkanProyek(proyek.id)).status).toBe('dibatalkan')
  })

  it('menolak menghapus proyek yang sudah menjadi penanda item jurnal', async () => {
    const so = await pesananDikonfirmasi()
    const proyek = await buatProyek(isiProyek(so.id), penggunaId)

    const [jurnal] = await db.select().from(journals).where(eq(journals.kode, 'JU'))
    await postingJurnal({
      journalId: jurnal.id, tanggal: '2026-02-10', referensi: null,
      keterangan: 'Beban angkut proyek', mataUangId: 'IDR', partnerId: null,
      sumberTipe: 'uji', sumberId: crypto.randomUUID(),
      item: [
        {
          accountId: akun['6101'], partnerId: null, label: 'Angkut',
          debit: '500000', kredit: '0',
          nilaiMataUang: null, taxId: null, projectId: proyek.id,
        },
        {
          accountId: akun['1101'], partnerId: null, label: 'Angkut',
          debit: '0', kredit: '500000',
          nilaiMataUang: null, taxId: null, projectId: null,
        },
      ],
    }, penggunaId)

    await expect(hapusProyek(proyek.id)).rejects.toThrow(/penanda pada item jurnal/)
  })

  it('daftar proyek dapat disaring menurut status', async () => {
    const a = await pesananDikonfirmasi()
    const proyek = await buatProyek(isiProyek(a.id), penggunaId)
    await mulaiProyek(proyek.id)

    expect(await daftarProyek({ status: 'berjalan' })).toHaveLength(1)
    expect(await daftarProyek({ status: 'draft' })).toHaveLength(0)
  })
})

// ── Tugas ────────────────────────────────────────────────────────────────────

describe('tugas proyek', () => {
  async function proyekBerjalan() {
    const so = await pesananDikonfirmasi()
    const proyek = await buatProyek(isiProyek(so.id), penggunaId)
    return mulaiProyek(proyek.id)
  }

  it('tugas bernomor urut dalam proyeknya', async () => {
    const proyek = await proyekBerjalan()
    const a = await buatTugas({
      proyekId: proyek.id, nama: 'Potong kayu', deskripsi: null,
      penanggungJawabId: null, tanggalMulai: null, tenggat: null, estimasiJam: '16',
    })
    const b = await buatTugas({
      proyekId: proyek.id, nama: 'Perakitan', deskripsi: null,
      penanggungJawabId: null, tanggalMulai: null, tenggat: null, estimasiJam: '24',
    })

    expect([a.urutan, b.urutan]).toEqual([1, 2])
    expect(a.status).toBe('belum_mulai')
  })

  it('menolak tenggat yang mendahului tanggal mulai', async () => {
    const proyek = await proyekBerjalan()
    await expect(buatTugas({
      proyekId: proyek.id, nama: 'Finishing', deskripsi: null, penanggungJawabId: null,
      tanggalMulai: '2026-03-01', tenggat: '2026-02-01', estimasiJam: '8',
    })).rejects.toThrow(/mendahului tanggal mulai/)
  })

  it('menolak tugas pada proyek yang sudah ditutup', async () => {
    const proyek = await proyekBerjalan()
    await batalkanProyek(proyek.id)

    await expect(buatTugas({
      proyekId: proyek.id, nama: 'Terlambat', deskripsi: null, penanggungJawabId: null,
      tanggalMulai: null, tenggat: null, estimasiJam: '1',
    })).rejects.toThrow(/sudah ditutup/)
  })

  it('daftar tugas memuat jam yang sudah tercatat padanya', async () => {
    const proyek = await proyekBerjalan()
    const tugas = await buatTugas({
      proyekId: proyek.id, nama: 'Potong kayu', deskripsi: null, penanggungJawabId: null,
      tanggalMulai: null, tenggat: null, estimasiJam: '16',
    })
    await catatTimesheet({
      proyekId: proyek.id, tugasId: tugas.id, penggunaId,
      tanggal: '2026-02-10', jam: '6', deskripsi: 'Memotong papan',
    })
    await catatTimesheet({
      proyekId: proyek.id, tugasId: tugas.id, penggunaId,
      tanggal: '2026-02-11', jam: '4.5', deskripsi: 'Lanjutan',
    })

    const daftar = await daftarTugas({ proyekId: proyek.id })
    expect(Number(daftar[0].jamTercatat)).toBe(10.5)
  })

  it('tugas bertimesheet tidak dapat dihapus', async () => {
    const proyek = await proyekBerjalan()
    const tugas = await buatTugas({
      proyekId: proyek.id, nama: 'Potong kayu', deskripsi: null, penanggungJawabId: null,
      tanggalMulai: null, tenggat: null, estimasiJam: '16',
    })
    await catatTimesheet({
      proyekId: proyek.id, tugasId: tugas.id, penggunaId,
      tanggal: '2026-02-10', jam: '6', deskripsi: 'Memotong papan',
    })

    await expect(hapusTugas(tugas.id)).rejects.toThrow(/batalkan saja/)
    expect((await ubahStatusTugas(tugas.id, 'dibatalkan')).status).toBe('dibatalkan')
  })
})

// ── Timesheet ────────────────────────────────────────────────────────────────

describe('timesheet', () => {
  async function proyekBerjalan(tarif = '75000') {
    const so = await pesananDikonfirmasi()
    const proyek = await buatProyek(isiProyek(so.id, { tarifPerJam: tarif }), penggunaId)
    return mulaiProyek(proyek.id)
  }

  it('membekukan tarif proyek saat dicatat', async () => {
    const proyek = await proyekBerjalan('75000')
    const baris = await catatTimesheet({
      proyekId: proyek.id, tugasId: null, penggunaId,
      tanggal: '2026-02-10', jam: '8', deskripsi: 'Perakitan',
    })
    expect(Number(baris.tarifPerJam)).toBe(75_000)

    // Menaikkan tarif proyek tidak boleh mengubah biaya yang sudah tercatat.
    await ubahProyek(proyek.id, isiProyek(proyek.soId, { tarifPerJam: '100000' }))
    const rekap = await rekapTimesheetProyek(proyek.id)
    expect(Number(rekap.totalBiaya)).toBe(600_000)

    await catatTimesheet({
      proyekId: proyek.id, tugasId: null, penggunaId,
      tanggal: '2026-02-11', jam: '8', deskripsi: 'Perakitan lanjutan',
    })
    const rekapBaru = await rekapTimesheetProyek(proyek.id)
    expect(Number(rekapBaru.totalJam)).toBe(16)
    expect(Number(rekapBaru.totalBiaya)).toBe(600_000 + 800_000)
  })

  it('menolak jam di luar batas satu hari', async () => {
    const proyek = await proyekBerjalan()
    await expect(catatTimesheet({
      proyekId: proyek.id, tugasId: null, penggunaId,
      tanggal: '2026-02-10', jam: '25', deskripsi: 'Lembur ekstrem',
    })).rejects.toThrow(/tidak boleh lebih dari 24/)

    await expect(catatTimesheet({
      proyekId: proyek.id, tugasId: null, penggunaId,
      tanggal: '2026-02-10', jam: '0', deskripsi: 'Kosong',
    })).rejects.toThrow(/lebih besar dari nol/)
  })

  it('menolak tanggal sebelum proyek dimulai', async () => {
    const proyek = await proyekBerjalan()
    await expect(catatTimesheet({
      proyekId: proyek.id, tugasId: null, penggunaId,
      tanggal: '2026-01-15', jam: '8', deskripsi: 'Terlalu awal',
    })).rejects.toThrow(/mendahului tanggal mulai proyek/)
  })

  it('menolak proyek yang belum dimulai atau sudah ditutup', async () => {
    const so = await pesananDikonfirmasi()
    const draft = await buatProyek(isiProyek(so.id), penggunaId)
    await expect(catatTimesheet({
      proyekId: draft.id, tugasId: null, penggunaId,
      tanggal: '2026-02-10', jam: '8', deskripsi: 'Belum mulai',
    })).rejects.toThrow(/belum dimulai/)

    await mulaiProyek(draft.id)
    await batalkanProyek(draft.id)
    await expect(catatTimesheet({
      proyekId: draft.id, tugasId: null, penggunaId,
      tanggal: '2026-02-10', jam: '8', deskripsi: 'Sudah tutup',
    })).rejects.toThrow(/sudah ditutup/)
  })

  it('menolak tugas milik proyek lain', async () => {
    const proyekA = await proyekBerjalan()
    const tugasA = await buatTugas({
      proyekId: proyekA.id, nama: 'Tugas A', deskripsi: null, penanggungJawabId: null,
      tanggalMulai: null, tenggat: null, estimasiJam: '4',
    })

    const soB = await pesananDikonfirmasi()
    const proyekB = await mulaiProyek(
      (await buatProyek(isiProyek(soB.id, { kode: 'PRJ-002' }), penggunaId)).id,
    )

    await expect(catatTimesheet({
      proyekId: proyekB.id, tugasId: tugasA.id, penggunaId,
      tanggal: '2026-02-10', jam: '8', deskripsi: 'Salah proyek',
    })).rejects.toThrow(/bukan milik proyek ini/)
  })

  it('baris timesheet dapat dihapus selama proyek masih terbuka', async () => {
    const proyek = await proyekBerjalan()
    const baris = await catatTimesheet({
      proyekId: proyek.id, tugasId: null, penggunaId,
      tanggal: '2026-02-10', jam: '8', deskripsi: 'Perakitan',
    })

    await hapusTimesheet(baris.id)
    expect(await daftarTimesheet({ proyekId: proyek.id })).toHaveLength(0)
  })
})

// ── Penutupan proyek ─────────────────────────────────────────────────────────

describe('penutupan proyek', () => {
  async function proyekBerjalan() {
    const so = await pesananDikonfirmasi()
    const proyek = await buatProyek(isiProyek(so.id), penggunaId)
    return mulaiProyek(proyek.id)
  }

  it('tugas yang belum selesai menahan penutupan', async () => {
    const proyek = await proyekBerjalan()
    await buatTugas({
      proyekId: proyek.id, nama: 'Finishing', deskripsi: null, penanggungJawabId: null,
      tanggalMulai: null, tenggat: null, estimasiJam: '8',
    })

    await expect(selesaikanProyek(proyek.id, '2026-04-30'))
      .rejects.toThrow(/tugas yang belum selesai/)
  })

  it('proyek tertutup setelah seluruh tugasnya beres', async () => {
    const proyek = await proyekBerjalan()
    const tugas = await buatTugas({
      proyekId: proyek.id, nama: 'Finishing', deskripsi: null, penanggungJawabId: null,
      tanggalMulai: null, tenggat: null, estimasiJam: '8',
    })
    await ubahStatusTugas(tugas.id, 'selesai')

    const selesai = await selesaikanProyek(proyek.id, '2026-04-30')
    expect(selesai.status).toBe('selesai')
    expect(selesai.tanggalSelesai).toBe('2026-04-30')
  })

  it('menolak tanggal selesai yang mendahului tanggal mulai', async () => {
    const proyek = await proyekBerjalan()
    await expect(selesaikanProyek(proyek.id, '2026-01-01'))
      .rejects.toThrow(/mendahului tanggal mulai/)
  })

  it('proyek yang sudah tertutup tidak dapat diubah', async () => {
    const proyek = await proyekBerjalan()
    await selesaikanProyek(proyek.id, '2026-04-30')
    await expect(ubahProyek(proyek.id, isiProyek(proyek.soId)))
      .rejects.toThrow(/sudah ditutup/)
  })
})

// ── Profitabilitas ───────────────────────────────────────────────────────────

describe('profitabilitas proyek', () => {
  async function proyekDenganPenjualan() {
    await sediakanStok('20', '1200000')
    const so = await pesananDikonfirmasi('10')
    const proyek = await mulaiProyek(
      (await buatProyek(isiProyek(so.id), penggunaId)).id,
    )

    const sisa = await import('@/modules/penjualan/layanan/pesanan')
      .then((m) => m.barisDenganSisa(so.id))
    await kirimDariPesanan({
      soId: so.id, tanggal: '2026-02-05',
      baris: [{ soLineId: sisa[0].id, kuantitas: '10' }],
    }, penggunaId)

    const faktur = await buatFaktur({
      tipe: 'faktur', partnerId: pelangganId, soId: so.id,
      tanggal: '2026-02-06', tanggalJatuhTempo: null, referensi: null,
      mataUangId: 'IDR', catatan: null,
      baris: [{
        produkId, soLineId: sisa[0].id, deskripsi: 'Kursi Makan Jati',
        kuantitas: '10', uomId: satuanUnitId, hargaSatuan: '2000000',
        taxId: pajakPpnId, akunId: akun['4101'],
      }],
    }, penggunaId)
    await postingFaktur(faktur.id, penggunaId)

    return proyek
  }

  it('pendapatan dihitung dari dasar pengenaan pajak, bukan total tagihan', async () => {
    const proyek = await proyekDenganPenjualan()
    const hasil = await profitabilitasProyek(proyek.id)

    // 10 × 2.000.000 = 20.000.000 DPP; PPN 2.200.000 bukan pendapatan.
    expect(Number(hasil.pendapatan)).toBe(20_000_000)
  })

  it('harga pokok diambil dari pengiriman pesanan proyeknya', async () => {
    const proyek = await proyekDenganPenjualan()
    const hasil = await profitabilitasProyek(proyek.id)

    // 10 × 1.200.000 harga pokok rata-rata.
    expect(Number(hasil.hargaPokok)).toBe(12_000_000)
    expect(Number(hasil.labaKotor)).toBe(8_000_000)
  })

  it('beban bertanda proyek mengurangi laba', async () => {
    const proyek = await proyekDenganPenjualan()
    const [jurnal] = await db.select().from(journals).where(eq(journals.kode, 'JU'))
    await postingJurnal({
      journalId: jurnal.id, tanggal: '2026-02-10', referensi: null,
      keterangan: 'Beban angkut proyek', mataUangId: 'IDR', partnerId: null,
      sumberTipe: 'uji', sumberId: crypto.randomUUID(),
      item: [
        {
          accountId: akun['6101'], partnerId: null, label: 'Angkut',
          debit: '1500000', kredit: '0',
          nilaiMataUang: null, taxId: null, projectId: proyek.id,
        },
        {
          accountId: akun['1101'], partnerId: null, label: 'Angkut',
          debit: '0', kredit: '1500000',
          nilaiMataUang: null, taxId: null, projectId: null,
        },
      ],
    }, penggunaId)

    const hasil = await profitabilitasProyek(proyek.id)
    expect(Number(hasil.bebanLain)).toBe(1_500_000)
    expect(Number(hasil.laba)).toBe(8_000_000 - 1_500_000)
  })

  it('beban tanpa tanda proyek tidak ikut terhitung', async () => {
    const proyek = await proyekDenganPenjualan()
    const [jurnal] = await db.select().from(journals).where(eq(journals.kode, 'JU'))
    await postingJurnal({
      journalId: jurnal.id, tanggal: '2026-02-10', referensi: null,
      keterangan: 'Beban angkut umum', mataUangId: 'IDR', partnerId: null,
      sumberTipe: 'uji', sumberId: crypto.randomUUID(),
      item: [
        {
          accountId: akun['6101'], partnerId: null, label: 'Angkut umum',
          debit: '900000', kredit: '0',
          nilaiMataUang: null, taxId: null, projectId: null,
        },
        {
          accountId: akun['1101'], partnerId: null, label: 'Angkut umum',
          debit: '0', kredit: '900000',
          nilaiMataUang: null, taxId: null, projectId: null,
        },
      ],
    }, penggunaId)

    expect(Number((await profitabilitasProyek(proyek.id)).bebanLain)).toBe(0)
  })

  it('biaya timesheet terpisah dari angka buku besar', async () => {
    const proyek = await proyekDenganPenjualan()
    await catatTimesheet({
      proyekId: proyek.id, tugasId: null, penggunaId,
      tanggal: '2026-02-10', jam: '20', deskripsi: 'Perakitan',
    })

    const hasil = await profitabilitasProyek(proyek.id)
    // 20 jam × 75.000 = 1.500.000, mengurangi laba tetapi bukan laba kotor.
    expect(Number(hasil.totalJam)).toBe(20)
    expect(Number(hasil.biayaTenagaKerja)).toBe(1_500_000)
    expect(Number(hasil.labaKotor)).toBe(8_000_000)
    expect(Number(hasil.laba)).toBe(6_500_000)
  })

  it('margin dihitung terhadap pendapatan', async () => {
    const proyek = await proyekDenganPenjualan()
    const hasil = await profitabilitasProyek(proyek.id)
    // 8.000.000 dari 20.000.000 = 40%.
    expect(Number(hasil.marginPersen)).toBe(40)
  })

  it('proyek tanpa faktur bermargin kosong, bukan nol', async () => {
    const so = await pesananDikonfirmasi()
    const proyek = await mulaiProyek((await buatProyek(isiProyek(so.id), penggunaId)).id)

    const hasil = await profitabilitasProyek(proyek.id)
    expect(Number(hasil.pendapatan)).toBe(0)
    expect(hasil.marginPersen).toBeNull()
  })

  it('nota kredit mengurangi pendapatan proyek', async () => {
    const proyek = await proyekDenganPenjualan()
    const nota = await buatFaktur({
      tipe: 'nota_kredit', partnerId: pelangganId, soId: proyek.soId,
      tanggal: '2026-02-20', tanggalJatuhTempo: null, referensi: null,
      mataUangId: 'IDR', catatan: null,
      baris: [{
        produkId, soLineId: null, deskripsi: 'Retur satu kursi',
        kuantitas: '1', uomId: satuanUnitId, hargaSatuan: '2000000',
        taxId: pajakPpnId, akunId: akun['4101'],
      }],
    }, penggunaId)
    await postingFaktur(nota.id, penggunaId)

    expect(Number((await profitabilitasProyek(proyek.id)).pendapatan)).toBe(18_000_000)
  })
})


// ── Penguncian job costing pasca-lunas ──────────────────────────────────────

describe('penguncian job costing', () => {
  async function proyekSelesaiDenganFaktur(bayarPenuh: boolean) {
    await sediakanStok('20', '1200000')
    const so = await pesananDikonfirmasi('10')
    const proyek = await mulaiProyek((await buatProyek(isiProyek(so.id), penggunaId)).id)

    const { barisDenganSisa } = await import('@/modules/penjualan/layanan/pesanan')
    const sisa = await barisDenganSisa(so.id)
    await kirimDariPesanan({
      soId: so.id, tanggal: '2026-02-05',
      baris: [{ soLineId: sisa[0].id, kuantitas: '10' }],
    }, penggunaId)

    const faktur = await buatFaktur({
      tipe: 'faktur', partnerId: pelangganId, soId: so.id,
      tanggal: '2026-02-06', tanggalJatuhTempo: null, referensi: null,
      mataUangId: 'IDR', catatan: null,
      baris: [{
        produkId, soLineId: sisa[0].id, deskripsi: 'Kursi Makan Jati',
        kuantitas: '10', uomId: satuanUnitId, hargaSatuan: '2000000',
        taxId: pajakPpnId, akunId: akun['4101'],
      }],
    }, penggunaId)
    await postingFaktur(faktur.id, penggunaId)

    if (bayarPenuh) {
      const { buatPembayaran, postingPembayaran } =
        await import('@/modules/penjualan/layanan/pembayaran')
      const bayar = await buatPembayaran({
        partnerId: pelangganId, tanggal: '2026-02-20', akunKasId: akun['1101'],
        jumlah: '22200000', referensi: null, catatan: null,
        alokasi: [{ invoiceId: faktur.id, jumlah: '22200000' }],
      }, penggunaId)
      await postingPembayaran(bayar.id, penggunaId)
    }

    await selesaikanProyek(proyek.id, '2026-03-01')
    return proyek
  }

  it('menolak penguncian selama piutang belum lunas', async () => {
    const proyek = await proyekSelesaiDenganFaktur(false)

    const kesiapan = await kesiapanKunci(proyek.id)
    expect(kesiapan.siap).toBe(false)
    expect(kesiapan.penghalang.join(' ')).toMatch(/piutang belum lunas/)

    await expect(kunciProyek(proyek.id, penggunaId))
      .rejects.toThrow(/belum dapat dikunci/)
  })

  it('menolak penguncian proyek yang belum punya faktur', async () => {
    const so = await pesananDikonfirmasi()
    const proyek = await mulaiProyek((await buatProyek(isiProyek(so.id), penggunaId)).id)
    await selesaikanProyek(proyek.id, '2026-03-01')

    const kesiapan = await kesiapanKunci(proyek.id)
    expect(kesiapan.penghalang.join(' ')).toMatch(/Belum ada faktur terposting/)
  })

  it('menolak penguncian selama masih ada tugas terbuka', async () => {
    const so = await pesananDikonfirmasi()
    const proyek = await mulaiProyek((await buatProyek(isiProyek(so.id), penggunaId)).id)
    await buatTugas({
      proyekId: proyek.id, nama: 'Finishing', deskripsi: null, penanggungJawabId: null,
      tanggalMulai: null, tenggat: null, estimasiJam: '8',
    })

    const kesiapan = await kesiapanKunci(proyek.id)
    expect(kesiapan.penghalang.join(' ')).toMatch(/1 tugas terbuka/)
  })

  it('mengunci setelah pekerjaan selesai dan faktur lunas', async () => {
    const proyek = await proyekSelesaiDenganFaktur(true)

    const kesiapan = await kesiapanKunci(proyek.id)
    expect(kesiapan.siap).toBe(true)
    expect(Number(kesiapan.sisaPiutang)).toBe(0)

    await kunciProyek(proyek.id, penggunaId)
    expect((await ambilProyek(proyek.id))!.status).toBe('terkunci')
  })

  it('angka dibekukan dan tidak bergeser saat harga pokok berubah', async () => {
    const proyek = await proyekSelesaiDenganFaktur(true)
    const sebelum = await profitabilitasProyek(proyek.id)
    await kunciProyek(proyek.id, penggunaId)

    // Pembelian baru dengan harga jauh lebih tinggi menggeser rata-rata.
    await sediakanStok('50', '5000000')

    const sesudah = await profitabilitasProyek(proyek.id)
    expect(sesudah.terkunci).toBe(true)
    expect(sesudah.pendapatan).toBe(sebelum.pendapatan)
    expect(sesudah.hargaPokok).toBe(sebelum.hargaPokok)
    expect(sesudah.laba).toBe(sebelum.laba)
  })

  it('biaya baru tidak dapat lagi ditandai ke proyek terkunci', async () => {
    const proyek = await proyekSelesaiDenganFaktur(true)
    await kunciProyek(proyek.id, penggunaId)

    const [jurnal] = await db.select().from(journals).where(eq(journals.kode, 'JU'))
    await expect(postingJurnal({
      journalId: jurnal.id, tanggal: '2026-04-01', referensi: null,
      keterangan: 'Beban telat', mataUangId: 'IDR', partnerId: null,
      sumberTipe: 'uji', sumberId: crypto.randomUUID(),
      item: [
        {
          accountId: akun['6101'], partnerId: null, label: 'Telat',
          debit: '100000', kredit: '0',
          nilaiMataUang: null, taxId: null, projectId: proyek.id,
        },
        {
          accountId: akun['1101'], partnerId: null, label: 'Telat',
          debit: '0', kredit: '100000',
          nilaiMataUang: null, taxId: null, projectId: null,
        },
      ],
    }, penggunaId)).rejects.toThrow(/sudah dikunci sehingga tidak dapat lagi dibebani/)
  })

  it('biaya untuk proyek lain tetap boleh diposting', async () => {
    const terkunci = await proyekSelesaiDenganFaktur(true)
    await kunciProyek(terkunci.id, penggunaId)

    const soLain = await pesananDikonfirmasi()
    const lain = await mulaiProyek(
      (await buatProyek(isiProyek(soLain.id, { kode: 'PRJ-002' }), penggunaId)).id,
    )

    const [jurnal] = await db.select().from(journals).where(eq(journals.kode, 'JU'))
    await postingJurnal({
      journalId: jurnal.id, tanggal: '2026-04-01', referensi: null,
      keterangan: 'Beban proyek lain', mataUangId: 'IDR', partnerId: null,
      sumberTipe: 'uji', sumberId: crypto.randomUUID(),
      item: [
        {
          accountId: akun['6101'], partnerId: null, label: 'Angkut',
          debit: '250000', kredit: '0',
          nilaiMataUang: null, taxId: null, projectId: lain.id,
        },
        {
          accountId: akun['1101'], partnerId: null, label: 'Angkut',
          debit: '0', kredit: '250000',
          nilaiMataUang: null, taxId: null, projectId: null,
        },
      ],
    }, penggunaId)

    expect(Number((await profitabilitasProyek(lain.id)).bebanLain)).toBe(250_000)
  })

  it('proyek terkunci tidak dapat diubah maupun dibatalkan', async () => {
    const proyek = await proyekSelesaiDenganFaktur(true)
    await kunciProyek(proyek.id, penggunaId)

    await expect(ubahProyek(proyek.id, isiProyek(proyek.soId)))
      .rejects.toThrow(/tidak dapat diubah/)
    await expect(batalkanProyek(proyek.id))
      .rejects.toThrow(/tidak dapat dibatalkan/)
    await expect(kunciProyek(proyek.id, penggunaId))
      .rejects.toThrow(/sudah terkunci/)
  })

  it('membuka kunci mengembalikan perhitungan dari data sebenarnya', async () => {
    const proyek = await proyekSelesaiDenganFaktur(true)
    await kunciProyek(proyek.id, penggunaId)
    await bukaKunciProyek(proyek.id)

    const dibuka = (await ambilProyek(proyek.id))!
    expect(dibuka.status).toBe('selesai')
    expect(dibuka.labaFinal).toBeNull()
    expect((await profitabilitasProyek(proyek.id)).terkunci).toBe(false)
  })
})
