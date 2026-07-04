import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClientSession } from '@/lib/portal'

export async function GET() {
  const ctx = await requireClientSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const methods = await prisma.paymentMethod.findMany({
    where: { userId: ctx.ownerId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      type: true,
      label: true,
      accountName: true,
      accountNumber: true,
      bankName: true,
      documentId: true,
      currency: true,
      instructions: true,
    },
  })
  return NextResponse.json(methods)
}
