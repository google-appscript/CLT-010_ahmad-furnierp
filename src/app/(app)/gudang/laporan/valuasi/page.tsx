import { eq, inArray } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { productCategories, accounts, journalItems, journalEntries } from '@/db/schema'
import { valuasiPerKategori } from '@/modules/gudang/repositori/stok'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Valuasi Persediaan' }

export default async function HalamanValuasi() {
  await wajibIzin('gudang.laporan.valuasi')

  const valuasi = await valuasiPerKategori()
  const kategori = await db.select().from(productCategories)
  const akunPersediaan = [...new Set(kategori.map((k) => k.akunPersediaanId))]

  // Saldo buku besar dihitung agar penyimpangan antara persediaan dan
  // akuntansi terlihat langsung, bukan baru ketahuan saat tutup buku.
  const item = akunPersediaan.length > 0
    ? await db
        .select({ akunId: journalItems.accountId, debit: journalItems.debit, kredit: journalItems.kredit })
        .from(journalItems)
        .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
        .where(inArray(journalItems.accountId, akunPersediaan))
    : []

  const saldoLewatAkun = new Map<string, number>()
  for (const b of item) {
    saldoLewatAkun.set(
      b.akunId, (saldoLewatAkun.get(b.akunId) ?? 0) + Number(b.debit) - Number(b.kredit),
    )
  }

  const namaAkun = new Map(
    (await db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama }).from(accounts))
      .map((a) => [a.id, `${a.kode} — ${a.nama}`]),
  )

  const baris = kategori.map((k) => {
    const nilai = Number(valuasi.find((v) => v.kategoriId === k.id)?.nilai ?? 0)
    const saldo = saldoLewatAkun.get(k.akunPersediaanId) ?? 0
    return {
      id: k.id, kode: k.kode, nama: k.nama,
      akun: namaAkun.get(k.akunPersediaanId) ?? '—',
      nilai, saldo, selisih: saldo - nilai,
    }
  })

  const totalNilai = baris.reduce((t, b) => t + b.nilai, 0)

  return (
    <>
      <KepalaHalaman
        judul="Valuasi Persediaan"
        deskripsi="Nilai persediaan per kategori, dibandingkan dengan saldo akun persediaannya di buku besar."
      />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kode</th>
              <th className="px-4 py-2 text-left font-medium">Kategori</th>
              <th className="px-4 py-2 text-left font-medium">Akun Persediaan</th>
              <th className="px-4 py-2 text-right font-medium">Nilai Persediaan</th>
              <th className="px-4 py-2 text-right font-medium">Saldo Buku Besar</th>
              <th className="px-4 py-2 text-right font-medium">Selisih</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.id} className="border-b">
                <td className="px-4 py-1.5 font-mono text-xs">{b.kode}</td>
                <td className="px-4 py-1.5">{b.nama}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{b.akun}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(b.nilai.toFixed(2))}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(b.saldo.toFixed(2))}
                </td>
                <td className={`px-4 py-1.5 text-right tabular-nums ${
                  Math.abs(b.selisih) >= 0.01 ? 'font-medium text-destructive' : ''
                }`}>
                  {formatAngka(b.selisih.toFixed(2))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/40 font-semibold">
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatAngka(totalNilai.toFixed(2))}
              </td>
              <td colSpan={2} className="px-4 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Kolom selisih seharusnya nol. Nilai selain nol berarti ada pergerakan stok yang tidak
        terbukukan atau jurnal persediaan yang dibuat manual di luar modul gudang.
      </p>
    </>
  )
}
