import { db } from '@/db/klien'
import { journals, journalMappings } from '@/db/schema'
import { PEMETAAN_JURNAL_BAWAAN } from '@/db/seed/pemetaan'

/**
 * Menyeed pemetaan jurnal untuk fixture uji.
 *
 * Sejak pemilihan jurnal dipindahkan dari kode ke data, setiap fixture yang
 * memicu posting otomatis perlu punya pemetaannya. Jurnal yang tidak ada di
 * fixture dilewati, dan yang tersisa jatuh ke jurnal pertama yang tersedia
 * supaya uji tidak perlu menyiapkan seluruh jurnal standar hanya untuk
 * menguji satu alur.
 */
export async function seedPemetaanJurnal(): Promise<void> {
  const daftar = await db.select().from(journals)
  if (daftar.length === 0) return

  const lewatKode = new Map(daftar.map((j) => [j.kode, j.id]))
  const cadangan = daftar[0].id

  await db.insert(journalMappings).values(
    PEMETAAN_JURNAL_BAWAAN.map((m) => ({
      kode: m.kode,
      nama: m.nama,
      deskripsi: m.deskripsi,
      journalId: lewatKode.get(m.jurnal) ?? cadangan,
    })),
  ).onConflictDoNothing()
}
