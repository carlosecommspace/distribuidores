import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClientSession } from '@/lib/portal'

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
