import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { refreshRequestStatus } from '@/lib/requests'
import { notify } from '@/lib/notifications'

const patchSchema = z.object({
  action: z.enum(['verify', 'reject', 'reset']),
  reason: z.string().optional().nullable(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const payment = await prisma.payment.findUnique({
    where: { id: params.id },
    include: { request: { include: { client: { select: { id: true, name: true } } } } },
  })
  if (!payment) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (payment.request.userId !== userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { action, reason } = parsed.data
  if (action === 'verify') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'verified',
        verifiedAt: new Date(),
        verifiedBy: userId,
        rejectedReason: null,
      },
    })
  } else if (action === 'reject') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'rejected', rejectedReason: reason || 'Sin razón' },
    })
  } else if (action === 'reset') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'submitted', verifiedAt: null, verifiedBy: null, rejectedReason: null },
    })
  }

  const refreshed = await refreshRequestStatus(payment.requestId)

  // Notificar al portal del cliente (verified/rejected es interesante para ellos también, pero
  // por ahora solo notificamos al admin si quedó pagado completo)
  if (refreshed.status === 'paid') {
    await notify({
      userId,
      type: 'request_paid',
      severity: 'success',
      title: `Pedido de ${payment.request.client.name} listo para liberar`,
      body: `Pago completo verificado. Total USD ${refreshed.totalUSD.toFixed(2)}.`,
      link: `/requests/${payment.requestId}`,
      resourceType: 'request',
      resourceId: payment.requestId,
    })
  }

  return NextResponse.json({ ok: true, status: refreshed.status, paidUSD: refreshed.paidUSD })
}
