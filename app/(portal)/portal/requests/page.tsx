'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { formatUSD, formatDateTime, formatRelative } from '@/lib/utils'
import { History, ShoppingBag } from 'lucide-react'

interface ReqItem {
  id: string
  quantity: number
  priceUSD: number
  subtotalUSD: number
  product: { id: string; name: string; sku: string }
}
interface PortalRequest {
  id: string
  status: 'pending' | 'fulfilled' | 'cancelled'
  notes?: string | null
  totalUSD: number
  createdAt: string
  fulfilledAt?: string | null
  items: ReqItem[]
}

export default function PortalRequestsPage() {
  const [items, setItems] = useState<PortalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<PortalRequest | null>(null)

  useEffect(() => {
    fetch('/api/portal/requests').then((r) => r.json()).then((data) => {
      setItems(data)
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary">Mis pedidos</h1>
          <p className="text-sm text-text-secondary mt-1">Historial y estado de tus pedidos.</p>
        </div>
        <Link href="/portal/catalog">
          <Button><ShoppingBag size={16} /> Nuevo pedido</Button>
        </Link>
      </div>

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-4 flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<History size={32} />}
              title="Sin pedidos todavía"
              description="Cuando hagas un pedido aparecerá aquí."
              action={
                <Link href="/portal/catalog">
                  <Button><ShoppingBag size={16} /> Ir al catálogo</Button>
                </Link>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Fecha</TH>
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
                    <TD className="text-right text-xs">
                      {r.items.length} · {r.items.reduce((a, i) => a + i.quantity, 0)} unid.
                    </TD>
                    <TD className="text-right font-mono text-accent">{formatUSD(r.totalUSD)}</TD>
                    <TD>{statusBadge(r.status)}</TD>
                    <TD className="text-right text-xs text-text-muted">Ver →</TD>
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
        title={open ? `Pedido del ${formatDateTime(open.createdAt)}` : ''}
        description={open ? `${open.items.length} productos · ${formatUSD(open.totalUSD)}` : ''}
        size="lg"
      >
        {open && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-text-secondary">
                {open.status === 'fulfilled' && open.fulfilledAt
                  ? `Atendido el ${formatDateTime(open.fulfilledAt)}`
                  : 'Estado del pedido'}
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
                <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">Notas</div>
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
