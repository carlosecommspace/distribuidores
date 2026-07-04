import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  type: z.enum(['zelle', 'binance', 'bank_transfer_bs', 'bank_transfer_usd', 'cash_usd', 'cash_bs', 'other']),
  label: z.string().min(1),
  accountName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  documentId: z.string().optional().nullable(),
  currency: z.enum(['USD', 'VES']).default('USD'),
  instructions: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const items = await prisma.paymentMethod.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const created = await prisma.paymentMethod.create({ data: { ...parsed.data, userId } })
  return NextResponse.json(created, { status: 201 })
}
