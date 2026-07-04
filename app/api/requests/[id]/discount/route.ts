import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { refreshRequestStatus } from '@/lib/requests'
import { notify } from '@/lib/notifications'

const schema = z.object({
  discountUSD: z.coerce.number().min(0),
  discountReason: z.string().optional().nullable(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const request = await prisma.productRequest.findFirst({
    where: { id: params.id, userId },
    include: { client: { select: { name: true } } },
  })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (request.status === 'released') {
    return NextResponse.json({ error: 'No se puede modificar un pedido liberado' }, { status: 400 })
  }
  if (request.status === 'cancelled') {
    return NextResponse.json({ error: 'Pedido cancelado' }, { status: 400 })
  }

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { discountUSD, discountReason } = parsed.data

  if (discountUSD > request.totalUSD) {
    return NextResponse.json({
      error: `El descuento no puede exceder el total del pedido ($${request.totalUSD.toFixed(2)})`,
    }, { status: 400 })
  }

  await prisma.productRequest.update({
    where: { id: request.id },
    data: {
      discountUSD,
      discountReason: discountReason || null,
    },
  })

  // Recalcular status (puede pasar a 'paid' si ya había pagos parciales que cubren el nuevo total)
  const refreshed = await refreshRequestStatus(request.id)

  if (discountUSD > 0) {
    await notify({
      userId,
      type: 'request_discount',
      severity: 'info',
      title: `Descuento aplicado al pedido ${request.code || '#' + request.id.slice(-6).toUpperCase()}`,
      body: `${discountUSD.toFixed(2)} USD descontados a ${request.client.name}. Nuevo total: $${refreshed.effectiveTotalUSD.toFixed(2)}`,
      link: `/requests/${request.id}`,
      resourceType: 'request',
      resourceId: request.id,
      dedup: false,
    })
  }

  return NextResponse.json({
    ok: true,
    discountUSD,
    discountReason,
    effectiveTotalUSD: refreshed.effectiveTotalUSD,
    status: refreshed.status,
    outstanding: refreshed.outstanding,
  })
}
