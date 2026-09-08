import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormulirMasuk } from './formulir'

export const metadata = { title: 'Masuk' }

export default function HalamanMasuk() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Masuk ke ERP Furni</CardTitle>
        <CardDescription>Gunakan akun yang diberikan administrator.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormulirMasuk />
      </CardContent>
    </Card>
  )
}
