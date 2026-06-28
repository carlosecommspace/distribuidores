'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { formatUSD, formatRelative } from '@/lib/utils'
import { Inbox, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RequestItem {
  quantity: number
  product: { id: string; name: string; sku: string }
}
interface ProductRequest {
  id: string
  status: string
  totalUSD: number
  paidUSD: number
  createdAt: string
  client: { id: string; name: string; company?: string | null }
  items: RequestItem[]
}

type Filter = 'open' | 'released' | 'cancelled' | 'all'

export default function RequestsPage() {
  const [items, setItems] = useState<ProductRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('open')

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/requests')
    setItems(await r.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = items.filter((r) => {
    if (filter === 'all') return true
    if (filter === 'open') return !['released', 'cancelled'].includes(r.status)
    return r.status === filter
  })

  const openCount = items.filter((x) => !['released', 'cancelled'].includes(x.status)).length

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle={`${openCount} ${openCount === 1 ? 'pedido abierto' : 'pedidos abiertos'}`}
      />

      <Card>
        <div className="px-4 sm:px-5 py-4 border-b border-border flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-surface-2 border border-border rounded-md overflow-x-auto">
            {[
              { v: 'open', l: 'Abiertos' },
              { v: 'released', l: 'Liberados' },
              { v: 'cancelled', l: 'Cancelados' },
              { v: 'all', l: 'Todos' },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v as Filter)}
                className={cn(
                  'px-3 py-1 text-xs rounded whitespace-nowrap',
                  filter === f.v ? 'bg-accent text-black' : 'text-text-secondary hover:text-text-primary',
                )}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>

        <CardBody className="p-0">
          {loading ? (
            <div className="p-6 flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Inbox size={32} />}
              title="Sin pedidos"
              description="Los pedidos del portal de tus clientes aparecerán aquí."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Fecha</TH>
                  <TH>Cliente</TH>
                  <TH className="text-right">Productos</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right">Pagado</TH>
                  <TH>Estado</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((r) => {
                  const outstanding = Math.max(0, r.totalUSD - r.paidUSD)
                  return (
                    <TR key={r.id}>
                      <TD className="text-xs text-text-secondary">{formatRelative(r.createdAt)}</TD>
                      <TD>
                        <Link href={`/requests/${r.id}`} className="hover:text-accent">
                          <div className="text-sm text-text-primary">{r.client.name}</div>
                          {r.client.company && <div className="text-xs text-text-muted">{r.client.company}</div>}
                        </Link>
                      </TD>
                      <TD className="text-right text-xs text-text-secondary">
                        {r.items.length} ·{' '}
                        {r.items.reduce((a, i) => a + i.quantity, 0)} unid.
                      </TD>
                      <TD className="text-right font-mono text-accent">{formatUSD(r.totalUSD)}</TD>
                      <TD className="text-right font-mono text-text-secondary">
                        {formatUSD(r.paidUSD)}
                        {outstanding > 0 && r.status !== 'cancelled' && (
                          <div className="text-[10px] text-warning">resta {formatUSD(outstanding)}</div>
                        )}
                      </TD>
                      <TD>{statusBadge(r.status)}</TD>
                      <TD className="text-right">
                        <Link href={`/requests/${r.id}`} className="text-text-muted hover:text-accent inline-flex p-1">
                          <ChevronRight size={16} />
                        </Link>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function statusBadge(status: string) {
  const map: Record<string, { tone: 'neutral' | 'warning' | 'info' | 'success' | 'danger'; label: string }> = {
    pending: { tone: 'warning', label: 'Pendiente' },
    partially_paid: { tone: 'info', label: 'Parcial' },
    paid: { tone: 'success', label: 'Pagado' },
    released: { tone: 'success', label: 'Liberado' },
    cancelled: { tone: 'danger', label: 'Cancelado' },
  }
  const m = map[status] || { tone: 'neutral', label: status }
  return <Badge tone={m.tone}>{m.label}</Badge>
}
