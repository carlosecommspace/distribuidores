import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSellerSession } from '@/lib/seller-session'

/**
 * GET /api/seller/requests/[id]
 *
 * Devuelve el detalle de un pedido que pertenece al vendedor logueado
 * (i.e. `sellerId === ctx.sellerId`). Si no le pertenece devolvemos 404
 * para no revelar existencia de recursos que no puede tocar.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await requireSellerSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const request = await prisma.productRequest.findFirst({
    where: { id: params.id, sellerId: ctx.sellerId, userId: ctx.ownerId },
    include: {
      client: {
        select: {
          id: true, name: true, company: true, phone: true, email: true,
          rif: true, city: true, address: true,
        },
      },
      items: {
        include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const settings = await prisma.settings.findUnique({ where: { userId: ctx.ownerId } })
  const rate = settings?.primaryCurrency === 'EUR'
    ? settings?.eurExchangeRate || 0
    : settings?.exchangeRate || 0

  return NextResponse.json({ request, exchangeRate: rate })
}
