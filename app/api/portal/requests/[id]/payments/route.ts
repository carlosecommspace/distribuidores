import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClientSession } from '@/lib/portal'
import { z } from 'zod'
import { refreshRequestStatus } from '@/lib/requests'
import { notify } from '@/lib/notifications'

const schema = z.object({
  amountUSD: z.coerce.number().positive(),
  method: z.enum(['cash_usd', 'cash_bs', 'zelle', 'binance', 'transfer_bs', 'transfer_usd', 'other']),
  reference: z.string().optional().nullable(),
  proofUrl: z.string().url().optional().nullable().or(z.literal('')),
  note: z.string().optional().nullable(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireClientSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const request = await prisma.productRequest.findFirst({
    where: { id: params.id, clientId: ctx.clientId },
  })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (request.status === 'released' || request.status === 'cancelled') {
    return NextResponse.json({ error: 'El pedido ya fue ' + request.status }, { status: 400 })
  }

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data

  const settings = await prisma.settings.findUnique({ where: { userId: ctx.ownerId } })
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
      origin: 'portal',
      status: 'submitted',
    },
  })

  // Notificar al admin
  await notify({
    userId: ctx.ownerId,
    type: 'payment_submitted',
    severity: 'info',
    title: `${ctx.client.name} registró un pago`,
    body: `$${data.amountUSD.toFixed(2)} USD · ${labelMethod(data.method)} · pedido #${params.id.slice(-6)}`,
    link: `/requests/${params.id}`,
    resourceType: 'payment',
    resourceId: payment.id,
  })

  await refreshRequestStatus(params.id)

  return NextResponse.json(payment, { status: 201 })
}

function labelMethod(m: string): string {
  const map: Record<string, string> = {
    cash_usd: 'Efectivo USD',
    cash_bs: 'Efectivo Bs',
    zelle: 'Zelle',
    binance: 'Binance',
    transfer_bs: 'Transf. Bs',
    transfer_usd: 'Transf. USD',
    other: 'Otro',
  }
  return map[m] || m
}
