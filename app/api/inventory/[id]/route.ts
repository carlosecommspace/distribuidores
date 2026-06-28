import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const product = await prisma.product.findFirst({ where: { id: params.id, userId } })
  if (!product) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const body = await req.json()

  const current = await prisma.product.findFirst({ where: { id: params.id, userId } })
  if (!current) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const settings = await prisma.settings.findUnique({ where: { userId } })
  const rate = settings?.primaryCurrency === 'EUR'
    ? settings?.eurExchangeRate || 0
    : settings?.exchangeRate || 0

  const priceUSD = body.priceUSD ?? current.priceUSD
  const costUSD = body.costUSD ?? current.costUSD
  const margin = costUSD > 0 ? ((priceUSD - costUSD) / costUSD) * 100 : 0

  // Si vino categoryId distinto, sincroniza el nombre denormalizado
  const patch: Record<string, unknown> = { ...body }
  if ('categoryId' in body) {
    if (body.categoryId) {
      const cat = await prisma.category.findFirst({ where: { id: body.categoryId, userId } })
      if (!cat) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 400 })
      patch.category = cat.name
      patch.categoryId = cat.id
    } else {
      patch.categoryId = null
    }
  }

  const product = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...patch,
      priceBs: priceUSD * rate,
      marginPercent: margin,
    },
  })
  return NextResponse.json(product)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const product = await prisma.product.findFirst({ where: { id: params.id, userId } })
  if (!product) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await prisma.product.update({ where: { id: params.id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
