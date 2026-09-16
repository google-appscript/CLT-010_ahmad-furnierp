import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { db, type Transaksi } from '@/db/klien'
import { timesheets, projects, projectTasks, partners, workOrders } from '@/db/schema'
import { ValidasiError } from '@/lib/galat'
import { bulatkan, kali, tambah, type Uang } from '@/lib/uang'
import { skemaTimesheet, type MasukanTimesheet } from '../validasi/proyek'

export type Timesheet = typeof timesheets.$inferSelect

const DESIMAL_KUANTITAS = 2
const DESIMAL_NILAI = 2

/** Perintah produksi yang sudah selesai tidak lagi menerima upah baru. */
const STATUS_WO_TERTUTUP = ['selesai', 'dibatalkan'] as const

function urai(masukan: MasukanTimesheet) {
  const hasil = skemaTimesheet.safeParse(masukan)
  if (!hasil.success) throw new ValidasiError(hasil.error.issues[0].message)
  return hasil.data
}

/**
 * Proyek yang sudah selesai, dibatalkan, atau terkunci tidak boleh menerima
 * baris timesheet baru maupun perubahan — job costing yang sudah dikunci
 * tidak boleh kedatangan biaya tenaga kerja baru secara diam-diam.
 */
function wajibProyekTerbuka(proyek: typeof projects.$inferSelect) {
  if (proyek.status === 'draft') {
    throw new ValidasiError(`Proyek ${proyek.kode} belum dimulai`)
  }
  if (proyek.status === 'selesai' || proyek.status === 'dibatalkan' || proyek.status === 'terkunci') {
    throw new ValidasiError(`Proyek ${proyek.kode} sudah ditutup`)
  }
}

/**
 * Membaca pegawai beserta tarif yang berlaku, lalu memeriksa kewajaran
 * kuantitasnya terhadap satuan tarif itu. Batas ini tidak bisa ditegakkan di
 * skema Zod karena satuannya baru diketahui setelah pegawainya dibaca.
 */
async function pegawaiDanTarif(
  tx: Transaksi, pegawaiId: string, kuantitas: string,
): Promise<{ tarif: string; satuanTarif: 'harian' | 'jam' }> {
  const [pegawai] = await tx.select().from(partners)
    .where(eq(partners.id, pegawaiId)).limit(1)
  if (!pegawai) throw new ValidasiError('Pegawai tidak ditemukan')
  if (!pegawai.isPegawai) {
    throw new ValidasiError(`${pegawai.nama} bukan pegawai sehingga jam kerjanya tidak dapat dicatat`)
  }
  if (!pegawai.isActive) {
    throw new ValidasiError(`Pegawai ${pegawai.nama} sudah tidak aktif`)
  }

  const batas = pegawai.satuanTarif === 'jam' ? 24 : 1
  if (Number(kuantitas) > batas) {
    throw new ValidasiError(
      pegawai.satuanTarif === 'jam'
        ? 'Satu baris timesheet tidak boleh lebih dari 24 jam'
        : `${pegawai.nama} diupah harian, jadi satu baris paling banyak 1 hari. ` +
          'Tulis 0,5 untuk setengah hari.',
    )
  }

  return { tarif: pegawai.tarif, satuanTarif: pegawai.satuanTarif }
}

/**
 * Memastikan perintah produksi yang dipilih memang milik proyek ini dan masih
 * terbuka. Upah yang menempel pada perintah yang sudah selesai tidak akan
 * pernah terserap ke harga pokok, sehingga akan hilang dari perhitungan.
 */
async function wajibPerintahProduksiSah(
  tx: Transaksi, woId: string, proyekId: string,
): Promise<void> {
  const [perintah] = await tx.select().from(workOrders)
    .where(eq(workOrders.id, woId)).limit(1)
  if (!perintah) throw new ValidasiError('Perintah produksi tidak ditemukan')
  if (perintah.proyekId !== proyekId) {
    throw new ValidasiError('Perintah produksi yang dipilih bukan milik proyek ini')
  }
  if ((STATUS_WO_TERTUTUP as readonly string[]).includes(perintah.status)) {
    throw new ValidasiError(
      `Perintah produksi ${perintah.nomor ?? ''} sudah ditutup sehingga tidak dapat ` +
      'lagi menyerap upah baru.',
    )
  }
}

export type TimesheetLengkap = Timesheet & {
  kodeProyek: string
  namaProyek: string
  namaTugas: string | null
  namaPegawai: string
  nomorPerintahProduksi: string | null
  biaya: Uang
}

