import { eq, inArray } from 'drizzle-orm'
import { wajibIzin } from '@/lib/sesi'
import { db } from '@/db/klien'
import { accounts, journalEntries, journalItems } from '@/db/schema'
import { daftarAset, daftarKategoriAset, ringkasanAset } from '@/modules/aset/layanan/aset'
import { formatAngka } from '@/lib/uang'
import { KepalaHalaman } from '@/components/data/kepala-halaman'

export const metadata = { title: 'Laporan Aset' }

export default async function HalamanLaporanAset() {
  await wajibIzin('akuntansi.aset.laporan')

  const [aset, kategori] = await Promise.all([daftarAset(), daftarKategoriAset()])
  const dengan = await Promise.all(aset.map(async (a) => (await ringkasanAset(a.id))!))

  // Saldo buku besar dibaca agar penyimpangan antara register aset dan
  // akuntansi terlihat langsung, bukan baru ketahuan saat tutup buku.
  const akunDipakai = [
    ...new Set([
      ...kategori.map((k) => k.akunAsetId),
      ...kategori.map((k) => k.akunAkumulasiId).filter((x): x is string => !!x),
    ]),
  ]

  const item = akunDipakai.length > 0
    ? await db
        .select({
          akunId: journalItems.accountId,
          debit: journalItems.debit,
          kredit: journalItems.kredit,
        })
        .from(journalItems)
        .innerJoin(journalEntries, eq(journalEntries.id, journalItems.entryId))
        .where(inArray(journalItems.accountId, akunDipakai))
    : []

  const saldoAkun = new Map<string, number>()
  for (const i of item) {
    saldoAkun.set(i.akunId, (saldoAkun.get(i.akunId) ?? 0) + Number(i.debit) - Number(i.kredit))
  }

  const namaAkun = new Map(
    (await db.select({ id: accounts.id, kode: accounts.kode, nama: accounts.nama }).from(accounts))
      .map((a) => [a.id, `${a.kode} — ${a.nama}`]),
  )

  const baris = kategori.map((k) => {
    // Aset yang sudah dilepas tidak lagi ada di neraca, jadi tidak dihitung.
    const milikKategori = dengan.filter(
      (a) => a.kategoriId === k.id && a.status !== 'dilepas',
    )
    const perolehan = milikKategori.reduce((t, a) => t + Number(a.nilaiPerolehan), 0)
    const akumulasi = milikKategori.reduce((t, a) => t + Number(a.akumulasi), 0)

    const saldoAset = saldoAkun.get(k.akunAsetId) ?? 0
    // Akumulasi bersaldo kredit di buku besar; dibalik agar sebanding.
    const saldoAkumulasi = k.akunAkumulasiId ? -(saldoAkun.get(k.akunAkumulasiId) ?? 0) : 0

    return {
      id: k.id,
      kode: k.kode,
      nama: k.nama,
      jumlah: milikKategori.length,
      perolehan,
      akumulasi,
      nilaiBuku: perolehan - akumulasi,
      akunAset: namaAkun.get(k.akunAsetId) ?? '—',
      selisihPerolehan: saldoAset - perolehan,
      selisihAkumulasi: saldoAkumulasi - akumulasi,
    }
  })

  const total = baris.reduce(
    (t, b) => ({
      jumlah: t.jumlah + b.jumlah,
      perolehan: t.perolehan + b.perolehan,
      akumulasi: t.akumulasi + b.akumulasi,
      nilaiBuku: t.nilaiBuku + b.nilaiBuku,
    }),
    { jumlah: 0, perolehan: 0, akumulasi: 0, nilaiBuku: 0 },
  )

  const dilepas = dengan.filter((a) => a.status === 'dilepas')

  return (
    <>
      <KepalaHalaman
        judul="Laporan Aset"
        deskripsi="Nilai perolehan, akumulasi depresiasi, dan nilai buku per kategori, dibandingkan dengan saldo akunnya di buku besar."
      />

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kategori</th>
              <th className="px-4 py-2 text-left font-medium">Akun Aset</th>
              <th className="px-4 py-2 text-right font-medium">Jumlah Aset</th>
              <th className="px-4 py-2 text-right font-medium">Nilai Perolehan</th>
              <th className="px-4 py-2 text-right font-medium">Selisih Perolehan</th>
              <th className="px-4 py-2 text-right font-medium">Akumulasi</th>
              <th className="px-4 py-2 text-right font-medium">Selisih Akumulasi</th>
              <th className="px-4 py-2 text-right font-medium">Nilai Buku</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.id} className="border-b">
                <td className="px-4 py-1.5">{b.kode} — {b.nama}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{b.akunAset}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{b.jumlah}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(b.perolehan.toFixed(2))}
                </td>
                <td className={`px-4 py-1.5 text-right tabular-nums ${
                  Math.abs(b.selisihPerolehan) >= 0.01 ? 'font-medium text-destructive' : ''
                }`}>
                  {formatAngka(b.selisihPerolehan.toFixed(2))}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {formatAngka(b.akumulasi.toFixed(2))}
                </td>
                <td className={`px-4 py-1.5 text-right tabular-nums ${
                  Math.abs(b.selisihAkumulasi) >= 0.01 ? 'font-medium text-destructive' : ''
                }`}>
                  {formatAngka(b.selisihAkumulasi.toFixed(2))}
                </td>
                <td className="px-4 py-1.5 text-right font-medium tabular-nums">
                  {formatAngka(b.nilaiBuku.toFixed(2))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/40 font-semibold">
            <tr>
              <td colSpan={2} className="px-4 py-2 text-right">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{total.jumlah}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatAngka(total.perolehan.toFixed(2))}
              </td>
              <td />
              <td className="px-4 py-2 text-right tabular-nums">
                {formatAngka(total.akumulasi.toFixed(2))}
              </td>
              <td />
              <td className="px-4 py-2 text-right tabular-nums">
                {formatAngka(total.nilaiBuku.toFixed(2))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Selisih perolehan yang tidak nol berarti ada nilai di akun aset yang belum terdaftar di
        register — atau sebaliknya. Selisih akumulasi berarti ada depresiasi yang diposting di
        luar modul ini.
      </p>

      {dilepas.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Aset yang Dilepas</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Kode</th>
                  <th className="px-4 py-2 text-left font-medium">Nama</th>
                  <th className="px-4 py-2 text-left font-medium">Tanggal Pelepasan</th>
                  <th className="px-4 py-2 text-right font-medium">Nilai Perolehan</th>
                  <th className="px-4 py-2 text-right font-medium">Akumulasi Saat Dilepas</th>
                  <th className="px-4 py-2 text-right font-medium">Hasil Pelepasan</th>
                  <th className="px-4 py-2 text-right font-medium">Laba / Rugi</th>
                </tr>
              </thead>
              <tbody>
                {dilepas.map((a) => {
                  const nilaiBuku = Number(a.nilaiPerolehan) - Number(a.akumulasi)
                  const labaRugi = Number(a.nilaiPelepasan ?? 0) - nilaiBuku
                  return (
                    <tr key={a.id} className="border-b">
                      <td className="px-4 py-1.5 font-mono text-xs">{a.kode}</td>
                      <td className="px-4 py-1.5">{a.nama}</td>
                      <td className="px-4 py-1.5">{a.tanggalPelepasan}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">
                        {formatAngka(a.nilaiPerolehan)}
                      </td>
                      <td className="px-4 py-1.5 text-right tabular-nums">
                        {formatAngka(a.akumulasi)}
                      </td>
                      <td className="px-4 py-1.5 text-right tabular-nums">
                        {formatAngka(a.nilaiPelepasan ?? '0')}
                      </td>
                      <td className={`px-4 py-1.5 text-right font-medium tabular-nums ${
                        labaRugi < 0 ? 'text-destructive' : ''
                      }`}>
                        {formatAngka(labaRugi.toFixed(2))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
