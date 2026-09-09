import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db/klien'
import {
  users, roles, permissions, rolePermissions, userRoles,
  companySettings, fiscalYears, currencies, currencyRates,
  accounts, paymentTerms, taxes, journals, sequences,
  uoms, productCategories, products, warehouses, locations,
} from '@/db/schema'
import { daftarKodeIzin } from '@/lib/navigasi'
import { hashKataSandi } from '@/modules/identitas/layanan/kata-sandi'
import {
  BAGAN_AKUN_STANDAR, AKUN_LABA_DITAHAN, AKUN_SELISIH_KURS_UNTUNG,
  AKUN_SELISIH_KURS_RUGI, AKUN_PEMBULATAN, AKUN_PENERIMAAN_BELUM_DITAGIH,
  AKUN_BARANG_DALAM_PROSES,
} from './bagan-akun'
import {
  SATUAN, KATEGORI_PRODUK, GUDANG, LOKASI, URUTAN_GUDANG, PRODUK_CONTOH,
} from './gudang'
import {
  MATA_UANG, KURS_CONTOH, SYARAT_PEMBAYARAN, JURNAL_STANDAR, PAJAK_STANDAR,
  URUTAN_PEMBELIAN, URUTAN_PENJUALAN, URUTAN_MANUFAKTUR,
} from './data-dasar'

/**
 * Seed bersifat idempoten: setiap penyisipan memakai onConflictDoNothing
 * sehingga menjalankannya berulang kali aman dan tidak menggandakan data.
 */
