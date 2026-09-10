import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  users, accounts, journals, sequences, companySettings, currencies,
  costCenters, journalItemCostAllocations, locations, warehouses,
} from '@/db/schema'
import {
  buatPosBiaya, ubahPosBiaya, ubahStatusPosBiaya, daftarPosBiaya,
  hitungAlokasi, labaRugiPerPos, aturPosBawaanLokasi, daftarPosBawaanLokasi,
} from '@/modules/akuntansi/layanan/pos-biaya'
import { postingJurnal } from '@/modules/akuntansi/layanan/entri'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'
import { seedPemetaanJurnal } from '../bantuan/pemetaan'

const TABEL = [
  'journal_item_cost_allocations', 'location_cost_centers', 'cost_centers',
  'journal_items', 'journal_entries', 'journal_mappings', 'journals', 'sequences',
  'company_settings', 'accounts', 'currency_rates', 'currencies',
  'locations', 'warehouses',
  'audit_logs', 'user_roles', 'users', 'partners', 'payment_terms', 'taxes',
]

let penggunaId: string
let jurnalId: string
const akun: Record<string, string> = {}
const pos: Record<string, string> = {}

beforeEach(async () => {
  await bersihkanTabel(TABEL)
  await db.insert(currencies).values({ kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 })

  const dibuatAkun = await db.insert(accounts).values([
    { kode: '1101', nama: 'Kas', tipeAkun: 'aset_kas' },
    { kode: '4101', nama: 'Penjualan Furnitur', tipeAkun: 'pendapatan' },
    { kode: '6111', nama: 'Beban Listrik dan Air', tipeAkun: 'beban_operasional' },
    { kode: '6121', nama: 'Beban Pengiriman', tipeAkun: 'beban_operasional' },
  ]).returning()
  for (const a of dibuatAkun) akun[a.kode] = a.id

  await db.insert(companySettings).values({ nama: 'PT Uji' })

  const [pengguna] = await db.insert(users).values({
    email: 'akuntan@uji.id', nama: 'Akuntan', passwordHash: 'x',
  }).returning()
  penggunaId = pengguna.id

  const [urutan] = await db.insert(sequences).values({
    kode: 'jurnal:JU', prefix: 'JU', panjangDigit: 4, nomorBerikut: 1, reset: 'bulanan',
  }).returning()
  const [jurnal] = await db.insert(journals).values({
    kode: 'JU', nama: 'Jurnal Umum', tipe: 'umum', sequenceId: urutan.id,
  }).returning()
  await seedPemetaanJurnal()
  jurnalId = jurnal.id

  const dibuatPos = await db.insert(costCenters).values([
    { kode: 'BB', nama: 'Bahan Baku' },
    { kode: 'WS', nama: 'Workshop' },
    { kode: 'SE', nama: 'Showroom Ekspor' },
  ]).returning()
  for (const p of dibuatPos) pos[p.kode] = p.id
})

afterAll(async () => { await tutupKoneksi() })

// ── Master pos biaya ─────────────────────────────────────────────────────────

describe('master pos biaya', () => {
  it('menolak kode yang sudah dipakai', async () => {
    await expect(buatPosBiaya({ kode: 'WS', nama: 'Workshop Lain', deskripsi: null }))
      .rejects.toThrow(/sudah dipakai/)
  })

  it('mengubah nama tanpa mengubah kodenya tetap boleh', async () => {
    const diubah = await ubahPosBiaya(pos.WS, {
      kode: 'WS', nama: 'Workshop Utama', deskripsi: null,
    })
    expect(diubah.nama).toBe('Workshop Utama')
  })

  it('pos dinonaktifkan, bukan dihapus', async () => {
    await ubahStatusPosBiaya(pos.SE, false)
    expect(await daftarPosBiaya()).toHaveLength(3)
    expect(await daftarPosBiaya({ hanyaAktif: true })).toHaveLength(2)
  })
})

// ── Pembagian nilai ──────────────────────────────────────────────────────────

