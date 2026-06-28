import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const clientId = searchParams.get('clientId') || undefined

  // Si vino clientId, intentar resolver la lista de precio asignada
  let priceMap = new Map<string, number>()
  let priceListName: string | null = null
  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
      include: { priceList: { include: { items: { select: { productId: true, priceUSD: true } } } } },
    })
    if (client?.priceList && client.priceList.isActive) {
      priceListName = client.priceList.name
      for (const it of client.priceList.items) priceMap.set(it.productId, it.priceUSD)
    }
  }

  const products = await prisma.product.findMany({
    where: {
      userId,
      isActive: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, sku: true, name: true, priceUSD: true, stock: true, unit: true },
    take: 20,
  })

  const result = products.map((p) => {
    const listed = priceMap.get(p.id)
    return {
      ...p,
      effectivePrice: listed ?? p.priceUSD,
      hasListPrice: listed !== undefined,
      basePrice: p.priceUSD,
    }
  })

  return NextResponse.json({ products: result, priceListName })
}
