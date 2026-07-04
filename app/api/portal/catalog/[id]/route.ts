import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClientSession } from '@/lib/portal'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireClientSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const product = await prisma.product.findFirst({
    where: { id: params.id, userId: ctx.ownerId, isActive: true },
    select: {
      id: true, sku: true, name: true, description: true, category: true,
      brand: true, unit: true, images: true, priceUSD: true, stock: true,
    },
  })
  if (!product) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Aplicar override de la lista si aplica
  let priceUSD = product.priceUSD
  if (ctx.client.priceListId) {
    const item = await prisma.priceListItem.findUnique({
      where: { priceListId_productId: { priceListId: ctx.client.priceListId, productId: product.id } },
      select: { priceUSD: true },
    })
    if (item) priceUSD = item.priceUSD
  }

  return NextResponse.json({
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    brand: product.brand,
    unit: product.unit,
    image: product.images?.[0] || null,
    priceUSD,
    stock: product.stock,
  })
}
