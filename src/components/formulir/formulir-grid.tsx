export function FormulirGrid({
  kiri, kanan,
}: {
  kiri: React.ReactNode
  kanan: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 gap-x-12 gap-y-4 lg:grid-cols-2">
      <div className="space-y-4">{kiri}</div>
      <div className="space-y-4">{kanan}</div>
    </div>
  )
}
