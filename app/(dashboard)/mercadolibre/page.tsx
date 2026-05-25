import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { Button } from '@/components/ui/Button'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { MLConnectButton, SyncNowButton } from '@/components/ml/MLActions'
import Link from 'next/link'
import { Store, MessageSquare, Package, RefreshCw } from 'lucide-react'
import { formatUSD, formatRelative } from '@/lib/utils'

export default async function MLPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const userId = (session.user as { id: string }).id

  const conn = await prisma.mLConnection.findUnique({ where: { userId } })

  if (!conn) {
    return (
      <div>
        <PageHeader title="MercadoLibre" subtitle="Conecta tu cuenta para sincronizar inventario y responder preguntas" />
        <Card className="max-w-xl mx-auto mt-12">
          <CardBody className="text-center py-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-subtle text-accent mb-4">
              <Store size={28} />
            </div>
            <h3 className="font-display text-lg mb-2">Conecta tu cuenta de MercadoLibre</h3>
            <p className="text-sm text-text-secondary max-w-sm mx-auto mb-6">
              Sincroniza precios y stock automáticamente, recibe y responde preguntas desde DistribOS.
            </p>
            <MLConnectButton />
          </CardBody>
        </Card>
      </div>
    )
  }

  const [activeItems, unanswered, mlSales, syncableProducts] = await Promise.all([
    prisma.product.count({ where: { userId, mlItemId: { not: null }, isActive: true } }),
    prisma.mLQuestion.count({ where: { connectionId: conn.id, status: 'unanswered' } }),
    prisma.sale.aggregate({
      where: { userId, channel: 'mercadolibre', createdAt: { gte: new Date(new Date().setDate(1)) } },
      _sum: { totalUSD: true },
    }),
    prisma.product.findMany({
      where: { userId, mlSyncEnabled: true, isActive: true },
      orderBy: { mlLastSync: { sort: 'asc', nulls: 'first' } },
      take: 20,
    }),
  ])

  return (
    <div>
      <PageHeader
        title="MercadoLibre"
        subtitle={`Conectado · usuario ML ${conn.mlUserId}`}
        actions={
          <div className="flex gap-2">
            <Link href="/mercadolibre/questions"><Button variant="secondary"><MessageSquare size={14} /> Preguntas ({unanswered})</Button></Link>
            <SyncNowButton />
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Items activos en ML" value={activeItems} icon={<Package size={16} />} accent />
        <Stat label="Preguntas sin responder" value={unanswered} icon={<MessageSquare size={16} />} />
        <Stat label="Ventas ML este mes" value={formatUSD(mlSales._sum.totalUSD || 0)} />
        <Stat label="Último sync" value={conn.lastSync ? formatRelative(conn.lastSync) : 'Nunca'} icon={<RefreshCw size={16} />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos sincronizados con MercadoLibre</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {syncableProducts.length === 0 ? (
            <div className="px-6 py-10 text-sm text-text-muted text-center">
              No tienes productos con sincronización ML activada. Activa el toggle en cada producto desde Inventario.
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Producto</TH>
                  <TH className="text-right">Stock local</TH>
                  <TH className="text-right">Precio USD</TH>
                  <TH>Estado ML</TH>
                  <TH>Último sync</TH>
                </TR>
              </THead>
              <TBody>
                {syncableProducts.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <Link href={`/inventory/${p.id}`} className="hover:text-accent">{p.name}</Link>
                      <div className="text-xs text-text-muted font-mono">{p.sku}</div>
                    </TD>
                    <TD className="text-right font-mono">{p.stock}</TD>
                    <TD className="text-right font-mono">{formatUSD(p.priceUSD)}</TD>
                    <TD>
                      {p.mlItemId ? (
                        <Badge tone="success">Publicado</Badge>
                      ) : (
                        <Badge tone="warning">Pendiente publicar</Badge>
                      )}
                    </TD>
                    <TD className="text-xs text-text-secondary">
                      {p.mlLastSync ? formatRelative(p.mlLastSync) : '—'}
                    </TD>
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
