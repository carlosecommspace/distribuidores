import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { OrderPrintable } from '@/components/print/OrderPrintable'

export const dynamic = 'force-dynamic'

export default async function AdminPrintPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const userId = (session.user as { id: string }).id

  const request = await prisma.productRequest.findFirst({
    where: { id: params.id, userId },
    include: {
      client: true,
      items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
      payments: {
        orderBy: { createdAt: 'desc' },
        select: { amountUSD: true, method: true, reference: true, status: true, createdAt: true },
      },
    },
  })
  if (!request) return <div style={{ padding: 24 }}>Pedido no encontrado</div>

  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, company: true, phone: true, email: true },
  })

  return (
    <OrderPrintable
      data={{
        id: request.id,
        code: request.code,
        status: request.status,
        totalUSD: request.totalUSD,
        discountUSD: request.discountUSD,
        discountReason: request.discountReason,
        paidUSD: request.paidUSD,
        createdAt: request.createdAt.toISOString(),
        releasedAt: request.releasedAt?.toISOString() || null,
        notes: request.notes,
        company: {
          name: owner?.company || owner?.name || 'Distribuidor',
          phone: owner?.phone,
          email: owner?.email,
        },
        client: {
          name: request.client.name,
          company: request.client.company,
          phone: request.client.phone,
          email: request.client.email,
          address: request.client.address,
          city: request.client.city,
        },
        items: request.items.map((i) => ({
          quantity: i.quantity,
          priceUSD: i.priceUSD,
          subtotalUSD: i.subtotalUSD,
          product: { name: i.product.name, sku: i.product.sku, unit: i.product.unit },
        })),
        payments: request.payments.map((p) => ({
          amountUSD: p.amountUSD,
          method: p.method,
          reference: p.reference,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        })),
      }}
    />
  )
}
