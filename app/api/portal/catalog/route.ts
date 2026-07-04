import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClientSession } from '@/lib/portal'

export async function GET(req: Request) {
  const ctx = await requireClientSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || undefined

  const products = await prisma.product.findMany({
    where: {
      userId: ctx.ownerId,
      isActive: true,
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      }),
    },
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      brand: true,
      unit: true,
      images: true,
      priceUSD: true,
      stock: true,
    },
    orderBy: { name: 'asc' },
  })

  let overrides = new Map<string, number>()
  if (ctx.client.priceListId) {
    const items = await prisma.priceListItem.findMany({
      where: { priceListId: ctx.client.priceListId },
      select: { productId: true, priceUSD: true },
    })
    overrides = new Map(items.map((i) => [i.productId, i.priceUSD]))
  }

  // No exponemos si el precio viene de una lista o es base — es información interna
  const out = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    brand: p.brand,
    unit: p.unit,
    images: p.images,
    priceUSD: overrides.get(p.id) ?? p.priceUSD,
    stock: p.stock,
  }))
  return NextResponse.json({ products: out })
}
