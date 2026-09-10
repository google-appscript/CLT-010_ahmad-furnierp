import { Label } from '@/components/ui/label'

export function FormulirField({
  label, htmlFor, readOnly, valueTampilan, children,
}: {
  label: string
  htmlFor?: string
  readOnly?: boolean
  valueTampilan?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {readOnly ? (
        <div className="py-1.5 text-sm">{valueTampilan}</div>
      ) : (
        children
      )}
    </div>
  )
}
