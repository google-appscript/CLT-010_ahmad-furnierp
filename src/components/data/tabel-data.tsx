import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type Kolom<T> = {
  kunci: string
  judul: string
  render: (baris: T) => React.ReactNode
  rataKanan?: boolean
  lebar?: string
}

export function TabelData<T>({
  kolom, baris, kunciBaris, pesanKosong = 'Belum ada data.',
}: {
  kolom: Kolom<T>[]
  baris: T[]
  kunciBaris: (baris: T) => string
  pesanKosong?: string
}) {
  if (baris.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        {pesanKosong}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {kolom.map((k) => (
              <TableHead
                key={k.kunci}
                className={cn(k.rataKanan && 'text-right')}
                style={{ width: k.lebar }}
              >
                {k.judul}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {baris.map((b) => (
            <TableRow key={kunciBaris(b)}>
              {kolom.map((k) => (
                <TableCell key={k.kunci} className={cn(k.rataKanan && 'text-right tabular-nums')}>
                  {k.render(b)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