describe('hitungAlokasi', () => {
  it('satu pos menerima seluruh nilainya', () => {
    const hasil = hitungAlokasi('1000000', [{ costCenterId: pos.WS, persentase: '100' }])
    expect(hasil).toHaveLength(1)
    expect(Number(hasil[0].nilai)).toBe(1_000_000)
  })

  it('membagi menurut persentase yang diminta', () => {
    const hasil = hitungAlokasi('1000000', [
      { costCenterId: pos.WS, persentase: '40' },
      { costCenterId: pos.SE, persentase: '60' },
    ])
    expect(hasil.map((h) => Number(h.nilai))).toEqual([400_000, 600_000])
  })

  it('baris terakhir menyerap sisa pembulatan', () => {
    // Sepertiga dari seratus tidak habis dibagi dalam rupiah.
    const hasil = hitungAlokasi('100', [
      { costCenterId: pos.BB, persentase: '33.3333' },
      { costCenterId: pos.WS, persentase: '33.3333' },
      { costCenterId: pos.SE, persentase: '33.3334' },
    ])
    const total = hasil.reduce((t, h) => t + Number(h.nilai), 0)
    expect(total).toBeCloseTo(100, 10)
  })

  it('menolak pembagian yang tidak berjumlah seratus persen', () => {
    expect(() => hitungAlokasi('1000', [
      { costCenterId: pos.WS, persentase: '40' },
      { costCenterId: pos.SE, persentase: '40' },
    ])).toThrow(/harus berjumlah tepat 100%/)
  })

  it('menolak satu pos yang muncul dua kali', () => {
    expect(() => hitungAlokasi('1000', [
      { costCenterId: pos.WS, persentase: '50' },
      { costCenterId: pos.WS, persentase: '50' },
    ])).toThrow(/hanya boleh muncul sekali/)
  })

  it('tanpa alokasi menghasilkan daftar kosong', () => {
    expect(hitungAlokasi('1000', [])).toEqual([])
  })
})

// ── Alokasi pada posting jurnal ──────────────────────────────────────────────

function entri(item: Record<string, unknown>[]) {
  return {
    journalId: jurnalId,
    tanggal: '2026-03-10',
    referensi: null,
    keterangan: 'Uji alokasi',
    mataUangId: 'IDR',
    partnerId: null,
    sumberTipe: 'uji',
    sumberId: crypto.randomUUID(),
    item,
  } as never
}

describe('alokasi pada posting jurnal', () => {
  it('menyimpan satu pos sebagai satu baris berpersentase seratus', async () => {
    await postingJurnal(entri([
      {
        accountId: akun['6111'], partnerId: null, label: 'Listrik',
        debit: '1000000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [{ costCenterId: pos.WS, persentase: '100' }],
      },
      {
        accountId: akun['1101'], partnerId: null, label: 'Listrik',
        debit: '0', kredit: '1000000', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [],
      },
    ]), penggunaId)

    const alokasi = await db.select().from(journalItemCostAllocations)
    expect(alokasi).toHaveLength(1)
    expect(Number(alokasi[0].nilai)).toBe(1_000_000)
    expect(Number(alokasi[0].persentase)).toBe(100)
  })

  it('membagi satu beban ke beberapa pos sekaligus', async () => {
    // Tagihan listrik satu gedung yang dipakai dua unit kerja.
    await postingJurnal(entri([
      {
        accountId: akun['6111'], partnerId: null, label: 'Listrik gedung',
        debit: '1000000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [
          { costCenterId: pos.WS, persentase: '40' },
          { costCenterId: pos.SE, persentase: '60' },
        ],
      },
      {
        accountId: akun['1101'], partnerId: null, label: 'Listrik gedung',
        debit: '0', kredit: '1000000', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [],
      },
    ]), penggunaId)

    const alokasi = await db.select().from(journalItemCostAllocations)
    expect(alokasi).toHaveLength(2)
    expect(alokasi.reduce((t, a) => t + Number(a.nilai), 0)).toBe(1_000_000)
  })

  it('menolak pos biaya pada akun yang bukan laba rugi', async () => {
    await expect(postingJurnal(entri([
      {
        accountId: akun['1101'], partnerId: null, label: 'Kas',
        debit: '500000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [{ costCenterId: pos.WS, persentase: '100' }],
      },
      {
        accountId: akun['4101'], partnerId: null, label: 'Pendapatan',
        debit: '0', kredit: '500000', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [],
      },
    ]), penggunaId)).rejects.toThrow(/hanya dapat dibebankan pada akun laba rugi/)
  })

  it('menolak pos biaya yang sudah nonaktif', async () => {
    await ubahStatusPosBiaya(pos.SE, false)
    await expect(postingJurnal(entri([
      {
        accountId: akun['6111'], partnerId: null, label: 'Listrik',
        debit: '100000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [{ costCenterId: pos.SE, persentase: '100' }],
      },
      {
        accountId: akun['1101'], partnerId: null, label: 'Listrik',
        debit: '0', kredit: '100000', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [],
      },
    ]), penggunaId)).rejects.toThrow(/sudah nonaktif/)
  })
})

