import { and, eq } from 'drizzle-orm'
import { db } from '@/db/klien'
import { projects, customerInvoices, projectTasks } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, tambah, type Uang } from '@/lib/uang'
import { ringkasanFaktur } from '@/modules/penjualan/layanan/faktur'
import { profitabilitasProyek } from './laporan'

const DESIMAL = 2

export type KesiapanKunci = {
  siap: boolean
  /** Alasan mengapa belum siap, kosong bila sudah siap. */
  penghalang: string[]
  jumlahFaktur: number
  totalDifakturkan: Uang
  totalDiterima: Uang
  sisaPiutang: Uang
}

/**
 * Memeriksa apakah proyek sudah boleh dikunci.
 *
 * Dipisahkan dari penguncian itu sendiri supaya antarmuka dapat menerangkan
 * apa yang masih kurang, alih-alih hanya menolak saat tombol ditekan.
 */
export async function kesiapanKunci(proyekId: string): Promise<KesiapanKunci> {
  const [proyek] = await db.select().from(projects)
    .where(eq(projects.id, proyekId)).limit(1)
  if (!proyek) throw new ValidasiError('Proyek tidak ditemukan')

  const penghalang: string[] = []

  if (proyek.status === 'terkunci') penghalang.push('Proyek ini sudah terkunci')
  if (proyek.status === 'dibatalkan') penghalang.push('Proyek sudah dibatalkan')
  if (proyek.status === 'draft') penghalang.push('Proyek belum dimulai')

  if (proyek.status === 'berjalan') {
    const terbuka = await db.select({ id: projectTasks.id }).from(projectTasks)
      .where(and(
        eq(projectTasks.proyekId, proyekId),
        eq(projectTasks.status, 'berjalan'),
      ))
    const belumMulai = await db.select({ id: projectTasks.id }).from(projectTasks)
      .where(and(
        eq(projectTasks.proyekId, proyekId),
        eq(projectTasks.status, 'belum_mulai'),
      ))
    const sisa = terbuka.length + belumMulai.length
    penghalang.push(
      sisa > 0
        ? `Pekerjaan belum selesai — masih ada ${sisa} tugas terbuka`
        : 'Proyek belum diselesaikan',
    )
  }

  const faktur = await db.select().from(customerInvoices)
    .where(and(
      eq(customerInvoices.soId, proyek.soId),
      eq(customerInvoices.status, 'diposting'),
    ))

  let difakturkan = '0'
  let diterima = '0'
  let sisaPiutang = '0'
  for (const f of faktur) {
    const ringkasan = await ringkasanFaktur(f.id)
    if (!ringkasan) continue
    difakturkan = tambah(difakturkan, ringkasan.totalDiterima)
    diterima = tambah(diterima, ringkasan.terbayar)
    sisaPiutang = tambah(sisaPiutang, ringkasan.sisa)
  }

  if (faktur.length === 0) {
    penghalang.push('Belum ada faktur terposting atas pesanan proyek ini')
  } else if (Number(sisaPiutang) > 0) {
    penghalang.push(
      `Masih ada piutang belum lunas sebesar ${bulatkan(sisaPiutang, DESIMAL)}`,
    )
  }

  return {
    siap: penghalang.length === 0,
    penghalang,
    jumlahFaktur: faktur.length,
    totalDifakturkan: bulatkan(difakturkan, DESIMAL),
    totalDiterima: bulatkan(diterima, DESIMAL),
    sisaPiutang: bulatkan(sisaPiutang, DESIMAL),
  }
}

/**
 * Mengunci job costing sebuah proyek.
 *
 * Penguncian hanya boleh setelah pekerjaannya selesai dan seluruh fakturnya
 * lunas — itulah arti "terkunci pasca-lunas". Angka pada saat itu dibekukan
 * ke proyeknya sendiri, bukan dihitung ulang setiap laporan dibuka: harga
 * pokok rata-rata bergerak setiap ada pembelian baru, dan tanpa snapshot
 * laba proyek yang sudah tuntas akan ikut bergeser.
 *
 * Setelah terkunci, item jurnal baru tidak dapat lagi ditandai ke proyek ini.
 */
export async function kunciProyek(proyekId: string, olehPengguna: string): Promise<void> {
  const kesiapan = await kesiapanKunci(proyekId)
  if (!kesiapan.siap) {
    throw new ValidasiError(
      `Proyek belum dapat dikunci. ${kesiapan.penghalang.join('; ')}.`,
    )
  }

  // Dihitung terakhir kali sebelum dibekukan.
  const angka = await profitabilitasProyek(proyekId)

  await db.update(projects).set({
    status: 'terkunci',
    pendapatanFinal: angka.pendapatan,
    hargaPokokFinal: angka.hargaPokok,
    bebanLainFinal: angka.bebanLain,
    biayaTenagaKerjaFinal: angka.biayaTenagaKerja,
    totalJamFinal: angka.totalJam,
    labaFinal: angka.laba,
    dikunciPada: new Date(),
    dikunciOleh: olehPengguna,
    diubahPada: new Date(),
  }).where(eq(projects.id, proyekId))
}

/**
 * Membuka kembali proyek yang terkunci.
 *
 * Disediakan karena koreksi yang sah kadang baru ketahuan setelah penguncian,
 * dan tanpa jalan keluar satu-satunya pilihan adalah membiarkan angka yang
 * keliru. Snapshot dibuang supaya laporan kembali menghitung dari data
 * sebenarnya, dan tindakan ini tercatat di log aktivitas.
 */
export async function bukaKunciProyek(proyekId: string): Promise<void> {
  const [proyek] = await db.select().from(projects)
    .where(eq(projects.id, proyekId)).limit(1)
  if (!proyek) throw new ValidasiError('Proyek tidak ditemukan')
  if (proyek.status !== 'terkunci') {
    throw new ValidasiError('Hanya proyek terkunci yang dapat dibuka kembali')
  }

  await db.update(projects).set({
    status: 'selesai',
    pendapatanFinal: null,
    hargaPokokFinal: null,
    bebanLainFinal: null,
    biayaTenagaKerjaFinal: null,
    totalJamFinal: null,
    labaFinal: null,
    dikunciPada: null,
    dikunciOleh: null,
    diubahPada: new Date(),
  }).where(eq(projects.id, proyekId))
}
