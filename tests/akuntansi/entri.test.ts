import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  users, accounts, journals, sequences, companySettings,
  journalItems, currencies,
} from '@/db/schema'
import {
  buatEntri, ubahEntri, postingEntri, batalkanDraft, hapusDraft,
  balikEntri, ambilEntri, daftarEntri, postingJurnal,
} from '@/modules/akuntansi/layanan/entri'
import { bersihkanTabel, tutupKoneksi } from '../bantuan/db'
import { seedPemetaanJurnal } from '../bantuan/pemetaan'

const TABEL = [
  'journal_items', 'journal_entries', 'journal_mappings', 'journals', 'sequences',
  'company_settings', 'accounts', 'currency_rates', 'currencies',
  'audit_logs', 'user_roles', 'users',
]

let penggunaId: string
let jurnalId: string
let akunKas: string
let akunPendapatan: string
let akunPiutang: string

beforeEach(async () => {
  await bersihkanTabel(TABEL)

  await db.insert(currencies).values([
    { kode: 'IDR', nama: 'Rupiah', simbol: 'Rp', desimal: 2 },
    { kode: 'USD', nama: 'Dolar Amerika Serikat', simbol: '$', desimal: 2 },
  ])

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

  const dibuat = await db.insert(accounts).values([
    { kode: '1101', nama: 'Kas', tipeAkun: 'aset_kas' },
    { kode: '1121', nama: 'Piutang Usaha', tipeAkun: 'aset_piutang' },
    { kode: '4101', nama: 'Penjualan', tipeAkun: 'pendapatan' },
  ]).returning()
  akunKas = dibuat[0].id
  akunPiutang = dibuat[1].id
  akunPendapatan = dibuat[2].id
})

afterAll(async () => { await tutupKoneksi() })

