'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatUSD, formatBs, formatNumber, formatRelative } from '@/lib/utils'
import { RevenueChart } from '@/components/analytics/RevenueChart'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'

interface AnalyticsData {
  totalUSD: number
  totalBs: number
  transactions: number
  avgTicket: number
  daily: Array<{ date: string; usd: number }>
  byChannel: Array<{ name: string; value: number }>
  byPayment: Array<{ name: string; value: number }>
  topProducts: Array<{ name: string; units: number; revenue: number }>
  topClients: Array<{ name: string; orders: number; total: number; lastPurchase: string | null }>
  lowStock: Array<{ id: string; name: string; sku: string; stock: number; stockMin: number }>
  stale: Array<{ id: string; name: string; sku: string; stock: number }>
  inventoryValue: number
}

const COLORS = ['#F5A623', '#60A5FA', '#4ADE80', '#F87171', '#A78BFA', '#FBBF24']

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    setData(null)
    fetch(`/api/analytics?period=${period}`).then((r) => r.json()).then(setData)
  }, [period])

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Métricas clave de tu operación"
        actions={
          <div className="flex items-center gap-1 p-1 bg-surface-2 border border-border rounded-md overflow-x-auto">
            {[
              { v: 'today', l: 'Hoy' },
              { v: '7d', l: '7 días' },
              { v: '30d', l: '30 días' },
              { v: '90d', l: '90 días' },
            ].map((p) => (
              <button
                key={p.v}
                onClick={() => setPeriod(p.v)}
                className={cn('px-3 py-1.5 text-xs rounded whitespace-nowrap', period === p.v ? 'bg-accent text-black' : 'text-text-secondary hover:text-text-primary')}
              >
                {p.l}
              </button>
            ))}
          </div>
        }
      />

      {!data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            <Stat label="Ingresos USD" value={formatUSD(data.totalUSD)} accent />
            <Stat label="Ingresos Bs" value={formatBs(data.totalBs)} />
            <Stat label="Transacciones" value={data.transactions} />
            <Stat label="Ticket promedio" value={formatUSD(data.avgTicket)} />
          </div>

          <Card className="mb-6">
            <CardHeader><CardTitle>Ventas diarias</CardTitle></CardHeader>
            <CardBody><RevenueChart data={data.daily.map((d) => ({ date: d.date.slice(5), usd: d.usd }))} /></CardBody>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
            <Card>
              <CardHeader><CardTitle>Ventas por canal</CardTitle></CardHeader>
              <CardBody>
                <div className="h-[240px]">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={data.byChannel}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                      >
                        {data.byChannel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#1A1A1A', border: '1px solid #333', borderRadius: 10, color: '#F5F0E8' }}
                        formatter={(v: number) => formatUSD(v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardHeader><CardTitle>Métodos de pago</CardTitle></CardHeader>
              <CardBody>
                <div className="h-[240px]">
                  <ResponsiveContainer>
                    <BarChart data={data.byPayment} layout="vertical" margin={{ left: 30 }}>
                      <CartesianGrid stroke="#242424" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#6B6560', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#A8A29E', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip
                        contentStyle={{ background: '#1A1A1A', border: '1px solid #333', borderRadius: 10, color: '#F5F0E8' }}
                        formatter={(v: number) => formatUSD(v)}
                      />
                      <Bar dataKey="value" fill="#F5A623" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
            <Card>
              <CardHeader><CardTitle>Top productos</CardTitle></CardHeader>
              <CardBody className="p-0">
                <Table>
                  <THead><TR><TH>Producto</TH><TH className="text-right">Unidades</TH><TH className="text-right">Ingresos</TH></TR></THead>
                  <TBody>
                    {data.topProducts.map((p, i) => (
                      <TR key={i}>
                        <TD>{p.name}</TD>
                        <TD className="text-right font-mono">{p.units}</TD>
                        <TD className="text-right font-mono text-accent">{formatUSD(p.revenue)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardBody>
            </Card>
            <Card>
              <CardHeader><CardTitle>Top clientes</CardTitle></CardHeader>
              <CardBody className="p-0">
                <Table>
                  <THead><TR><TH>Cliente</TH><TH className="text-right">Órdenes</TH><TH className="text-right">Total</TH></TR></THead>
                  <TBody>
                    {data.topClients.map((c, i) => (
                      <TR key={i}>
                        <TD>{c.name}</TD>
                        <TD className="text-right font-mono">{c.orders}</TD>
                        <TD className="text-right font-mono text-accent">{formatUSD(c.total)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Productos bajo stock mínimo</CardTitle></CardHeader>
              <CardBody className="p-0">
                {data.lowStock.length === 0 ? (
                  <div className="px-6 py-8 text-sm text-text-muted text-center">Todo en orden</div>
                ) : (
                  <Table>
                    <THead><TR><TH>SKU</TH><TH>Producto</TH><TH className="text-right">Stock</TH><TH className="text-right">Mínimo</TH></TR></THead>
                    <TBody>
                      {data.lowStock.map((p) => (
                        <TR key={p.id}>
                          <TD className="font-mono text-xs text-text-secondary">{p.sku}</TD>
                          <TD>{p.name}</TD>
                          <TD className="text-right font-mono text-danger">{p.stock}</TD>
                          <TD className="text-right font-mono text-text-muted">{p.stockMin}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader><CardTitle>Valor del inventario</CardTitle></CardHeader>
              <CardBody>
                <div className="font-mono text-2xl md:text-3xl text-accent">{formatUSD(data.inventoryValue)}</div>
                <div className="text-xs text-text-muted mt-1">Costo total de stock activo</div>
                <div className="mt-5 text-xs uppercase tracking-wider text-text-secondary mb-2">Sin movimiento en 30 días</div>
                <ul className="text-sm flex flex-col gap-1">
                  {data.stale.slice(0, 5).map((p) => (
                    <li key={p.id} className="text-text-secondary">· {p.name}</li>
                  ))}
                  {data.stale.length === 0 && <li className="text-text-muted">Todos los productos tuvieron movimiento</li>}
                </ul>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
