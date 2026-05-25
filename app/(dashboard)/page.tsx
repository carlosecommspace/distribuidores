import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Stat } from '@/components/ui/Stat'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { formatUSD, formatRelative } from '@/lib/utils'
import { ShoppingCart, Package, MessageSquare, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { RevenueChart } from '@/components/analytics/RevenueChart'

export default async function DashboardPage() {
  const session = await auth()
  const userId = (session!.user as { id: string }).id

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfDay)
  startOfYesterday.setDate(startOfDay.getDate() - 1)
  const start30 = new Date()
  start30.setDate(start30.getDate() - 30)

  const [todaySales, yesterdaySales, lowStock, unansweredQ, recentSales, last30, topProductsRaw] = await Promise.all([
    prisma.sale.findMany({ where: { userId, createdAt: { gte: startOfDay } }, include: { items: true } }),
    prisma.sale.findMany({
      where: { userId, createdAt: { gte: startOfYesterday, lt: startOfDay } },
      include: { items: true },
    }),
    prisma.product
      .findMany({ where: { userId, isActive: true }, select: { stock: true, stockMin: true } })
      .then((ps) => ps.filter((p) => p.stock <= p.stockMin).length),
    prisma.mLQuestion.count({
      where: { status: 'unanswered', connection: { userId } },
    }),
    prisma.sale.findMany({
      where: { userId },
      include: { client: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.sale.findMany({
      where: { userId, createdAt: { gte: start30 } },
      select: { createdAt: true, totalUSD: true },
    }),
    prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { userId, createdAt: { gte: start30 } } },
      _sum: { quantity: true, subtotalUSD: true },
      orderBy: { _sum: { subtotalUSD: 'desc' } },
      take: 5,
    }),
  ])

  const todayUSD = todaySales.reduce((s, x) => s + x.totalUSD, 0)
  const yesterdayUSD = yesterdaySales.reduce((s, x) => s + x.totalUSD, 0)
  const deltaPct = yesterdayUSD > 0 ? ((todayUSD - yesterdayUSD) / yesterdayUSD) * 100 : 0
  const todayUnits = todaySales.reduce((s, x) => s + x.items.reduce((a, i) => a + i.quantity, 0), 0)

  // build chart data by day
  const dayMap = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dayMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const s of last30) {
    const k = s.createdAt.toISOString().slice(0, 10)
    if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) || 0) + s.totalUSD)
  }
  const chartData = Array.from(dayMap.entries()).map(([date, usd]) => ({ date: date.slice(5), usd }))

  const topProductIds = topProductsRaw.map((t) => t.productId)
  const topProductsInfo = await prisma.product.findMany({ where: { id: { in: topProductIds } } })
  const topProducts = topProductsRaw.map((t) => {
    const p = topProductsInfo.find((x) => x.id === t.productId)
    return {
      name: p?.name || 'Desconocido',
      units: t._sum.quantity || 0,
      revenue: t._sum.subtotalUSD || 0,
    }
  })

  const recentQuestions = await prisma.mLQuestion.findMany({
    where: { status: 'unanswered', connection: { userId } },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-text-primary">Buen día</h1>
        <p className="text-sm text-text-secondary mt-1">Resumen de tu operación de hoy</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Ventas hoy"
          value={formatUSD(todayUSD)}
          delta={yesterdayUSD > 0 ? { value: Math.round(deltaPct), positive: deltaPct >= 0 } : undefined}
          icon={<ShoppingCart size={16} />}
          accent
        />
        <Stat label="Unidades vendidas" value={todayUnits} icon={<Package size={16} />} />
        <Stat
          label="Preguntas ML sin responder"
          value={unansweredQ}
          icon={<MessageSquare size={16} />}
          hint={unansweredQ > 0 ? <Link className="text-accent" href="/mercadolibre/questions">Responder ahora →</Link> : 'Todo al día'}
        />
        <Stat
          label="Productos bajo stock"
          value={lowStock as number}
          icon={<AlertTriangle size={16} />}
          hint={(lowStock as number) > 0 ? <Link className="text-accent" href="/inventory?filter=low">Ver lista →</Link> : 'Sin alertas'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Ventas — últimos 30 días</CardTitle>
          </CardHeader>
          <CardBody>
            <RevenueChart data={chartData} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Últimas ventas</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {recentSales.length === 0 ? (
              <div className="px-6 py-10 text-sm text-text-muted text-center">Aún no hay ventas registradas</div>
            ) : (
              <Table>
                <TBody>
                  {recentSales.map((s) => (
                    <TR key={s.id}>
                      <TD>
                        <div className="text-sm text-text-primary">{s.client?.name || 'Ocasional'}</div>
                        <div className="text-xs text-text-muted">{formatRelative(s.createdAt)}</div>
                      </TD>
                      <TD>
                        <Badge tone="neutral">{channelLabel(s.channel)}</Badge>
                      </TD>
                      <TD className="text-right font-mono text-accent">{formatUSD(s.totalUSD)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Top productos — esta semana</CardTitle></CardHeader>
          <CardBody className="p-0">
            {topProducts.length === 0 ? (
              <div className="px-6 py-10 text-sm text-text-muted text-center">Sin datos suficientes</div>
            ) : (
              <Table>
                <THead><TR><TH>Producto</TH><TH className="text-right">Unidades</TH><TH className="text-right">Ingresos</TH></TR></THead>
                <TBody>
                  {topProducts.map((p, i) => (
                    <TR key={i}>
                      <TD>{p.name}</TD>
                      <TD className="text-right font-mono">{p.units}</TD>
                      <TD className="text-right font-mono text-accent">{formatUSD(p.revenue)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Preguntas ML recientes</CardTitle></CardHeader>
          <CardBody className="p-0">
            {recentQuestions.length === 0 ? (
              <div className="px-6 py-10 text-sm text-text-muted text-center">Sin preguntas pendientes</div>
            ) : (
              <div className="divide-y divide-border">
                {recentQuestions.map((q) => (
                  <Link key={q.id} href="/mercadolibre/questions" className="block px-6 py-4 hover:bg-surface-2">
                    <div className="text-xs text-text-muted mb-1">
                      {q.buyerNickname || 'comprador'} · {formatRelative(q.createdAt)}
                    </div>
                    <div className="text-sm text-text-primary line-clamp-2">{q.questionText}</div>
                    {q.product && <div className="text-xs text-accent mt-1">{q.product.name}</div>}
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function channelLabel(c: string) {
  return { mercadolibre: 'ML', whatsapp: 'WA', direct: 'Directo', phone: 'Teléfono', other: 'Otro' }[c] || c
}
