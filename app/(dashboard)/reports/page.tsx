'use client'
import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BadgeCheck, Users, ShoppingCart, Inbox, Package, FileText, Printer } from 'lucide-react'

const REPORTS = [
  {
    kind: 'sellers',
    title: 'Vendedores',
    description: 'Actividad, clientes asignados y ventas por vendedor en el rango.',
    icon: BadgeCheck,
  },
  {
    kind: 'clients',
    title: 'Clientes',
    description: 'Cartera de clientes con compras acumuladas y actividad en el rango.',
    icon: Users,
  },
  {
    kind: 'sales',
    title: 'Ventas',
    description: 'Detalle de ventas cerradas con cliente, canal y monto.',
    icon: ShoppingCart,
  },
  {
    kind: 'requests',
    title: 'Pedidos',
    description: 'Pedidos generados en el rango con su estado, saldo y vendedor.',
    icon: Inbox,
  },
  {
    kind: 'inventory',
    title: 'Inventario',
    description: 'Snapshot actual de stock, costo y valor del inventario activo.',
    icon: Package,
  },
] as const

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function isoDaysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function ReportsPage() {
  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(isoToday())

  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle="Generá reportes en PDF listos para imprimir o compartir"
      />

      <Card className="mb-6">
        <CardBody className="flex flex-col md:flex-row md:items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5 block">
              Desde
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input-base"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5 block">
              Hasta
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input-base"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => { setFrom(isoDaysAgo(7)); setTo(isoToday()) }}>7 días</Button>
            <Button variant="ghost" onClick={() => { setFrom(isoDaysAgo(30)); setTo(isoToday()) }}>30 días</Button>
            <Button variant="ghost" onClick={() => { setFrom(isoDaysAgo(90)); setTo(isoToday()) }}>90 días</Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORTS.map((r) => {
          const Icon = r.icon
          const href = `/reports/print/${r.kind}?from=${from}&to=${to}`
          return (
            <Card key={r.kind}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-md bg-accent-subtle border border-accent-border flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-accent" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-base font-semibold text-text-primary">{r.title}</div>
                    <p className="text-xs text-text-secondary mt-1">{r.description}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-1">
                  <Link href={href} target="_blank" rel="noopener" className="flex-1">
                    <Button className="w-full">
                      <Printer size={14} /> Generar PDF
                    </Button>
                  </Link>
                  <Link href={href} target="_blank" rel="noopener">
                    <Button variant="secondary">
                      <FileText size={14} />
                    </Button>
                  </Link>
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <div className="mt-6 text-xs text-text-muted">
        Los reportes se abren en una pestaña nueva con el diálogo de impresión listo. Elegí <span className="font-medium">&quot;Guardar como PDF&quot;</span> como destino para obtener el archivo.
      </div>
    </div>
  )
}
