import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClientSession } from '@/lib/portal'
import { z } from 'zod'

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
})

const createSchema = z.object({
  items: z.array(itemSchema).min(1),
  notes: z.string().optional().nullable(),
})

export async function GET() {
  const ctx = await requireClientSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const requests = await prisma.productRequest.findMany({
    where: { clientId: ctx.clientId },
    include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(requests)
}

export async function POST(req: Request) {
  const ctx = await requireClientSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { items, notes } = parsed.data

  const productIds = items.map((i) => i.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, userId: ctx.ownerId, isActive: true },
    select: { id: true, priceUSD: true },
  })
  const productMap = new Map(products.map((p) => [p.id, p.priceUSD]))
  const validItems = items.filter((i) => productMap.has(i.productId))
  if (validItems.length === 0) return NextResponse.json({ error: 'no valid products' }, { status: 400 })

  let overrides = new Map<string, number>()
  if (ctx.client.priceListId) {
    const pls = await prisma.priceListItem.findMany({
      where: { priceListId: ctx.client.priceListId, productId: { in: productIds } },
      select: { productId: true, priceUSD: true },
    })
    overrides = new Map(pls.map((p) => [p.productId, p.priceUSD]))
  }

  const lineItems = validItems.map((i) => {
    const priceUSD = overrides.get(i.productId) ?? productMap.get(i.productId)!
    return {
      productId: i.productId,
      quantity: i.quantity,
      priceUSD,
      subtotalUSD: priceUSD * i.quantity,
    }
  })
  const totalUSD = lineItems.reduce((s, x) => s + x.subtotalUSD, 0)

  const created = await prisma.productRequest.create({
    data: {
      userId: ctx.ownerId,
      clientId: ctx.clientId,
      status: 'pending',
      notes: notes || null,
      totalUSD,
      items: { create: lineItems },
    },
    include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
  })
  return NextResponse.json(created)
}
