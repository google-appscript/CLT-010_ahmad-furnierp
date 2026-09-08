import { ambilSesi } from '@/lib/sesi'
import { navigasiTerlihat } from '@/lib/navigasi'
import { Sidebar } from '@/components/tata-letak/sidebar'
import { BilahAtas } from '@/components/tata-letak/bilah-atas'
import { BilahMenu } from '@/components/tata-letak/bilah-menu'
import { PaletPerintah } from '@/components/tata-letak/palet-perintah'

export default async function TataLetakAplikasi({ children }: { children: React.ReactNode }) {
  const sesi = await ambilSesi()
  // Menu disaring di server; rute yang tidak diizinkan tidak pernah dikirim
  // ke peramban.
  const menu = navigasiTerlihat(sesi.izin)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar item={menu} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <BilahAtas nama={sesi.nama} email={sesi.email} />
        <BilahMenu item={menu} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <PaletPerintah item={menu} />
    </div>
  )
}