function entriSeimbang(ubah: Record<string, unknown> = {}) {
  return {
    journalId: jurnalId,
    tanggal: '2026-09-08',
    referensi: null,
    keterangan: 'Penjualan tunai',
    mataUangId: 'IDR',
    partnerId: null,
    item: [
      { accountId: akunKas, partnerId: null, label: 'Kas masuk', debit: '1000000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null },
      { accountId: akunPendapatan, partnerId: null, label: 'Penjualan', debit: '0', kredit: '1000000', nilaiMataUang: null, taxId: null, projectId: null },
    ],
    ...ubah,
  }
}

// ── Invarian 1: keseimbangan ─────────────────────────────────────────────────

describe('invarian keseimbangan', () => {
  it('menerima entri yang seimbang', async () => {
    const entri = await buatEntri(entriSeimbang(), penggunaId)
    expect(entri.status).toBe('draft')
    expect(entri.item).toHaveLength(2)
  })

  it('menolak entri yang tidak seimbang', async () => {
    await expect(buatEntri(entriSeimbang({
      item: [
        { accountId: akunKas, partnerId: null, label: 'Kas', debit: '1000000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null },
        { accountId: akunPendapatan, partnerId: null, label: 'Penjualan', debit: '0', kredit: '999999', nilaiMataUang: null, taxId: null, projectId: null },
      ],
    }), penggunaId)).rejects.toThrow('tidak seimbang')
  })

  it('menyebutkan selisihnya dalam pesan galat', async () => {
    await expect(buatEntri(entriSeimbang({
      item: [
        { accountId: akunKas, partnerId: null, label: 'Kas', debit: '1000000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null },
        { accountId: akunPendapatan, partnerId: null, label: 'Penjualan', debit: '0', kredit: '999999', nilaiMataUang: null, taxId: null, projectId: null },
      ],
    }), penggunaId)).rejects.toThrow('selisih 1')
  })

  it('menerima entri seimbang dengan banyak baris', async () => {
    const entri = await buatEntri(entriSeimbang({
      item: [
        { accountId: akunKas, partnerId: null, label: 'Kas', debit: '600000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null },
        { accountId: akunPiutang, partnerId: null, label: 'Piutang', debit: '400000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null },
        { accountId: akunPendapatan, partnerId: null, label: 'Penjualan', debit: '0', kredit: '1000000', nilaiMataUang: null, taxId: null, projectId: null },
      ],
    }), penggunaId)
    expect(entri.item).toHaveLength(3)
  })

  it('menolak entri berbaris tunggal', async () => {
    await expect(buatEntri(entriSeimbang({
      item: [{ accountId: akunKas, partnerId: null, label: 'Kas', debit: '1000', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null }],
    }), penggunaId)).rejects.toThrow('minimal dua baris')
  })

  it('menyeimbangkan dengan presisi dua desimal tanpa galat pembulatan', async () => {
    const entri = await buatEntri(entriSeimbang({
      item: [
        { accountId: akunKas, partnerId: null, label: 'a', debit: '0.10', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null },
        { accountId: akunPiutang, partnerId: null, label: 'b', debit: '0.20', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null },
        { accountId: akunPendapatan, partnerId: null, label: 'c', debit: '0', kredit: '0.30', nilaiMataUang: null, taxId: null, projectId: null },
      ],
    }), penggunaId)
    expect(entri.item).toHaveLength(3)
  })
})

// ── Invarian 2: CHECK constraint basis data ──────────────────────────────────

describe('invarian debit dan kredit', () => {
  it('menolak baris yang memuat debit dan kredit sekaligus', async () => {
    await expect(buatEntri(entriSeimbang({
      item: [
        { accountId: akunKas, partnerId: null, label: 'Aneh', debit: '500', kredit: '500', nilaiMataUang: null, taxId: null, projectId: null },
        { accountId: akunPendapatan, partnerId: null, label: 'Lawan', debit: '0', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null },
      ],
    }), penggunaId)).rejects.toThrow('debit dan kredit sekaligus')
  })

  it('ditegakkan juga oleh basis data, bukan hanya validasi aplikasi', async () => {
    const entri = await buatEntri(entriSeimbang(), penggunaId)
    await expect(
      db.insert(journalItems).values({
        entryId: entri.id, urutan: 3, accountId: akunKas,
        label: 'Melanggar', debit: '100', kredit: '100',
      }),
    ).rejects.toThrow()
  })

  it('menolak nilai negatif di tingkat basis data', async () => {
    const entri = await buatEntri(entriSeimbang(), penggunaId)
    await expect(
      db.insert(journalItems).values({
        entryId: entri.id, urutan: 3, accountId: akunKas,
        label: 'Negatif', debit: '-100', kredit: '0',
      }),
    ).rejects.toThrow()
  })

  it('menolak baris tanpa nilai debit maupun kredit', async () => {
    await expect(buatEntri(entriSeimbang({
      item: [
        { accountId: akunKas, partnerId: null, label: 'Kosong', debit: '0', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null },
        { accountId: akunPendapatan, partnerId: null, label: 'Kosong', debit: '0', kredit: '0', nilaiMataUang: null, taxId: null, projectId: null },
      ],
    }), penggunaId)).rejects.toThrow('harus memuat nilai debit atau kredit')
  })
})

// ── Invarian 3 & 5: posting, penomoran, keterkuncian ────────────────────────

describe('posting entri', () => {
  it('memberi nomor hanya saat posting, bukan saat draft dibuat', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    expect(draft.nomor).toBeNull()

    const diposting = await postingEntri(draft.id, penggunaId)
    expect(diposting.nomor).toBe('JU/2026/09/0001')
    expect(diposting.status).toBe('diposting')
    expect(diposting.dipostingPada).not.toBeNull()
    expect(diposting.dipostingOleh).toBe(penggunaId)
  })

  it('tidak meninggalkan lubang nomor saat draft dibuang', async () => {
    const dibuang = await buatEntri(entriSeimbang(), penggunaId)
    await hapusDraft(dibuang.id)
    const dipakai = await buatEntri(entriSeimbang(), penggunaId)
    expect((await postingEntri(dipakai.id, penggunaId)).nomor).toBe('JU/2026/09/0001')
  })

  it('menolak posting ganda', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    await postingEntri(draft.id, penggunaId)
    await expect(postingEntri(draft.id, penggunaId)).rejects.toThrow('sudah diposting')
  })

  it('menolak perubahan pada entri terposting', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    await postingEntri(draft.id, penggunaId)
    await expect(ubahEntri(draft.id, entriSeimbang({ keterangan: 'Diubah' })))
      .rejects.toThrow('tidak dapat diubah')
  })

  it('menolak penghapusan entri terposting', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    await postingEntri(draft.id, penggunaId)
    await expect(hapusDraft(draft.id)).rejects.toThrow('tidak dapat dihapus')
  })

  it('menolak pembatalan entri terposting', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    await postingEntri(draft.id, penggunaId)
    await expect(batalkanDraft(draft.id)).rejects.toThrow('Hanya entri berstatus draft')
  })

  it('mengizinkan pembatalan draft dan menyimpannya sebagai jejak', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    await batalkanDraft(draft.id)
    const setelah = await ambilEntri(draft.id)
    expect(setelah!.status).toBe('dibatalkan')
    expect(setelah!.nomor).toBeNull()
  })

  it('menolak posting entri yang dibatalkan', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    await batalkanDraft(draft.id)
    await expect(postingEntri(draft.id, penggunaId)).rejects.toThrow('dibatalkan')
  })

  it('menaikkan nomor untuk posting berikutnya', async () => {
    const a = await buatEntri(entriSeimbang(), penggunaId)
    const b = await buatEntri(entriSeimbang(), penggunaId)
    expect((await postingEntri(a.id, penggunaId)).nomor).toBe('JU/2026/09/0001')
    expect((await postingEntri(b.id, penggunaId)).nomor).toBe('JU/2026/09/0002')
  })

  it('tidak menghasilkan nomor kembar saat sepuluh posting berjalan bersamaan', async () => {
    const draft = await Promise.all(
      Array.from({ length: 10 }, () => buatEntri(entriSeimbang(), penggunaId)),
    )
    const hasil = await Promise.all(draft.map((d) => postingEntri(d.id, penggunaId)))
    const nomor = hasil.map((h) => h.nomor)
    expect(new Set(nomor).size).toBe(10)
  })
})

