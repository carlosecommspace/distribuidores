import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkLowStock } from '@/lib/notifications'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const request = await prisma.productRequest.findFirst({
    where: { id: params.id, userId },
    include: { items: true, client: true },
  })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (request.status === 'released') {
    return NextResponse.json({ error: 'Ya fue liberado' }, { status: 400 })
  }
  if (request.status === 'cancelled') {
    return NextResponse.json({ error: 'Pedido cancelado' }, { status: 400 })
  }
  if (request.status !== 'paid') {
    return NextResponse.json({
      error: 'No se puede liberar: el pedido aún no está totalmente pagado',
    }, { status: 400 })
  }

  const settings = await prisma.settings.findUnique({ where: { userId } })
  const rate = settings?.primaryCurrency === 'EUR'
    ? settings?.eurExchangeRate || 0
    : settings?.exchangeRate || 0

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verificar stock disponible para TODOS los items antes de descontar
      for (const it of request.items) {
        const p = await tx.product.findFirst({ where: { id: it.productId, userId } })
        if (!p) throw new Error(`Producto no encontrado: ${it.productId}`)
        if (p.stock < it.quantity) throw new Error(`Stock insuficiente para ${p.name}`)
      }

      // Descontar stock
      for (const it of request.items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        })
      }

      // Crear Sale enlazada al request
      const subtotal = request.items.reduce((s, x) => s + x.subtotalUSD, 0)
      const sale = await tx.sale.create({
        data: {
          userId,
          clientId: request.clientId,
          channel: 'portal',
          paymentMethod: 'mixed',
          paymentStatus: 'paid',
          exchangeRate: rate,
          subtotalUSD: subtotal,
          totalUSD: subtotal,
          totalBs: subtotal * rate,
          notes: `Liberado desde pedido portal ${request.id}`,
          items: {
            create: request.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              priceUSD: i.priceUSD,
              subtotalUSD: i.subtotalUSD,
            })),
          },
        },
      })

      const updatedRequest = await tx.productRequest.update({
        where: { id: request.id },
        data: {
          status: 'released',
          releasedAt: new Date(),
          fulfilledAt: new Date(),
          saleId: sale.id,
        },
      })

      // Actualizar totalPurchases del cliente
      const agg = await tx.sale.aggregate({
        where: { clientId: request.clientId, userId },
        _sum: { totalUSD: true },
      })
      await tx.client.update({
        where: { id: request.clientId },
        data: {
          totalPurchases: agg._sum.totalUSD || 0,
          lastPurchase: new Date(),
        },
      })

      return { request: updatedRequest, sale }
    })

    // Evaluar stock bajo post-liberación
    try {
      await Promise.all(request.items.map((i) => checkLowStock(userId, i.productId)))
    } catch (err) {
      console.error('low-stock check failed (release)', err)
    }

    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 400 })
  }
}
