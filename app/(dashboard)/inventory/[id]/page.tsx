import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { StockBadge, MLStatusBadge } from '@/components/inventory/StockBadge'
import { formatUSD, formatBs, formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const userId = (session.user as { id: string }).id

  const product = await prisma.product.findFirst({
    where: { id: params.id, userId },
    include: {
      saleItems: {
        include: { sale: { include: { client: true } } },
        orderBy: { sale: { createdAt: 'desc' } },
        take: 20,
      },
    },
  })
  if (!product) notFound()

  const totalSold = product.saleItems.reduce((s, x) => s + x.quantity, 0)
  const revenue = product.saleItems.reduce((s, x) => s + x.subtotalUSD, 0)

  return (
    <div>
      <Link href="/inventory" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent mb-4">
        <ArrowLeft size={14} /> Inventario
      </Link>
      <PageHeader
        title={product.name}
        subtitle={`SKU ${product.sku}${product.category ? ` · ${product.category}` : ''}`}
        actions={
          <div className="flex gap-2">
            <StockBadge stock={product.stock} stockMin={product.stockMin} />
            <MLStatusBadge mlItemId={product.mlItemId} mlStatus={product.mlStatus} />
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Stock actual" value={`${product.stock} ${product.unit}`} />
        <Stat label="Precio USD" value={formatUSD(product.priceUSD)} accent />
        <Stat label="Precio Bs" value={formatBs(product.priceBs)} />
        <Stat label="Margen" value={`${product.marginPercent.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Historial de ventas</CardTitle></CardHeader>
          <CardBody className="p-0">
            {product.saleItems.length === 0 ? (
              <div className="px-6 py-10 text-sm text-text-muted text-center">Sin ventas registradas</div>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Fecha</TH>
                    <TH>Cliente</TH>
                    <TH>Canal</TH>
                    <TH className="text-right">Cantidad</TH>
                    <TH className="text-right">Precio</TH>
                  </TR>
                </THead>
                <TBody>
                  {product.saleItems.map((it) => (
                    <TR key={it.id}>
                      <TD className="text-xs text-text-secondary">{formatDateTime(it.sale.createdAt)}</TD>
                      <TD>{it.sale.client?.name || 'Ocasional'}</TD>
                      <TD className="text-xs uppercase text-text-secondary">{it.sale.channel}</TD>
                      <TD className="text-right font-mono">{it.quantity}</TD>
                      <TD className="text-right font-mono">{formatUSD(it.priceUSD)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
          <CardBody>
            <dl className="flex flex-col gap-3 text-sm">
              <Row label="Unidades vendidas" value={`${totalSold}`} />
              <Row label="Ingresos totales" value={formatUSD(revenue)} />
              <Row label="Stock mínimo" value={`${product.stockMin}`} />
              <Row label="Costo unitario" value={formatUSD(product.costUSD)} />
              {product.brand && <Row label="Marca" value={product.brand} />}
              {product.mlItemId && <Row label="ML Item ID" value={<span className="font-mono">{product.mlItemId}</span>} />}
              {product.mlLastSync && <Row label="Último sync" value={formatDateTime(product.mlLastSync)} />}
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-text-primary font-mono">{value}</dd>
    </div>
  )
}