// ── Invarian 4: penguncian periode ───────────────────────────────────────────

describe('penguncian periode', () => {
  beforeEach(async () => {
    await db.insert(companySettings).values({
      nama: 'PT Uji', tanggalKunciBuku: '2026-08-31',
    })
  })

  it('menolak pembuatan entri pada periode terkunci', async () => {
    await expect(buatEntri(entriSeimbang({ tanggal: '2026-08-15' }), penggunaId))
      .rejects.toThrow('terkunci')
  })

  it('menolak entri tepat pada tanggal kunci', async () => {
    await expect(buatEntri(entriSeimbang({ tanggal: '2026-08-31' }), penggunaId))
      .rejects.toThrow('terkunci')
  })

  it('mengizinkan entri setelah tanggal kunci', async () => {
    await expect(buatEntri(entriSeimbang({ tanggal: '2026-09-01' }), penggunaId))
      .resolves.toBeTruthy()
  })

  it('menolak posting entri yang tanggalnya jatuh di periode terkunci', async () => {
    await db.update(companySettings).set({ tanggalKunciBuku: null })
    const draft = await buatEntri(entriSeimbang({ tanggal: '2026-08-15' }), penggunaId)
    await db.update(companySettings).set({ tanggalKunciBuku: '2026-08-31' })
    await expect(postingEntri(draft.id, penggunaId)).rejects.toThrow('terkunci')
  })

  it('menolak pemindahan draft ke dalam periode terkunci', async () => {
    const draft = await buatEntri(entriSeimbang({ tanggal: '2026-09-01' }), penggunaId)
    await expect(ubahEntri(draft.id, entriSeimbang({ tanggal: '2026-08-15' })))
      .rejects.toThrow('terkunci')
  })

  it('menyebutkan tanggal kunci dalam bahasa Indonesia', async () => {
    await expect(buatEntri(entriSeimbang({ tanggal: '2026-08-15' }), penggunaId))
      .rejects.toThrow('31 Agustus 2026')
  })
})

// ── Pembalikan ───────────────────────────────────────────────────────────────

