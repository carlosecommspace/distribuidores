import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClientSession } from '@/lib/portal'
import { z } from 'zod'
import { notify } from '@/lib/notifications'

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
})

const patchSchema = z.union([
  z.object({ action: z.literal('cancel') }),
  z.object({
    action: z.literal('update'),
    items: z.array(itemSchema).min(1).optional(),
    notes: z.string().optional().nullable(),
  }),
])

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireClientSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const request = await prisma.productRequest.findFirst({
    where: { id: params.id, clientId: ctx.clientId },
    include: {
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
      payments: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amountUSD: true,
          amountBs: true,
          method: true,
          reference: true,
          proofUrl: true,
          note: true,
          status: true,
          createdAt: true,
          rejectedReason: true,
        },
      },
    },
  })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(request)
}

/**
 * PATCH permite al cliente:
 *  - Cancelar el pedido si no tiene pagos verificados ni submitted.
 *  - Editar items o notas si nunca ha reportado un pago.
 * En ambos casos rechazamos si el pedido ya está released o cancelled.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireClientSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const existing = await prisma.productRequest.findFirst({
    where: { id: params.id, clientId: ctx.clientId },
    include: { payments: { select: { id: true, status: true } }, items: true },
  })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (existing.status === 'released') {
    return NextResponse.json({ error: 'Pedido ya liberado' }, { status: 400 })
  }
  if (existing.status === 'cancelled') {
    return NextResponse.json({ error: 'Pedido ya cancelado' }, { status: 400 })
  }

  const hasVerified = existing.payments.some((p) => p.status === 'verified')
  const hasAnyPayment = existing.payments.length > 0

  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Regla común: no se puede modificar si ya hay pago verificado
  if (hasVerified) {
    return NextResponse.json({
      error: 'No se puede modificar este pedido porque ya tiene un pago verificado',
    }, { status: 400 })
  }

  if (parsed.data.action === 'cancel') {
    // Marca pagos submitted como rechazados para no dejarlos huérfanos
    await prisma.payment.updateMany({
      where: { requestId: existing.id, status: 'submitted' },
      data: { status: 'rejected', rejectedReason: 'Pedido cancelado por el cliente' },
    })
    const updated = await prisma.productRequest.update({
      where: { id: existing.id },
      data: { status: 'cancelled' },
    })
    await notify({
      userId: ctx.ownerId,
      type: 'request_cancelled',
      severity: 'warning',
      title: `${ctx.client.name} canceló el pedido ${existing.code || '#' + existing.id.slice(-6).toUpperCase()}`,
      body: `Total original: $${existing.totalUSD.toFixed(2)} USD`,
      link: `/requests/${existing.id}`,
      resourceType: 'request',
      resourceId: existing.id,
      dedup: false,
    })
    return NextResponse.json(updated)
  }

  // ---- action === 'update' ----
  // Solo se permite editar si NO hay pagos reportados aún (ni submitted).
  if (hasAnyPayment && parsed.data.items !== undefined) {
    return NextResponse.json({
      error: 'No se pueden cambiar los productos porque ya notificaste un pago',
    }, { status: 400 })
  }

  const { items, notes } = parsed.data
  const patch: { notes?: string | null; totalUSD?: number } = {}

  if (notes !== undefined) patch.notes = notes ?? null

  if (items && items.length > 0) {
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, userId: ctx.ownerId, isActive: true },
      select: { id: true, name: true, priceUSD: true, stock: true },
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

    // Resolver precios respetando lista del cliente
    let overrides = new Map<string, number>()
    if (ctx.client.priceListId) {
      const pls = await prisma.priceListItem.findMany({
        where: { priceListId: ctx.client.priceListId, productId: { in: productIds } },
        select: { productId: true, priceUSD: true },
      })
      overrides = new Map(pls.map((p) => [p.productId, p.priceUSD]))
    }

    const validItems = items.filter((i) => productMap.has(i.productId))
    if (validItems.length === 0) {
      return NextResponse.json({ error: 'Sin productos válidos' }, { status: 400 })
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
    patch.totalUSD = totalUSD

    await prisma.$transaction([
      prisma.productRequestItem.deleteMany({ where: { requestId: existing.id } }),
      prisma.productRequestItem.createMany({
        data: lineItems.map((i) => ({ ...i, requestId: existing.id })),
      }),
    ])
  }

  const updated = await prisma.productRequest.update({
    where: { id: existing.id },
    data: patch,
  })

  await notify({
    userId: ctx.ownerId,
    type: 'request_updated',
    severity: 'info',
    title: `${ctx.client.name} actualizó el pedido ${existing.code || '#' + existing.id.slice(-6).toUpperCase()}`,
    body: patch.totalUSD !== undefined
      ? `Nuevo total: $${patch.totalUSD.toFixed(2)} USD`
      : 'Actualizaron las notas del pedido',
    link: `/requests/${existing.id}`,
    resourceType: 'request',
    resourceId: existing.id,
    dedup: false,
  })

  return NextResponse.json(updated)
}