export async function daftarTimesheet(saring: {
  proyekId?: string
  pegawaiId?: string
  woId?: string
  dari?: string
  sampai?: string
} = {}): Promise<TimesheetLengkap[]> {
  const syarat = []
  if (saring.proyekId) syarat.push(eq(timesheets.proyekId, saring.proyekId))
  if (saring.pegawaiId) syarat.push(eq(timesheets.pegawaiId, saring.pegawaiId))
  if (saring.woId) syarat.push(eq(timesheets.woId, saring.woId))
  if (saring.dari) syarat.push(gte(timesheets.tanggal, saring.dari))
  if (saring.sampai) syarat.push(lte(timesheets.tanggal, saring.sampai))

  const baris = await db
    .select({
      timesheet: timesheets,
      kodeProyek: projects.kode,
      namaProyek: projects.nama,
      namaTugas: projectTasks.nama,
      namaPegawai: partners.nama,
      nomorPerintahProduksi: workOrders.nomor,
    })
    .from(timesheets)
    .innerJoin(projects, eq(projects.id, timesheets.proyekId))
    .innerJoin(partners, eq(partners.id, timesheets.pegawaiId))
    .leftJoin(projectTasks, eq(projectTasks.id, timesheets.tugasId))
    .leftJoin(workOrders, eq(workOrders.id, timesheets.woId))
    .where(syarat.length > 0 ? and(...syarat) : undefined)
    .orderBy(desc(timesheets.tanggal), asc(projects.kode))

  return baris.map((b) => ({
    ...b.timesheet,
    kodeProyek: b.kodeProyek,
    namaProyek: b.namaProyek,
    namaTugas: b.namaTugas,
    namaPegawai: b.namaPegawai,
    nomorPerintahProduksi: b.nomorPerintahProduksi,
    biaya: bulatkan(kali(b.timesheet.kuantitas, b.timesheet.tarif), DESIMAL_NILAI),
  }))
}

/**
 * Mencatat pekerjaan. Tarif beserta satuannya disalin dari pegawai saat baris
 * ini dibuat, bukan dibaca ulang saat laporan disusun — menaikkan upah tidak
 * boleh mengubah biaya pekerjaan yang sudah lewat.
 */
export async function catatTimesheet(
  masukan: MasukanTimesheet, dicatatOleh: string,
): Promise<Timesheet> {
  const data = urai(masukan)

  return db.transaction(async (tx) => {
    const [proyek] = await tx.select().from(projects)
      .where(eq(projects.id, data.proyekId)).limit(1)
    if (!proyek) throw new ValidasiError('Proyek tidak ditemukan')
    wajibProyekTerbuka(proyek)
    if (data.tanggal < proyek.tanggalMulai) {
      throw new ValidasiError('Tanggal timesheet tidak boleh mendahului tanggal mulai proyek')
    }

    if (data.tugasId) {
      const [tugas] = await tx.select().from(projectTasks)
        .where(eq(projectTasks.id, data.tugasId)).limit(1)
      if (!tugas) throw new ValidasiError('Tugas tidak ditemukan')
      if (tugas.proyekId !== data.proyekId) {
        throw new ValidasiError('Tugas yang dipilih bukan milik proyek ini')
      }
    }

    if (data.woId) await wajibPerintahProduksiSah(tx, data.woId, data.proyekId)

    const { tarif, satuanTarif } = await pegawaiDanTarif(tx, data.pegawaiId, data.kuantitas)

    const [baris] = await tx.insert(timesheets).values({
      proyekId: data.proyekId,
      tugasId: data.tugasId,
      pegawaiId: data.pegawaiId,
      woId: data.woId,
      tanggal: data.tanggal,
      kuantitas: data.kuantitas,
      tarif,
      satuanTarif,
      deskripsi: data.deskripsi,
      dicatatOleh,
    }).returning()

    return baris
  })
}

/**
 * Mengubah sebuah baris timesheet yang sudah dicatat. Proyeknya tidak dapat
 * dipindahkan lewat pengubahan ini. Tarif dihitung ulang dari pegawainya hanya
 * bila pegawainya diganti — mengganti pelaksana berarti upahnya memang upah
 * orang lain; sekadar membetulkan tanggal atau uraian tidak boleh menyeret
 * tarif hari ini ke pekerjaan yang sudah lewat.
 */
