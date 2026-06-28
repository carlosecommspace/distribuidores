import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { refreshRequestStatus } from '@/lib/requests'
import { notify } from '@/lib/notifications'

const paymentSchema = z.object({
  amountUSD: z.coerce.number().positive(),
  method: z.enum(['cash_usd', 'cash_bs', 'zelle', 'binance', 'transfer_bs', 'transfer_usd', 'other']),
  reference: z.string().optional().nullable(),
  proofUrl: z.string().url().optional().nullable().or(z.literal('')),
  note: z.string().optional().nullable(),
  // Si el admin lo registra y es efectivo, se puede marcar verificado de una
  verified: z.boolean().default(false),
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const request = await prisma.productRequest.findFirst({ where: { id: params.id, userId } })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const payments = await prisma.payment.findMany({
    where: { requestId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(payments)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const request = await prisma.productRequest.findFirst({
    where: { id: params.id, userId },
    include: { client: { select: { name: true } } },
  })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (request.status === 'released' || request.status === 'cancelled') {
    return NextResponse.json({ error: 'El pedido ya fue ' + request.status }, { status: 400 })
  }

  const parsed = paymentSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data

  const settings = await prisma.settings.findUnique({ where: { userId } })
  const rate = settings?.primaryCurrency === 'EUR'
    ? settings?.eurExchangeRate || 0
    : settings?.exchangeRate || 0

  const payment = await prisma.payment.create({
    data: {
      requestId: params.id,
      amountUSD: data.amountUSD,
      amountBs: data.amountUSD * rate,
      exchangeRate: rate,
      method: data.method,
      reference: data.reference || null,
      proofUrl: data.proofUrl || null,
      note: data.note || null,
      origin: 'admin',
      status: data.verified ? 'verified' : 'submitted',
      verifiedAt: data.verified ? new Date() : null,
      verifiedBy: data.verified ? userId : null,
    },
  })

  await refreshRequestStatus(params.id)
  return NextResponse.json(payment, { status: 201 })
}
