import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { requireSellerSession } from '@/lib/seller-session'
import { refreshRequestStatus } from '@/lib/requests'
import { notify } from '@/lib/notifications'

const paymentSchema = z.object({
  amountUSD: z.coerce.number().positive(),
  method: z.enum(['cash_usd', 'cash_bs', 'zelle', 'binance', 'transfer_bs', 'transfer_usd', 'other']),
  reference: z.string().optional().nullable(),
  proofUrl: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

/**
 * POST /api/seller/requests/[id]/payments
 *
 * Un vendedor reporta un pago que recibió del cliente. Guardas:
 *  - El pedido debe pertenecer al vendedor (sellerId).
 *  - El estado no debe ser released ni cancelled.
 *  - origin='seller' y status='submitted' (queda pendiente de verificación del
 *    admin — el admin es quien confirma en /requests/[id]). Esto evita que un
 *    vendedor mueva números por sí solo.
 *  - Se notifica al admin para que verifique.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireSellerSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const request = await prisma.productRequest.findFirst({
    where: { id: params.id, sellerId: ctx.sellerId, userId: ctx.ownerId },
    include: { client: { select: { name: true } } },
  })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (request.status === 'released' || request.status === 'cancelled') {
    return NextResponse.json(
      { error: `El pedido ya fue ${request.status}` },
      { status: 400 },
    )
  }

  const parsed = paymentSchema.safeParse(await req.json())
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
      origin: 'seller',
      status: 'submitted',
    },
  })

  // Recalcular estado (pending / partially_paid / paid) — solo cuentan pagos
  // verificados así que este seller-submitted no cambia el status todavía, pero
  // igual lo llamamos por consistencia (idempotente).
  await refreshRequestStatus(params.id)

  // Notificar al admin para que verifique
  await notify({
    userId: ctx.ownerId,
    type: 'new_payment',
    severity: 'info',
    title: `Vendedor reportó pago en ${request.code || request.id.slice(0, 8)}`,
    body: `Cliente ${request.client.name} · $${data.amountUSD.toFixed(2)} · ${data.method} · pendiente de verificar`,
    link: `/requests/${request.id}`,
    resourceType: 'payment',
    resourceId: payment.id,
    dedup: false,
  }).catch((e) => console.error('[seller-payments] notify failed', e))

  return NextResponse.json(payment, { status: 201 })
}