export async function ubahTimesheet(id: string, masukan: MasukanTimesheet): Promise<Timesheet> {
  const data = urai(masukan)

  return db.transaction(async (tx) => {
    const [baris] = await tx.select().from(timesheets).where(eq(timesheets.id, id)).limit(1)
    if (!baris) throw new ValidasiError('Baris timesheet tidak ditemukan')
    if (data.proyekId !== baris.proyekId) {
      throw new ValidasiError('Proyek pada baris timesheet tidak dapat diubah')
    }

    const [proyek] = await tx.select().from(projects)
      .where(eq(projects.id, baris.proyekId)).limit(1)
    if (!proyek) throw new ValidasiError('Proyek tidak ditemukan')
    wajibProyekTerbuka(proyek)
    if (data.tanggal < proyek.tanggalMulai) {
      throw new ValidasiError('Tanggal timesheet tidak boleh mendahului tanggal mulai proyek')
    }

    if (data.tugasId) {
      const [tugas] = await tx.select().from(projectTasks)
        .where(eq(projectTasks.id, data.tugasId)).limit(1)
      if (!tugas) throw new ValidasiError('Tugas tidak ditemukan')
      if (tugas.proyekId !== data.proyekId) {
        throw new ValidasiError('Tugas yang dipilih bukan milik proyek ini')
      }
    }

    if (data.woId) await wajibPerintahProduksiSah(tx, data.woId, data.proyekId)

    const pegawaiBerganti = data.pegawaiId !== baris.pegawaiId
    const { tarif, satuanTarif } = pegawaiBerganti
      ? await pegawaiDanTarif(tx, data.pegawaiId, data.kuantitas)
      : { tarif: baris.tarif, satuanTarif: baris.satuanTarif }

    // Kuantitas tetap diperiksa terhadap satuan yang berlaku pada baris ini,
    // termasuk saat pegawainya tidak berganti.
    const batas = satuanTarif === 'jam' ? 24 : 1
    if (Number(data.kuantitas) > batas) {
      throw new ValidasiError(
        satuanTarif === 'jam'
          ? 'Satu baris timesheet tidak boleh lebih dari 24 jam'
          : 'Baris berupah harian paling banyak 1 hari. Tulis 0,5 untuk setengah hari.',
      )
    }

    const [diperbarui] = await tx.update(timesheets).set({
      tugasId: data.tugasId,
      pegawaiId: data.pegawaiId,
      woId: data.woId,
      tanggal: data.tanggal,
      kuantitas: data.kuantitas,
      tarif,
      satuanTarif,
      deskripsi: data.deskripsi,
    }).where(eq(timesheets.id, id)).returning()

    return diperbarui
  })
}

export async function hapusTimesheet(id: string): Promise<void> {
  const [baris] = await db.select().from(timesheets).where(eq(timesheets.id, id)).limit(1)
  if (!baris) throw new ValidasiError('Baris timesheet tidak ditemukan')

  const [proyek] = await db.select().from(projects)
    .where(eq(projects.id, baris.proyekId)).limit(1)
  if (proyek) wajibProyekTerbuka(proyek)

  await db.delete(timesheets).where(eq(timesheets.id, id))
}

export type RekapTimesheet = {
  totalHari: Uang
  totalJam: Uang
  /** Upah yang tertaut perintah produksi; sudah menjadi harga pokok. */
  biayaTerserap: Uang
  /** Upah yang tidak melewati produksi; masih angka manajerial. */
  biayaBelumTerserap: Uang
  totalBiaya: Uang
}

function rekapDari(
  baris: { kuantitas: string; tarif: string; satuanTarif: 'harian' | 'jam'; woId: string | null }[],
): RekapTimesheet {
  const nilai = (b: typeof baris[number]) => kali(b.kuantitas, b.tarif)

  const terserap = baris.filter((b) => b.woId !== null)
  const belum = baris.filter((b) => b.woId === null)

  const biayaTerserap = bulatkan(tambah(...terserap.map(nilai)), DESIMAL_NILAI)
  const biayaBelumTerserap = bulatkan(tambah(...belum.map(nilai)), DESIMAL_NILAI)

  return {
    totalHari: bulatkan(
      tambah(...baris.filter((b) => b.satuanTarif === 'harian').map((b) => b.kuantitas)),
      DESIMAL_KUANTITAS,
    ),
    totalJam: bulatkan(
      tambah(...baris.filter((b) => b.satuanTarif === 'jam').map((b) => b.kuantitas)),
      DESIMAL_KUANTITAS,
    ),
    biayaTerserap,
    biayaBelumTerserap,
    totalBiaya: bulatkan(tambah(biayaTerserap, biayaBelumTerserap), DESIMAL_NILAI),
  }
}

export async function rekapTimesheetProyek(proyekId: string): Promise<RekapTimesheet> {
  const baris = await db
    .select({
      kuantitas: timesheets.kuantitas,
      tarif: timesheets.tarif,
      satuanTarif: timesheets.satuanTarif,
      woId: timesheets.woId,
    })
    .from(timesheets).where(eq(timesheets.proyekId, proyekId))

  return rekapDari(baris)
}

export type UpahPerintahProduksi = {
  total: Uang
  /** Nol berarti belum ada timesheet, sehingga angka manual yang berlaku. */
  jumlahBaris: number
}

/**
 * Total upah yang tercatat pada sebuah perintah produksi.
 *
 * Inilah angka yang diserap ke Barang Dalam Proses sebagai biaya tenaga kerja
 * saat perintah diselesaikan. Dibaca di dalam transaksi penyelesaian supaya
 * baris yang masuk di detik terakhir tetap ikut terhitung.
 */
export async function upahPerintahProduksiDalamTx(
  tx: Transaksi, woId: string,
): Promise<UpahPerintahProduksi> {
  const baris = await tx
    .select({ kuantitas: timesheets.kuantitas, tarif: timesheets.tarif })
    .from(timesheets).where(eq(timesheets.woId, woId))

  return {
    total: bulatkan(
      tambah(...baris.map((b) => kali(b.kuantitas, b.tarif))), DESIMAL_NILAI,
    ),
    jumlahBaris: baris.length,
  }
}

export async function upahPerintahProduksi(woId: string): Promise<UpahPerintahProduksi> {
  return db.transaction((tx) => upahPerintahProduksiDalamTx(tx, woId))
}
