import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function FormulirNotebook({
  tab, tabAwal,
}: {
  tab: { id: string; label: string; children: React.ReactNode }[]
  tabAwal?: string
}) {
  return (
    <Tabs defaultValue={tabAwal ?? tab[0]?.id}>
      <TabsList variant="line">
        {tab.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
        ))}
      </TabsList>
      {tab.map((t) => (
        <TabsContent key={t.id} value={t.id}>{t.children}</TabsContent>
      ))}
    </Tabs>
  )
}
