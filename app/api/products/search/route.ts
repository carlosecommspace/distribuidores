import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const su = session.user as { id: string; role?: string; sellerOwnerId?: string }

  // Resolver el tenant (dueno de los Productos):
  //   - admin/merchant → su propio userId
  //   - seller → el ownerId del merchant que lo creo
  //   - cualquier otro rol → forbidden
  let tenantId: string | null = null
  if (su.role === 'seller') {
    if (su.sellerOwnerId) {
      tenantId = su.sellerOwnerId
    } else {
      // Fallback si el JWT no trae sellerOwnerId (sesion vieja)
      const seller = await prisma.seller.findFirst({
        where: { userId: su.id },
        select: { ownerId: true, isActive: true },
      })
      if (!seller || !seller.isActive) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
      tenantId = seller.ownerId
    }
  } else if (!su.role || su.role === 'admin') {
    tenantId = su.id
  } else {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const clientId = searchParams.get('clientId') || undefined

  // Resolver lista de precio del cliente si aplica. El cliente debe pertenecer
  // al mismo tenant.
  let priceMap = new Map<string, number>()
  let priceListName: string | null = null
  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, userId: tenantId },
      include: { priceList: { include: { items: { select: { productId: true, priceUSD: true } } } } },
    })
    if (client?.priceList && client.priceList.isActive) {
      priceListName = client.priceList.name
      for (const it of client.priceList.items) priceMap.set(it.productId, it.priceUSD)
    }
  }

  const products = await prisma.product.findMany({
    where: {
      userId: tenantId,
      isActive: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true, sku: true, name: true, priceUSD: true, stock: true, unit: true,
      images: true, category: true,
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 30,
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
