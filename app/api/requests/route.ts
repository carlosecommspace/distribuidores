import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || undefined

  const requests = await prisma.productRequest.findMany({
    where: { userId, ...(status ? { status } : {}) },
    include: {
      client: { select: { id: true, name: true, company: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(requests)
}
