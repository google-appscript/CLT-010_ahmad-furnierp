/**
 * Kerangka halaman yang tampil selama komponen server menyiapkan datanya.
 *
 * Tanpa berkas ini, berpindah halaman di App Router memblokir sepenuhnya:
 * peramban bertahan di halaman lama sampai seluruh kueri server tuntas, lalu
 * menukar isinya sekaligus. Akibatnya elemen teks pertama baru tergambar
 * setelah seluruh perjalanan bolak-balik ke basis data selesai — itulah yang
 * membuat LCP terukur beberapa detik meski yang digambar hanya sebaris
 * keterangan halaman.
 *
 * Dengan kerangka ini, navigasi langsung menggambar sesuatu dan sisanya
 * menyusul; yang berubah bukan lamanya kueri, melainkan kapan halaman mulai
 * terlihat.
 */
export default function MemuatHalaman() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Memuat halaman">
      <div className="space-y-2">
        <div className="h-7 w-64 rounded bg-muted" />
        <div className="h-4 w-96 max-w-full rounded bg-muted/60" />
      </div>
      <div className="space-y-2 rounded-md border p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 rounded bg-muted/50" />
        ))}
      </div>
    </div>
  )
}
