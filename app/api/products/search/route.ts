import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const products = await prisma.product.findMany({
    where: {
      userId,
      isActive: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, sku: true, name: true, priceUSD: true, stock: true, unit: true },
    take: 20,
  })
  return NextResponse.json(products)
}
