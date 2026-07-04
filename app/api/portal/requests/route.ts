import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClientSession } from '@/lib/portal'
import { z } from 'zod'
import { notify } from '@/lib/notifications'
import { codePrefix, nextRequestCode } from '@/lib/requests'

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
    select: { id: true, name: true, priceUSD: true, stock: true, unit: true },
  })
  const productMap = new Map(products.map((p) => [p.id, p]))

  // Validar stock antes de cualquier otro trabajo
  const insufficient: Array<{ productId: string; name: string; requested: number; available: number }> = []
  for (const it of items) {
    const p = productMap.get(it.productId)
    if (!p) continue
    if (it.quantity > p.stock) {
      insufficient.push({
        productId: p.id,
        name: p.name,
        requested: it.quantity,
        available: p.stock,
      })
    }
  }
  if (insufficient.length > 0) {
    return NextResponse.json({
      error: 'insufficient_stock',
      message: 'No hay stock suficiente para uno o más productos',
      items: insufficient,
    }, { status: 400 })
  }

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
    const p = productMap.get(i.productId)!
    const priceUSD = overrides.get(i.productId) ?? p.priceUSD
    return {
      productId: i.productId,
      quantity: i.quantity,
      priceUSD,
      subtotalUSD: priceUSD * i.quantity,
    }
  })
  const totalUSD = lineItems.reduce((s, x) => s + x.subtotalUSD, 0)

  // Generar código correlativo tipo DIS-001 usando el nombre de la empresa del admin
  const owner = await prisma.user.findUnique({
    where: { id: ctx.ownerId },
    select: { company: true, name: true },
  })
  const prefix = codePrefix(owner?.company, owner?.name)

  let created: Awaited<ReturnType<typeof prisma.productRequest.create>> | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await nextRequestCode(ctx.ownerId, prefix)
    try {
      created = await prisma.productRequest.create({
        data: {
          userId: ctx.ownerId,
          clientId: ctx.clientId,
          code,
          status: 'pending',
          notes: notes || null,
          totalUSD,
          items: { create: lineItems },
        },
        include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
      })
      break
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('Unique') || msg.includes('P2002')) continue
      throw e
    }
  }
  if (!created) return NextResponse.json({ error: 'No se pudo generar código único' }, { status: 500 })

  await notify({
    userId: ctx.ownerId,
    type: 'new_request',
    severity: 'info',
    title: `Nuevo pedido ${created.code} de ${ctx.client.name}`,
    body: `${lineItems.length} ${lineItems.length === 1 ? 'producto' : 'productos'} · Total $${totalUSD.toFixed(2)} USD`,
    link: `/requests/${created.id}`,
    resourceType: 'request',
    resourceId: created.id,
    dedup: false,
  })

  return NextResponse.json(created)
}
