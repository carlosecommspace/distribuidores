import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Card, CardBody } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { Badge } from '@/components/ui/Badge'
import { ShoppingBag, History, Tag, ArrowRight } from 'lucide-react'
import { formatUSD, formatRelative } from '@/lib/utils'

export default async function PortalHomePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const su = session.user as { clientId?: string }
  if (!su.clientId) redirect('/login')

  const client = await prisma.client.findUnique({
    where: { id: su.clientId },
    include: {
      requests: { orderBy: { createdAt: 'desc' }, take: 5, include: { items: true } },
    },
  })
  if (!client) redirect('/login')

  const openStatuses = new Set(['pending', 'partially_paid', 'paid'])
  const pending = client.requests.filter((r) => openStatuses.has(r.status)).length
  const fulfilled = client.requests.filter((r) => r.status === 'released' || r.status === 'fulfilled').length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary">
          Hola, {client.name}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Bienvenido a tu portal de pedidos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Stat label="Pedidos pendientes" value={pending} accent />
        <Stat label="Pedidos atendidos" value={fulfilled} />
        <Stat label="Total pedidos" value={client.requests.length} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/portal/catalog" className="block">
          <Card className="hover:border-accent-border transition-colors h-full">
            <CardBody className="flex items-start gap-3">
              <div className="bg-accent-subtle text-accent rounded-md p-2">
                <ShoppingBag size={20} />
              </div>
              <div className="flex-1">
                <div className="font-display text-lg text-text-primary flex items-center gap-2">
                  Ver catálogo <ArrowRight size={14} className="text-text-muted" />
                </div>
                <p className="text-sm text-text-secondary">Navega los productos disponibles y arma tu pedido.</p>
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/portal/requests" className="block">
          <Card className="hover:border-accent-border transition-colors h-full">
            <CardBody className="flex items-start gap-3">
              <div className="bg-info-subtle text-info rounded-md p-2">
                <History size={20} />
              </div>
              <div className="flex-1">
                <div className="font-display text-lg text-text-primary flex items-center gap-2">
                  Mis pedidos <ArrowRight size={14} className="text-text-muted" />
                </div>
                <p className="text-sm text-text-secondary">Revisa el estado de los pedidos que has hecho.</p>
              </div>
            </CardBody>
          </Card>
        </Link>
      </div>

      {client.requests.length > 0 && (
        <Card>
          <CardBody className="p-0">
            <div className="px-4 sm:px-6 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Últimos pedidos</h2>
              <Link href="/portal/requests" className="text-xs text-accent">Ver todos →</Link>
            </div>
            <ul className="divide-y divide-border">
              {client.requests.slice(0, 5).map((r) => (
                <li key={r.id} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm">
                      {r.items.length} {r.items.length === 1 ? 'producto' : 'productos'} ·{' '}
                      <span className="font-mono text-accent">{formatUSD(r.totalUSD)}</span>
                    </div>
                    <div className="text-xs text-text-muted">{formatRelative(r.createdAt)}</div>
                  </div>
                  {statusBadge(r.status)}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function statusBadge(s: string) {
  if (s === 'pending') return <Badge tone="warning">Pendiente pago</Badge>
  if (s === 'partially_paid') return <Badge tone="info">Pago parcial</Badge>
  if (s === 'paid') return <Badge tone="success">Pagado</Badge>
  if (s === 'released' || s === 'fulfilled') return <Badge tone="success">Liberado</Badge>
  if (s === 'cancelled') return <Badge tone="danger">Cancelado</Badge>
  return <Badge>{s}</Badge>
}
