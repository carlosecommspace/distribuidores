import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const saleSchema = z.object({
  clientId: z.string().optional().nullable(),
  channel: z.enum(['mercadolibre', 'whatsapp', 'direct', 'phone', 'other']),
  paymentMethod: z.enum(['cash_usd', 'cash_bs', 'zelle', 'binance', 'transfer_bs', 'transfer_usd', 'mixed']),
  paymentStatus: z.enum(['paid', 'pending', 'partial']).default('paid'),
  exchangeRate: z.coerce.number().min(0),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.coerce.number().int().min(1),
        priceUSD: z.coerce.number().min(0),
      }),
    )
    .min(1),
})

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

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const body = await req.json()
  const parsed = saleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data

  const subtotal = data.items.reduce((s, i) => s + i.quantity * i.priceUSD, 0)

  try {
    const result = await prisma.$transaction(async (tx) => {
      for (const it of data.items) {
        const p = await tx.product.findFirst({ where: { id: it.productId, userId } })
        if (!p) throw new Error('Producto no encontrado')
        if (p.stock < it.quantity) throw new Error(`Stock insuficiente para ${p.name}`)
        await tx.product.update({
          where: { id: p.id },
          data: { stock: p.stock - it.quantity },
        })
      }
      const sale = await tx.sale.create({
        data: {
          userId,
          clientId: data.clientId || null,
          channel: data.channel,
          paymentMethod: data.paymentMethod,
          paymentStatus: data.paymentStatus,
          exchangeRate: data.exchangeRate,
          subtotalUSD: subtotal,
          totalUSD: subtotal,
          totalBs: subtotal * data.exchangeRate,
          notes: data.notes || null,
          items: {
            create: data.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              priceUSD: i.priceUSD,
              subtotalUSD: i.priceUSD * i.quantity,
            })),
          },
        },
        include: { items: true, client: true },
      })

      if (data.clientId) {
        const agg = await tx.sale.aggregate({
          where: { clientId: data.clientId, userId },
          _sum: { totalUSD: true },
        })
        await tx.client.update({
          where: { id: data.clientId },
          data: {
            totalPurchases: agg._sum.totalUSD || 0,
            lastPurchase: new Date(),
          },
        })
      }
      return sale
    })
    return NextResponse.json(result, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
