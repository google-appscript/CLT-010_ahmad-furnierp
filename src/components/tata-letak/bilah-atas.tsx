import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TombolTema } from './tombol-tema'
import { aksiKeluar } from './aksi-keluar'

export function BilahAtas({ nama, email }: { nama: string; email: string }) {
  const inisial = nama.split(' ').map((k) => k[0]).slice(0, 2).join('').toUpperCase()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Search className="h-4 w-4" />
        Tekan <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Ctrl</kbd>
        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">K</kbd> untuk mencari menu
      </p>

      <div className="flex items-center gap-1">
        <TombolTema />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {inisial}
              </span>
              <span className="hidden sm:inline">{nama}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium">{nama}</p>
              <p className="text-xs font-normal text-muted-foreground">{email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <form action={aksiKeluar}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full cursor-pointer text-left">Keluar</button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
