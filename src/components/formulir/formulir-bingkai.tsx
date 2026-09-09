import { Fragment } from 'react'
import Link from 'next/link'

export function FormulirBingkai({
  breadcrumb, nomor, status, aksi, children,
}: {
  breadcrumb: { label: string; href?: string }[]
  nomor: string
  status?: React.ReactNode
  aksi?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
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

      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{nomor}</h1>
          {status}
        </div>
        {aksi}
      </div>

      <div className="mt-6 space-y-6">{children}</div>
    </div>
  )
}