export async function jalankanSeed(): Promise<void> {
  const kataSandi = process.env.SEED_ADMIN_PASSWORD
  if (!kataSandi) {
    throw new Error('SEED_ADMIN_PASSWORD wajib diatur sebelum menjalankan seed')
  }

  // 1. Mata uang dan kurs
  await db.insert(currencies).values(MATA_UANG).onConflictDoNothing()
  await db.insert(currencyRates).values(KURS_CONTOH).onConflictDoNothing()

  // 2. Bagan akun
  await db.insert(accounts).values(
    BAGAN_AKUN_STANDAR.map((a) => ({ ...a, tipeAkun: a.tipeAkun as never })),
  ).onConflictDoNothing()

  // Piutang dan utang usaha ditandai dapat direkonsiliasi agar pelunasannya
  // dapat ditutup terhadap fakturnya.
  await db.update(accounts)
    .set({ dapatDirekonsiliasi: true })
    .where(inArray(accounts.tipeAkun, ['aset_piutang', 'liabilitas_utang_usaha']))

  const akunLewatKode = new Map((await db.select().from(accounts)).map((a) => [a.kode, a.id]))
  function akunId(kode: string): string {
    const id = akunLewatKode.get(kode)
    if (!id) throw new Error(`Akun ${kode} tidak ditemukan setelah seed bagan akun`)
    return id
  }

  // 3. Syarat pembayaran
  await db.insert(paymentTerms).values(SYARAT_PEMBAYARAN).onConflictDoNothing()

  // 4. Pajak
  await db.insert(taxes).values(
    PAJAK_STANDAR.map((p) => ({
      kode: p.kode,
      nama: p.nama,
      ruangLingkup: p.ruangLingkup as never,
      tarif: p.tarif,
      hargaTermasukPajak: p.hargaTermasukPajak,
      isPemotongan: p.isPemotongan,
      akunPajakId: akunId(p.kodeAkun),
    })),
  ).onConflictDoNothing()

  // 5. Jurnal beserta urutan penomorannya, masing-masing dalam satu transaksi
  for (const j of JURNAL_STANDAR) {
    const [sudahAda] = await db.select({ id: journals.id }).from(journals)
      .where(eq(journals.kode, j.kode)).limit(1)
    if (sudahAda) continue

    await db.transaction(async (tx) => {
      const [urutan] = await tx.insert(sequences).values({
        kode: `jurnal:${j.kode}`,
        prefix: j.prefixNomor,
        panjangDigit: 4,
        nomorBerikut: 1,
        reset: j.resetNomor as never,
      }).returning()

      await tx.insert(journals).values({
        kode: j.kode, nama: j.nama, tipe: j.tipe as never, sequenceId: urutan.id,
      })
    })
  }

  // 6. Pengaturan perusahaan
  const [pengaturan] = await db.select().from(companySettings).limit(1)
  if (!pengaturan) {
    await db.insert(companySettings).values({
      nama: 'PT Furni Nusantara',
      mataUangFungsional: 'IDR',
      bulanAwalTahunBuku: 1,
      akunLabaDitahanId: akunId(AKUN_LABA_DITAHAN),
      akunSelisihKursUntungId: akunId(AKUN_SELISIH_KURS_UNTUNG),
      akunSelisihKursRugiId: akunId(AKUN_SELISIH_KURS_RUGI),
      akunPembulatanId: akunId(AKUN_PEMBULATAN),
      akunPenerimaanBelumDitagihId: akunId(AKUN_PENERIMAAN_BELUM_DITAGIH),
      akunBarangDalamProsesId: akunId(AKUN_BARANG_DALAM_PROSES),
    })
  } else {
    // Basis data yang sudah di-seed sebelum fase berikutnya belum punya
    // penampung yang diperkenalkan fase itu; isi yang masih kosong saja.
    const tambahan: Record<string, string> = {}
    if (!pengaturan.akunPenerimaanBelumDitagihId) {
      tambahan.akunPenerimaanBelumDitagihId = akunId(AKUN_PENERIMAAN_BELUM_DITAGIH)
    }
    if (!pengaturan.akunBarangDalamProsesId) {
      tambahan.akunBarangDalamProsesId = akunId(AKUN_BARANG_DALAM_PROSES)
    }
    if (Object.keys(tambahan).length > 0) {
      await db.update(companySettings).set(tambahan)
        .where(eq(companySettings.id, pengaturan.id))
    }
  }

  // 7. Tahun buku
  await db.insert(fiscalYears).values({
    nama: 'Tahun Buku 2026',
    tanggalMulai: '2026-01-01',
    tanggalSelesai: '2026-12-31',
    status: 'terbuka',
  }).onConflictDoNothing()

  // 8. Izin — seluruh kode dari tujuh fase, ditambah wildcard superuser
  const kodeIzin = ['*', ...daftarKodeIzin()]
  await db.insert(permissions).values(
    kodeIzin.map((kode) => ({
      kode,
      modul: kode === '*' ? 'sistem' : kode.split('.')[0],
      deskripsi: kode === '*' ? 'Akses penuh ke seluruh modul' : null,
    })),
  ).onConflictDoNothing()

  // 9. Peran superuser
  await db.insert(roles).values({
    kode: 'superuser', nama: 'Superuser', isSystem: true,
  }).onConflictDoNothing()

  const [peranSuperuser] = await db.select().from(roles).where(eq(roles.kode, 'superuser')).limit(1)
  const [izinWildcard] = await db.select().from(permissions).where(eq(permissions.kode, '*')).limit(1)
  await db.insert(rolePermissions).values({
    roleId: peranSuperuser.id, permissionId: izinWildcard.id,
  }).onConflictDoNothing()

  // 10. Pengguna administrator
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@furni.local'
  const [sudahAda] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  const pengguna = sudahAda ?? (await db.insert(users).values({
    email, nama: 'Administrator', passwordHash: await hashKataSandi(kataSandi),
  }).returning())[0]

  await db.insert(userRoles).values({
    userId: pengguna.id, roleId: peranSuperuser.id,
  }).onConflictDoNothing()

  // 11. Satuan
  await db.insert(uoms).values(
    SATUAN.map((u) => ({ ...u, kategori: u.kategori as never })),
  ).onConflictDoNothing()

  // 12. Kategori produk
  await db.insert(productCategories).values(
    KATEGORI_PRODUK.map((k) => ({
      kode: k.kode,
      nama: k.nama,
      akunPersediaanId: akunId(k.akunPersediaan),
      akunHppId: akunId(k.akunHpp),
      akunSelisihId: akunId(k.akunSelisih),
      akunBarangRusakId: akunId(k.akunBarangRusak),
    })),
  ).onConflictDoNothing()

  // 13. Gudang dan lokasi
  await db.insert(warehouses).values(GUDANG).onConflictDoNothing()
  const [gudang] = await db.select().from(warehouses)
    .where(eq(warehouses.kode, GUDANG.kode)).limit(1)

  await db.insert(locations).values(
    LOKASI.map((l) => ({
      kode: l.kode,
      nama: l.nama,
      tipe: l.tipe as never,
      warehouseId: l.diGudang ? gudang.id : null,
    })),
  ).onConflictDoNothing()

  // 14. Urutan penomoran dokumen gudang
  await db.insert(sequences).values(
    [
      ...URUTAN_GUDANG, ...URUTAN_PEMBELIAN, ...URUTAN_PENJUALAN, ...URUTAN_MANUFAKTUR,
    ].map((u) => ({
      kode: u.kode, prefix: u.prefix, panjangDigit: 4,
      nomorBerikut: 1, reset: u.reset as never,
    })),
  ).onConflictDoNothing()

  // 15. Produk contoh
  const kategoriLewatKode = new Map(
    (await db.select().from(productCategories)).map((k) => [k.kode, k.id]),
  )
  const satuanLewatKode = new Map((await db.select().from(uoms)).map((u) => [u.kode, u.id]))

  await db.insert(products).values(
    PRODUK_CONTOH.map((p) => ({
      kode: p.kode,
      nama: p.nama,
      tipe: 'disimpan' as const,
      kategoriId: kategoriLewatKode.get(p.kategori)!,
      uomId: satuanLewatKode.get(p.satuan)!,
      hargaJual: p.hargaJual,
    })),
  ).onConflictDoNothing()
}
