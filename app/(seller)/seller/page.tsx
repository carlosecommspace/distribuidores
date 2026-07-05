import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatUSD, formatRelative } from '@/lib/utils'
import Link from 'next/link'
import { Users, Inbox, TrendingUp, Plus } from 'lucide-react'

export default async function SellerHomePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const su = session.user as { id?: string; sellerId?: string }
  if (!su.id) redirect('/login')

  // Resolver sellerId desde la sesion, con fallback a userId
  let sellerId = su.sellerId
  if (!sellerId) {
    const s = await prisma.seller.findFirst({ where: { userId: su.id }, select: { id: true } })
    sellerId = s?.id
  }
  if (!sellerId) redirect('/login')

  const [seller, clientsCount, requestsCount, sales, recentRequests] = await Promise.all([
    prisma.seller.findUnique({ where: { id: sellerId }, select: { name: true } }),
    prisma.sellerClient.count({ where: { sellerId } }),
    prisma.productRequest.count({ where: { sellerId } }),
    prisma.sale.aggregate({
      where: { sellerId },
      _count: true,
      _sum: { totalUSD: true },
    }),
    prisma.productRequest.findMany({
      where: { sellerId },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return (
    <div>
      <PageHeader
        title={`Hola, ${seller?.name.split(' ')[0] || ''}`}
        subtitle="Panel del vendedor"
        actions={
          <Link href="/seller/pedidos/nuevo">
            <Button><Plus size={14} /> Nuevo pedido</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Stat label="Clientes asignados" value={clientsCount} accent />
        <Stat label="Pedidos colocados" value={requestsCount} />
        <Stat label="Ventas cerradas" value={sales._count} />
        <Stat label="Total vendido" value={formatUSD(sales._sum.totalUSD || 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Últimos pedidos</CardTitle></CardHeader>
          <CardBody className="p-0">
            {recentRequests.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-muted">
                Aún no has colocado ningún pedido. <Link href="/seller/pedidos/nuevo" className="text-accent hover:underline">Crear el primero →</Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentRequests.map((r) => (
                  <li key={r.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-text-primary">{r.client.name}</div>
                      <div className="text-xs text-text-muted flex items-center gap-2">
                        <span className="font-mono">{r.code || r.id.slice(0, 8)}</span>
                        <span>·</span>
                        <span>{formatRelative(r.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-accent">{formatUSD(r.totalUSD)}</span>
                      <StatusBadge status={r.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Acciones rápidas</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            <Link href="/seller/clientes" className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-surface-2 transition-colors">
              <div className="h-9 w-9 rounded-full bg-accent-subtle flex items-center justify-center text-accent flex-shrink-0">
                <Users size={16} />
              </div>
              <div>
                <div className="text-sm text-text-primary font-medium">Ver mis clientes</div>
                <div className="text-xs text-text-secondary">Lista de clientes asignados y sus historiales de compra.</div>
              </div>
            </Link>
            <Link href="/seller/pedidos/nuevo" className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-surface-2 transition-colors">
              <div className="h-9 w-9 rounded-full bg-accent-subtle flex items-center justify-center text-accent flex-shrink-0">
                <Plus size={16} />
              </div>
              <div>
                <div className="text-sm text-text-primary font-medium">Colocar un pedido</div>
                <div className="text-xs text-text-secondary">Selecciona un cliente asignado y arma el pedido.</div>
              </div>
            </Link>
            <Link href="/seller/pedidos" className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-surface-2 transition-colors">
              <div className="h-9 w-9 rounded-full bg-accent-subtle flex items-center justify-center text-accent flex-shrink-0">
                <Inbox size={16} />
              </div>
              <div>
                <div className="text-sm text-text-primary font-medium">Historial de pedidos</div>
                <div className="text-xs text-text-secondary">Todos los pedidos que has colocado.</div>
              </div>
            </Link>
          </CardBody>
        </Card>
      </div>
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
