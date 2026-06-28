import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  status: z.enum(['pending', 'cancelled']).optional(),
  notes: z.string().optional().nullable(),
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const r = await prisma.productRequest.findFirst({
    where: { id: params.id, userId },
    include: {
      client: true,
      items: { include: { product: true } },
      payments: { orderBy: { createdAt: 'desc' } },
      sale: { select: { id: true, createdAt: true } },
    },
  })
  if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(r)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const existing = await prisma.productRequest.findFirst({ where: { id: params.id, userId } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (existing.status === 'released') {
    return NextResponse.json({ error: 'No se puede modificar un pedido liberado' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { status, notes } = parsed.data

  const updated = await prisma.productRequest.update({
    where: { id: params.id },
    data: {
      ...(status ? { status, fulfilledAt: null } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
  })
  return NextResponse.json(updated)
}
