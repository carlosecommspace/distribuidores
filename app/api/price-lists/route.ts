import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).max(80),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const lists = await prisma.priceList.findMany({
    where: { userId },
    include: {
      _count: { select: { items: true, clients: true } },
      items: {
        select: {
          priceUSD: true,
          product: { select: { priceUSD: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Enriquecer con métricas: totalValueUSD, avgDiscountPercent
  const enriched = lists.map((l) => {
    const totalListedUSD = l.items.reduce((s, x) => s + x.priceUSD, 0)
    const totalBaseUSD = l.items.reduce((s, x) => s + x.product.priceUSD, 0)
    const avgDiscountPercent = totalBaseUSD > 0
      ? ((totalListedUSD - totalBaseUSD) / totalBaseUSD) * 100
      : 0
    const { items: _items, ...rest } = l
    return { ...rest, totalListedUSD, totalBaseUSD, avgDiscountPercent }
  })

  return NextResponse.json(enriched)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  try {
    const list = await prisma.priceList.create({
      data: { ...parsed.data, notes: parsed.data.notes || null, userId },
    })
    return NextResponse.json(list)
  } catch (e: unknown) {
    const code = (e as { code?: string }).code
    if (code === 'P2002') return NextResponse.json({ error: 'Ya existe una lista con ese nombre' }, { status: 409 })
    return NextResponse.json({ error: 'error' }, { status: 500 })
  }
}
