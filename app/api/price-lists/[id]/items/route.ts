import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const upsertSchema = z.object({
  productId: z.string().min(1),
  priceUSD: z.number().nonnegative(),
})

const bulkSchema = z.object({
  items: z.array(upsertSchema).min(1),
})

async function ensureOwn(userId: string, priceListId: string) {
  return prisma.priceList.findFirst({ where: { id: priceListId, userId } })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const list = await ensureOwn(userId, params.id)
  if (!list) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json()
  const single = upsertSchema.safeParse(body)
  const bulk = bulkSchema.safeParse(body)
  const inputs = single.success ? [single.data] : bulk.success ? bulk.data.items : null
  if (!inputs) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })

  const productIds = inputs.map((i) => i.productId)
  const owned = await prisma.product.findMany({ where: { id: { in: productIds }, userId }, select: { id: true } })
  const ownedIds = new Set(owned.map((p) => p.id))
  const filtered = inputs.filter((i) => ownedIds.has(i.productId))
  if (filtered.length === 0) return NextResponse.json({ error: 'no valid products' }, { status: 400 })

  await prisma.$transaction(
    filtered.map((i) =>
      prisma.priceListItem.upsert({
        where: { priceListId_productId: { priceListId: params.id, productId: i.productId } },
        update: { priceUSD: i.priceUSD },
        create: { priceListId: params.id, productId: i.productId, priceUSD: i.priceUSD },
      }),
    ),
  )
  return NextResponse.json({ ok: true, count: filtered.length })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const list = await ensureOwn(userId, params.id)
  if (!list) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  await prisma.priceListItem.deleteMany({ where: { priceListId: params.id, productId } })
  return NextResponse.json({ ok: true })
}