describe('pembalikan entri', () => {
  it('menghasilkan entri baru dengan debit dan kredit tertukar', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    const asal = await postingEntri(draft.id, penggunaId)
    const balik = await balikEntri(asal.id, '2026-09-30', penggunaId)

    expect(balik.status).toBe('diposting')
    expect(balik.membalikEntryId).toBe(asal.id)
    expect(balik.nomor).toBe('JU/2026/09/0002')

    const asalKas = asal.item.find((b) => b.accountId === akunKas)!
    const balikKas = balik.item.find((b) => b.accountId === akunKas)!
    expect(asalKas.debit).toBe('1000000.00')
    expect(balikKas.kredit).toBe('1000000.00')
    expect(balikKas.debit).toBe('0.00')
  })

  it('menghasilkan saldo nol bila digabung dengan entri asalnya', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    const asal = await postingEntri(draft.id, penggunaId)
    const balik = await balikEntri(asal.id, '2026-09-30', penggunaId)

    for (const akun of [akunKas, akunPendapatan]) {
      const a = asal.item.find((b) => b.accountId === akun)!
      const b = balik.item.find((x) => x.accountId === akun)!
      const saldo = Number(a.debit) - Number(a.kredit) + Number(b.debit) - Number(b.kredit)
      expect(saldo).toBe(0)
    }
  })

  it('tidak mengubah maupun menghapus entri asal', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    const asal = await postingEntri(draft.id, penggunaId)
    await balikEntri(asal.id, '2026-09-30', penggunaId)

    const setelah = await ambilEntri(asal.id)
    expect(setelah!.status).toBe('diposting')
    expect(setelah!.nomor).toBe(asal.nomor)
    expect(setelah!.item).toHaveLength(2)
  })

  it('menolak pembalikan entri yang masih draft', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    await expect(balikEntri(draft.id, '2026-09-30', penggunaId))
      .rejects.toThrow('sudah diposting')
  })

  it('menolak pembalikan ganda', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    const asal = await postingEntri(draft.id, penggunaId)
    await balikEntri(asal.id, '2026-09-30', penggunaId)
    await expect(balikEntri(asal.id, '2026-10-01', penggunaId))
      .rejects.toThrow('sudah pernah dibalik')
  })

  it('merujuk nomor entri asal pada keterangan dan referensi', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    const asal = await postingEntri(draft.id, penggunaId)
    const balik = await balikEntri(asal.id, '2026-09-30', penggunaId)
    expect(balik.referensi).toBe(asal.nomor)
    expect(balik.keterangan).toContain(asal.nomor!)
  })
})

// ── Kurs dibekukan ───────────────────────────────────────────────────────────

describe('pembekuan kurs', () => {
  it('menyimpan kurs satu untuk entri dalam rupiah', async () => {
    const entri = await buatEntri(entriSeimbang(), penggunaId)
    expect(Number(entri.kurs)).toBe(1)
  })

  it('memakai kurs asal pada entri pembalik, bukan kurs saat pembalikan', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    const asal = await postingEntri(draft.id, penggunaId)
    const balik = await balikEntri(asal.id, '2026-12-31', penggunaId)
    expect(balik.kurs).toBe(asal.kurs)
  })
})

// ── Kanal integrasi antar modul ──────────────────────────────────────────────

describe('postingJurnal sebagai kanal modul lain', () => {
  it('membuat entri terposting sekaligus menandai dokumen asalnya', async () => {
    const entri = await postingJurnal(
      { ...entriSeimbang(), sumberTipe: 'faktur', sumberId: crypto.randomUUID() },
      penggunaId,
    )
    expect(entri.status).toBe('diposting')
    expect(entri.sumberTipe).toBe('faktur')
    expect(entri.nomor).toBe('JU/2026/09/0001')
  })

  it('menolak posting dari modul lain pada periode terkunci', async () => {
    await db.insert(companySettings).values({ nama: 'PT Uji', tanggalKunciBuku: '2026-09-30' })
    await expect(postingJurnal(
      { ...entriSeimbang(), sumberTipe: 'faktur', sumberId: crypto.randomUUID() },
      penggunaId,
    )).rejects.toThrow('terkunci')
  })
})

// ── Pembacaan ────────────────────────────────────────────────────────────────

describe('daftar entri', () => {
  it('menyaring berdasarkan status', async () => {
    const a = await buatEntri(entriSeimbang(), penggunaId)
    await buatEntri(entriSeimbang(), penggunaId)
    await postingEntri(a.id, penggunaId)

    expect((await daftarEntri({ status: 'draft', halaman: 1, ukuranHalaman: 20 })).data).toHaveLength(1)
    expect((await daftarEntri({ status: 'diposting', halaman: 1, ukuranHalaman: 20 })).data).toHaveLength(1)
    expect((await daftarEntri()).data).toHaveLength(2)
  })

  it('menghapus item jurnal saat draft dihapus', async () => {
    const draft = await buatEntri(entriSeimbang(), penggunaId)
    await hapusDraft(draft.id)
    const sisa = await db.select().from(journalItems).where(eq(journalItems.entryId, draft.id))
    expect(sisa).toHaveLength(0)
  })
})
