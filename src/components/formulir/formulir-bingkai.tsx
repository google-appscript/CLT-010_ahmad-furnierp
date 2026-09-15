import { Fragment } from 'react'
import Link from 'next/link'

/**
 * Bingkai dokumen: bilah kendali di atas, lalu lembar isian di bawahnya.
 *
 * Keduanya sengaja berbeda latar. Bilah kendali menempel pada latar halaman
 * dan memuat hal-hal yang berlaku atas dokumen secara utuh — nomor, status,
 * dan tombol yang mengubah keadaannya. Lembar isian berdiri sebagai kertas
 * tersendiri dan hanya memuat isi dokumennya. Tanpa pemisahan ini tombol
 * "Hapus" terbaca seolah bagian dari formulir, bukan tindakan atas dokumen.
 */
export function FormulirBingkai({
  breadcrumb, nomor, status, aksi, menu, children,
}: {
  breadcrumb: { label: string; href?: string }[]
  nomor: string
  status?: React.ReactNode
  aksi?: React.ReactNode
  /** Menu roda gigi: hapus, duplikat, cetak. */
  menu?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    // `-m-6` membatalkan padding <main> supaya bilah kendali menempel tepi layar.
    <div className="-m-6">
      <div className="sticky top-0 z-20 border-b bg-muted/40 px-6 py-3 backdrop-blur-sm print:border-0 print:bg-transparent">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {breadcrumb.map((item, i) => (
            <Fragment key={i}>
              {i > 0 && <span>/</span>}
              {item.href ? (
                <Link href={item.href} className="text-muted-foreground hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </Fragment>
          ))}
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{nomor}</h1>
            {status}
          </div>
          <div className="flex items-center gap-2">
            {aksi}
            {menu}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div data-lembar className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <div className="space-y-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
