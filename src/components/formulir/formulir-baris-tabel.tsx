import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type Kolom<T> = {
  kunci: string
  judul: string
  render: (baris: T, index: number) => React.ReactNode
  lebar?: string
  rataKanan?: boolean
}

export function FormulirBarisTabel<T,>({
  kolom, baris, onTambahBaris, onHapusBaris, labelTambah, minimalBaris, readOnly,
}: {
  kolom: Kolom<T>[]
  baris: T[]
  onTambahBaris?: () => void
  onHapusBaris?: (index: number) => void
  labelTambah?: string
  minimalBaris?: number
  readOnly?: boolean
}) {
  return (
    <div>
      {!readOnly && onTambahBaris && (
        <div className="mb-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onTambahBaris}>
            <Plus className="mr-2 h-4 w-4" />{labelTambah ?? 'Tambah Baris'}
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {kolom.map((k) => (
                <TableHead key={k.kunci} className={cn(k.lebar, k.rataKanan && 'text-right')}>
                  {k.judul}
                </TableHead>
              ))}
              {onHapusBaris && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {baris.map((b, i) => (
              <TableRow key={i}>
                {kolom.map((k) => (
                  <TableCell key={k.kunci} className={cn(k.lebar, k.rataKanan && 'text-right')}>
                    {k.render(b, i)}
                  </TableCell>
                ))}
                {onHapusBaris && (
                  <TableCell>
                    <Button
                      type="button" variant="ghost" size="icon"
                      onClick={() => onHapusBaris(i)}
                      disabled={baris.length <= (minimalBaris ?? 1)}
                      aria-label={`Hapus baris ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
