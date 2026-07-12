'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Stat } from '@/components/ui/Stat'
import { Select } from '@/components/ui/Select'
import { formatUSD, formatBs, formatDateTime } from '@/lib/utils'
import { ShoppingCart, Info, Inbox } from 'lucide-react'

interface Sale {
  id: string
  channel: string
  paymentMethod: string
  paymentStatus: string
  totalUSD: number
  totalBs: number
  createdAt: string
  client?: { name: string } | null
  items: Array<{ quantity: number; product: { name: string } }>
}

export default function SalesPage() {
  const [items, setItems] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [channelFilter, setChannelFilter] = useState('')

  const load = async () => {
    setLoading(true)
    const url = new URL('/api/sales', window.location.origin)
    if (channelFilter) url.searchParams.set('channel', channelFilter)
    const r = await fetch(url.toString())
    setItems(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [channelFilter])

  const stats = useMemo(() => {
    const totalUSD = items.reduce((s, x) => s + x.totalUSD, 0)
    const totalBs = items.reduce((s, x) => s + x.totalBs, 0)
    return { totalUSD, totalBs, count: items.length }
  }, [items])

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle="Historial de ventas cerradas — se generan al liberar un pedido"
        actions={
          <Link href="/requests">
            <Button variant="secondary">
              <Inbox size={14} /> Ir a pedidos
            </Button>
          </Link>
        }
      />

      <div className="bg-info-subtle border border-info/30 rounded-md p-3 mb-6 flex items-start gap-2 text-sm">
        <Info size={16} className="text-info shrink-0 mt-0.5" />
        <div>
          <div className="text-info font-medium">Las ventas se registran desde pedidos</div>
          <div className="text-xs text-text-secondary mt-1">
            Para cerrar una venta, primero creá o abrí un pedido en <Link href="/requests" className="text-accent hover:underline">/requests</Link>,
            cobralo y liberalo. Al liberarlo, se genera automáticamente la venta acá con su pago, canal y cliente.
            Esto asegura que el flujo <span className="font-medium">pedido → pago → despacho → venta</span> quede completo y trazable.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        <Stat label="Total período (USD)" value={formatUSD(stats.totalUSD)} accent />
        <Stat label="Total período (Bs)" value={formatBs(stats.totalBs)} />
        <Stat label="Transacciones" value={stats.count} />
      </div>

      <Card>
        <div className="px-4 sm:px-5 py-4 border-b border-border flex gap-3 items-center flex-wrap">
          <span className="text-xs uppercase tracking-wider text-text-secondary whitespace-nowrap">Filtrar por canal</span>
          <Select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            options={[
              { value: '', label: 'Todos' },
              { value: 'direct', label: 'Directo' },
              { value: 'mercadolibre', label: 'MercadoLibre' },
              { value: 'whatsapp', label: 'WhatsApp' },
              { value: 'phone', label: 'Teléfono' },
              { value: 'other', label: 'Otro' },
            ]}
            className="max-w-[200px]"
          />
        </div>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-6 flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart size={32} />}
              title="Sin ventas todavía"
              description="Cuando liberes un pedido de /requests aparecerá acá como venta cerrada."
              action={<Link href="/requests"><Button><Inbox size={14} /> Ir a pedidos</Button></Link>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Fecha</TH>
                  <TH>Cliente</TH>
                  <TH>Canal</TH>
                  <TH>Productos</TH>
                  <TH>Método</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Total</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((s) => (
                  <TR key={s.id}>
                    <TD className="text-xs text-text-secondary">{formatDateTime(s.createdAt)}</TD>
                    <TD>{s.client?.name || <span className="text-text-muted">Ocasional</span>}</TD>
                    <TD><Badge>{channelLabel(s.channel)}</Badge></TD>
                    <TD className="text-xs text-text-secondary">
                      {s.items.length} {s.items.length === 1 ? 'producto' : 'productos'} · {s.items.reduce((a, i) => a + i.quantity, 0)} unid.
                    </TD>
                    <TD className="text-xs">{paymentLabel(s.paymentMethod)}</TD>
                    <TD>{statusBadge(s.paymentStatus)}</TD>
                    <TD className="text-right font-mono text-accent">{formatUSD(s.totalUSD)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function channelLabel(c: string) {
  return { mercadolibre: 'ML', whatsapp: 'WA', direct: 'Directo', phone: 'Teléfono', other: 'Otro' }[c] || c
}

function paymentLabel(p: string) {
  const map: Record<string, string> = {
    cash_usd: 'Efectivo USD', cash_bs: 'Efectivo Bs', zelle: 'Zelle', binance: 'Binance',
    transfer_bs: 'Transf. Bs', transfer_usd: 'Transf. USD', mixed: 'Mixto',
  }
  return map[p] || p
}

function statusBadge(s: string) {
  if (s === 'paid') return <Badge tone="success">Pagado</Badge>
  if (s === 'pending') return <Badge tone="warning">Pendiente</Badge>
  return <Badge tone="info">Parcial</Badge>
}
