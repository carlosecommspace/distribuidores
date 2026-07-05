import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSellerSession } from '@/lib/seller-session'
import { z } from 'zod'
import { notify } from '@/lib/notifications'
import { codePrefix, nextRequestCode } from '@/lib/requests'

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
})

const createSchema = z.object({
  clientId: z.string().min(1),
  items: z.array(itemSchema).min(1),
  notes: z.string().optional().nullable(),
})

export async function GET() {
  const ctx = await requireSellerSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const requests = await prisma.productRequest.findMany({
    where: { sellerId: ctx.sellerId },
    include: {
      client: { select: { id: true, name: true, company: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ requests })
}

export async function POST(req: Request) {
  const ctx = await requireSellerSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { clientId, items, notes } = parsed.data

  // Verificar que el cliente esta asignado a este vendedor
  const assignment = await prisma.sellerClient.findUnique({
    where: { sellerId_clientId: { sellerId: ctx.sellerId, clientId } },
  })
  if (!assignment) return NextResponse.json({ error: 'Cliente no asignado a ti' }, { status: 403 })

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { priceList: { select: { id: true } } },
  })
  if (!client || client.userId !== ctx.ownerId) {
    return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 })
  }

  const productIds = items.map((i) => i.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, userId: ctx.ownerId, isActive: true },
    select: { id: true, name: true, priceUSD: true, stock: true, unit: true },
  })
  const productMap = new Map(products.map((p) => [p.id, p]))

  // Validar stock
  const insufficient: Array<{ productId: string; name: string; requested: number; available: number }> = []
  for (const it of items) {
    const p = productMap.get(it.productId)
    if (!p) continue
    if (it.quantity > p.stock) {
      insufficient.push({ productId: p.id, name: p.name, requested: it.quantity, available: p.stock })
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

  // Aplicar lista de precio del cliente
  let overrides = new Map<string, number>()
  if (client.priceListId) {
    const pls = await prisma.priceListItem.findMany({
      where: { priceListId: client.priceListId, productId: { in: productIds } },
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

  // Codigo correlativo
  const owner = await prisma.user.findUnique({
    where: { id: ctx.ownerId },
    select: { company: true, name: true },
  })
  const prefix = codePrefix(owner?.company, owner?.name)

  let created: { id: string; code: string | null } | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await nextRequestCode(ctx.ownerId, prefix)
    try {
      created = await prisma.productRequest.create({
        data: {
          userId: ctx.ownerId,
          clientId,
          sellerId: ctx.sellerId,
          code,
          status: 'pending',
          notes: notes || null,
          totalUSD,
          items: { create: lineItems },
        },
        select: { id: true, code: true },
      })
      break
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('Unique') || msg.includes('P2002')) continue
      throw e
    }
  }
  if (!created) return NextResponse.json({ error: 'No se pudo generar código único' }, { status: 500 })

  // Notificar al admin
  await notify({
    userId: ctx.ownerId,
    type: 'new_request',
    severity: 'info',
    title: `Nuevo pedido ${created.code} colocado por vendedor`,
    body: `Cliente: ${client.name} · Total $${totalUSD.toFixed(2)} USD`,
    link: `/requests/${created.id}`,
    resourceType: 'request',
    resourceId: created.id,
    dedup: false,
  }).catch((e) => console.error('[seller-requests] notify failed', e))

  return NextResponse.json({ id: created.id, code: created.code, totalUSD }, { status: 201 })
}
