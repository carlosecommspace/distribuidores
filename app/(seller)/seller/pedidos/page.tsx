'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatUSD, formatRelative } from '@/lib/utils'
import { Inbox, Plus } from 'lucide-react'

interface Request {
  id: string
  code: string | null
  status: string
  totalUSD: number
  paidUSD: number
  createdAt: string
  client: { id: string; name: string; company: string | null }
  items: Array<{ id: string; quantity: number; product: { name: string; sku: string } }>
}

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/seller/requests').then((r) => r.json()).then((d) => {
      setRequests(d.requests || [])
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <PageHeader
        title="Mis pedidos"
        subtitle={`${requests.length} pedidos que has colocado`}
        actions={
          <Link href="/seller/pedidos/nuevo">
            <Button><Plus size={14} /> Nuevo pedido</Button>
          </Link>
        }
      />

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-6 flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<Inbox size={32} />}
              title="No has colocado pedidos"
              description="Empieza creando un pedido para uno de tus clientes asignados."
              action={<Link href="/seller/pedidos/nuevo"><Button><Plus size={14} /> Nuevo pedido</Button></Link>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Código</TH>
                  <TH>Cliente</TH>
                  <TH className="text-right">Productos</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Estado</TH>
                  <TH>Creado</TH>
                </TR>
              </THead>
              <TBody>
                {requests.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-mono text-sm">{r.code || r.id.slice(0, 8)}</TD>
                    <TD>
                      <div className="text-sm">{r.client.name}</div>
                      {r.client.company && <div className="text-xs text-text-muted">{r.client.company}</div>}
                    </TD>
                    <TD className="text-right font-mono">{r.items.reduce((s, x) => s + x.quantity, 0)}</TD>
                    <TD className="text-right font-mono text-accent">{formatUSD(r.totalUSD)}</TD>
                    <TD><StatusBadge status={r.status} /></TD>
                    <TD className="text-xs text-text-muted">{formatRelative(r.createdAt)}</TD>
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

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'paid' || status === 'released' ? 'success' :
    status === 'partially_paid' ? 'warning' :
    status === 'cancelled' ? 'danger' :
    'neutral'
  const label =
    status === 'pending' ? 'Pendiente' :
    status === 'partially_paid' ? 'Pago parcial' :
    status === 'paid' ? 'Pagado' :
    status === 'released' ? 'Liberado' :
    status === 'cancelled' ? 'Cancelado' :
    status
  return <Badge tone={tone as never}>{label}</Badge>
}