// ── Laporan ──────────────────────────────────────────────────────────────────

describe('laba rugi per pos biaya', () => {
  async function bebanTerbagi() {
    await postingJurnal(entri([
      {
        accountId: akun['6111'], partnerId: null, label: 'Listrik gedung',
        debit: '1000000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [
          { costCenterId: pos.WS, persentase: '40' },
          { costCenterId: pos.SE, persentase: '60' },
        ],
      },
      {
        accountId: akun['1101'], partnerId: null, label: 'Listrik gedung',
        debit: '0', kredit: '1000000', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [],
      },
    ]), penggunaId)
  }

  it('memisahkan beban menurut porsi tiap pos', async () => {
    await bebanTerbagi()
    const baris = await labaRugiPerPos('2026-01-01', '2026-12-31')

    const ws = baris.find((b) => b.kode === 'WS')!
    const se = baris.find((b) => b.kode === 'SE')!
    expect(Number(ws.beban)).toBe(400_000)
    expect(Number(se.beban)).toBe(600_000)
  })

  it('jumlah seluruh pos sama dengan beban keseluruhan', async () => {
    await bebanTerbagi()
    const baris = await labaRugiPerPos('2026-01-01', '2026-12-31')
    expect(baris.reduce((t, b) => t + Number(b.beban), 0)).toBe(1_000_000)
  })

  it('beban tanpa pos muncul terpisah, bukan dibagi rata', async () => {
    await postingJurnal(entri([
      {
        accountId: akun['6121'], partnerId: null, label: 'Angkut tanpa pos',
        debit: '250000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [],
      },
      {
        accountId: akun['1101'], partnerId: null, label: 'Angkut tanpa pos',
        debit: '0', kredit: '250000', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [],
      },
    ]), penggunaId)

    const baris = await labaRugiPerPos('2026-01-01', '2026-12-31')
    const tanpaPos = baris.find((b) => b.costCenterId === null)!
    expect(Number(tanpaPos.beban)).toBe(250_000)

    // Pos yang tidak menanggung apa pun tetap ditampilkan bernilai nol agar
    // ketiganya selalu dapat dibandingkan berdampingan.
    expect(Number(baris.find((b) => b.kode === 'WS')!.beban)).toBe(0)
  })

  it('menghormati batas periode', async () => {
    await bebanTerbagi()
    const diLuar = await labaRugiPerPos('2026-05-01', '2026-12-31')
    expect(diLuar.reduce((t, b) => t + Number(b.beban), 0)).toBe(0)
  })

  it('pendapatan dan beban dipisahkan pada pos yang sama', async () => {
    await postingJurnal(entri([
      {
        accountId: akun['1101'], partnerId: null, label: 'Kas masuk',
        debit: '3000000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [],
      },
      {
        accountId: akun['4101'], partnerId: null, label: 'Penjualan showroom',
        debit: '0', kredit: '3000000', nilaiMataUang: null, taxId: null, projectId: null,
        alokasiBiaya: [{ costCenterId: pos.SE, persentase: '100' }],
      },
    ]), penggunaId)
    await bebanTerbagi()

    const se = (await labaRugiPerPos('2026-01-01', '2026-12-31')).find((b) => b.kode === 'SE')!
    expect(Number(se.pendapatan)).toBe(3_000_000)
    expect(Number(se.beban)).toBe(600_000)
    expect(Number(se.laba)).toBe(2_400_000)
  })
})

// ── Pos bawaan gudang ────────────────────────────────────────────────────────

describe('pos bawaan gudang', () => {
  it('menyimpan dan mengganti pos bawaan sebuah gudang', async () => {
    const [gudang] = await db.insert(warehouses).values({ kode: 'GU', nama: 'Gudang Utama' })
      .returning()
    const [lokasi] = await db.insert(locations).values({
      kode: 'GU/BB', nama: 'Gudang Bahan Baku', tipe: 'internal', warehouseId: gudang.id,
    }).returning()

    await aturPosBawaanLokasi(lokasi.id, pos.BB)
    expect((await daftarPosBawaanLokasi())[0].kodePos).toBe('BB')

    // Mengganti tidak menumpuk baris; satu gudang hanya punya satu pos bawaan.
    await aturPosBawaanLokasi(lokasi.id, pos.WS)
    const bawaan = await daftarPosBawaanLokasi()
    expect(bawaan).toHaveLength(1)
    expect(bawaan[0].kodePos).toBe('WS')

    await aturPosBawaanLokasi(lokasi.id, null)
    expect(await daftarPosBawaanLokasi()).toHaveLength(0)
  })
})
