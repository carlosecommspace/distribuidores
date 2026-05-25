import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { formatUSD, formatDateTime, formatRelative } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { ClientPortalSection } from '@/components/clients/ClientPortalSection'

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const userId = (session.user as { id: string }).id

  const client = await prisma.client.findFirst({
    where: { id: params.id, userId },
    include: {
      sales: { include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' } },
      priceList: true,
      portalUser: { select: { id: true, email: true, name: true } },
      requests: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { items: true },
      },
    },
  })
  if (!client) notFound()

  const totalOrders = client.sales.length
  const totalUSD = client.sales.reduce((s, x) => s + x.totalUSD, 0)
  const avg = totalOrders > 0 ? totalUSD / totalOrders : 0
  const pendingRequests = client.requests.filter((r) => r.status === 'pending').length

  return (
    <div>
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-4">
        <ArrowLeft size={14} /> Clientes
      </Link>
      <PageHeader title={client.name} subtitle={client.company || client.phone || ''} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Stat label="Total comprado" value={formatUSD(totalUSD)} accent />
        <Stat label="Órdenes" value={totalOrders} />
        <Stat label="Ticket promedio" value={formatUSD(avg)} />
        <Stat label="Pedidos pendientes" value={pendingRequests} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Historial de compras</CardTitle></CardHeader>
          <CardBody className="p-0">
            {client.sales.length === 0 ? (
              <div className="px-4 sm:px-6 py-10 text-sm text-text-muted text-center">Sin compras todavía</div>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Fecha</TH>
                    <TH>Canal</TH>
                    <TH>Productos</TH>
                    <TH className="text-right">Total</TH>
                  </TR>
                </THead>
                <TBody>
                  {client.sales.map((s) => (
                    <TR key={s.id}>
                      <TD className="text-xs text-text-secondary">{formatDateTime(s.createdAt)}</TD>
                      <TD className="text-xs uppercase text-text-secondary">{s.channel}</TD>
                      <TD className="text-xs text-text-secondary">{s.items.map((i) => `${i.quantity}× ${i.product.name}`).join(', ')}</TD>
                      <TD className="text-right font-mono text-accent">{formatUSD(s.totalUSD)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <div className="flex flex-col gap-4 md:gap-6">
          <ClientPortalSection
            clientId={client.id}
            initialPriceListId={client.priceListId}
            portalUser={client.portalUser}
          />

          <Card>
            <CardHeader><CardTitle>Información</CardTitle></CardHeader>
            <CardBody>
              <dl className="flex flex-col gap-3 text-sm">
                {client.email && <Row label="Email" value={client.email} />}
                {client.phone && <Row label="Teléfono" value={client.phone} />}
                {client.city && <Row label="Ciudad" value={client.city} />}
                {client.address && <Row label="Dirección" value={client.address} />}
                <Row label="Tipo" value={client.type} />
              </dl>
              {client.notes && (
                <div className="mt-5">
                  <div className="text-xs uppercase tracking-wider text-text-secondary mb-2">Notas internas</div>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {client.requests.length > 0 && (
        <Card className="mt-4 md:mt-6">
          <CardHeader><CardTitle>Pedidos recientes</CardTitle></CardHeader>
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Fecha</TH>
                  <TH className="text-right">Productos</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Estado</TH>
                </TR>
              </THead>
              <TBody>
                {client.requests.map((r) => (
                  <TR key={r.id}>
                    <TD className="text-xs text-text-secondary">{formatRelative(r.createdAt)}</TD>
                    <TD className="text-right text-xs">{r.items.length}</TD>
                    <TD className="text-right font-mono text-accent">{formatUSD(r.totalUSD)}</TD>
                    <TD>{requestStatusBadge(r.status)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  )
}

function requestStatusBadge(s: string) {
  if (s === 'pending') return <Badge tone="info">Pendiente</Badge>
  if (s === 'fulfilled') return <Badge tone="success">Atendido</Badge>
  if (s === 'cancelled') return <Badge tone="danger">Cancelado</Badge>
  return <Badge>{s}</Badge>
}
