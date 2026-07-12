import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const channel = searchParams.get('channel') || undefined

  const sales = await prisma.sale.findMany({
    where: {
      userId,
      ...(channel && { channel }),
      ...(from && to && { createdAt: { gte: new Date(from), lte: new Date(to) } }),
    },
    include: { client: true, items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json(sales)
}

/**
 * POST /api/sales → deprecado. Las ventas se generan al liberar un pedido
 * en /requests, o automaticamente desde el webhook de MercadoLibre. Este
 * endpoint responde 410 (Gone) con un mensaje que redirige al flujo correcto.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'El registro directo de ventas fue reemplazado por el flujo de pedidos. Cerrá la venta desde /requests para que quede trazada con su pago y despacho.',
    },
    { status: 410 },
  )
}
