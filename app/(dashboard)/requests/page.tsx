'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import { formatUSD, formatRelative, formatDateTime } from '@/lib/utils'
import { Inbox, CheckCircle, XCircle, Clock } from 'lucide-react'

interface RequestItem {
  id: string
  quantity: number
  priceUSD: number
  subtotalUSD: number
  product: { id: string; name: string; sku: string }
}
interface ProductRequest {
  id: string
  status: 'pending' | 'fulfilled' | 'cancelled'
  notes?: string | null
  totalUSD: number
  createdAt: string
  fulfilledAt?: string | null
  client: { id: string; name: string; company?: string | null }
  items: RequestItem[]
}

export default function RequestsPage() {
  const [items, setItems] = useState<ProductRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'fulfilled' | 'cancelled'>('pending')
  const [open, setOpen] = useState<ProductRequest | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const url = filter === 'all' ? '/api/requests' : `/api/requests?status=${filter}`
    const r = await fetch(url)
    setItems(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const updateStatus = async (id: string, status: 'fulfilled' | 'cancelled' | 'pending') => {
    setSaving(true)
    const r = await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setSaving(false)
    if (!r.ok) {
      toast.error('Error actualizando pedido')
      return
    }
    toast.success(
      status === 'fulfilled' ? 'Pedido marcado como atendido' : status === 'cancelled' ? 'Pedido cancelado' : 'Pedido reabierto'
    )
    setOpen(null)
    load()
  }

  const pendingCount = items.filter((x) => x.status === 'pending').length

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle={`${pendingCount} ${pendingCount === 1 ? 'pedido pendiente' : 'pedidos pendientes'}`}
      />

      <Card>
        <div className="px-4 sm:px-5 py-4 border-b border-border flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-surface-2 border border-border rounded-md overflow-x-auto">
            {[
              { v: 'pending', l: 'Pendientes' },
              { v: 'fulfilled', l: 'Atendidos' },
              { v: 'cancelled', l: 'Cancelados' },
              { v: 'all', l: 'Todos' },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v as typeof filter)}
                className={`px-3 py-1 text-xs rounded whitespace-nowrap ${
                  filter === f.v ? 'bg-accent text-black' : 'text-text-secondary hover:text-text-primary'
                }`}
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
          ) : items.length === 0 ? (
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
                  <TH>Estado</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {items.map((r) => (
                  <TR key={r.id} className="cursor-pointer" onClick={() => setOpen(r)}>
                    <TD className="text-xs text-text-secondary">{formatRelative(r.createdAt)}</TD>
                    <TD>
                      <div className="text-sm">{r.client.name}</div>
                      {r.client.company && <div className="text-xs text-text-muted">{r.client.company}</div>}
                    </TD>
                    <TD className="text-right text-xs text-text-secondary">
                      {r.items.length} {r.items.length === 1 ? 'producto' : 'productos'} ·{' '}
                      {r.items.reduce((a, i) => a + i.quantity, 0)} unid.
                    </TD>
                    <TD className="text-right font-mono text-accent">{formatUSD(r.totalUSD)}</TD>
                    <TD>{statusBadge(r.status)}</TD>
                    <TD className="text-right text-text-muted text-xs">Ver →</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal
        open={!!open}
        onOpenChange={(v) => !v && setOpen(null)}
        title={open ? `Pedido de ${open.client.name}` : ''}
        description={open ? `${formatDateTime(open.createdAt)} · ${open.items.length} productos · ${formatUSD(open.totalUSD)}` : ''}
        size="lg"
        footer={
          open && (
            <>
              {open.status !== 'pending' && (
                <Button variant="ghost" onClick={() => updateStatus(open.id, 'pending')} loading={saving}>
                  <Clock size={16} /> Reabrir
                </Button>
              )}
              {open.status !== 'cancelled' && (
                <Button variant="ghost" onClick={() => updateStatus(open.id, 'cancelled')} loading={saving}>
                  <XCircle size={16} /> Cancelar
                </Button>
              )}
              {open.status !== 'fulfilled' && (
                <Button onClick={() => updateStatus(open.id, 'fulfilled')} loading={saving}>
                  <CheckCircle size={16} /> Marcar atendido
                </Button>
              )}
            </>
          )
        }
      >
        {open && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-text-secondary">
                {open.client.company || open.client.name}
              </div>
              {statusBadge(open.status)}
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Producto</TH>
                  <TH className="text-right">Cant.</TH>
                  <TH className="text-right">Precio</TH>
                  <TH className="text-right">Subtotal</TH>
                </TR>
              </THead>
              <TBody>
                {open.items.map((i) => (
                  <TR key={i.id}>
                    <TD>
                      <div className="text-sm">{i.product.name}</div>
                      <div className="text-xs text-text-muted font-mono">{i.product.sku}</div>
                    </TD>
                    <TD className="text-right font-mono">{i.quantity}</TD>
                    <TD className="text-right font-mono text-text-secondary">{formatUSD(i.priceUSD)}</TD>
                    <TD className="text-right font-mono text-accent">{formatUSD(i.subtotalUSD)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {open.notes && (
              <div className="bg-surface-2 border border-border rounded-md p-3">
                <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">Notas del cliente</div>
                <div className="text-sm whitespace-pre-wrap">{open.notes}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

function statusBadge(s: string) {
  if (s === 'pending') return <Badge tone="info">Pendiente</Badge>
  if (s === 'fulfilled') return <Badge tone="success">Atendido</Badge>
  if (s === 'cancelled') return <Badge tone="danger">Cancelado</Badge>
  return <Badge>{s}</Badge>
}
