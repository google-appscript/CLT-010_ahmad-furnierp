export function KepalaHalaman({
  judul, deskripsi, aksi,
}: {
  judul: string
  deskripsi?: string
  aksi?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{judul}</h1>
        {deskripsi && <p className="mt-1 text-sm text-muted-foreground">{deskripsi}</p>}
      </div>
      {aksi}
    </div>
  )
}
