import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const bulkSchema = z.object({
  // Aplica un ajuste porcentual sobre el precio base de cada producto
  // adjustPercent = -10  →  descuento 10%
  // adjustPercent = 15   →  recargo 15%
  adjustPercent: z.coerce.number().min(-95).max(500),
  scope: z.enum(['all', 'category', 'replace']).default('all'),
  categoryId: z.string().optional().nullable(),
  // replace = true: borra items previos y aplica desde cero
  replace: z.boolean().default(false),
  roundTo: z.coerce.number().min(0).max(4).default(2),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const list = await prisma.priceList.findFirst({ where: { id: params.id, userId } })
  if (!list) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json()
  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { adjustPercent, scope, categoryId, replace, roundTo } = parsed.data

  const products = await prisma.product.findMany({
    where: {
      userId,
      isActive: true,
      ...(scope === 'category' && categoryId ? { categoryId } : {}),
    },
    select: { id: true, priceUSD: true },
  })

  if (products.length === 0) return NextResponse.json({ ok: true, applied: 0, replaced: 0 })

  const factor = 1 + adjustPercent / 100
  const round = (n: number) => {
    const f = Math.pow(10, roundTo)
    return Math.round(n * f) / f
  }

  let replaced = 0
  if (replace) {
    const del = await prisma.priceListItem.deleteMany({ where: { priceListId: params.id } })
    replaced = del.count
  }

  await prisma.$transaction(
    products.map((p) =>
      prisma.priceListItem.upsert({
        where: { priceListId_productId: { priceListId: params.id, productId: p.id } },
        update: { priceUSD: round(p.priceUSD * factor) },
        create: { priceListId: params.id, productId: p.id, priceUSD: round(p.priceUSD * factor) },
      }),
    ),
  )

  return NextResponse.json({ ok: true, applied: products.length, replaced, adjustPercent })
}
