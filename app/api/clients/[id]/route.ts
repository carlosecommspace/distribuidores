import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().optional().nullable(),
  rif: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  billingAddress: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  type: z.enum(['retail', 'wholesale', 'distributor']).optional(),
  notes: z.string().optional().nullable(),
  priceListId: z.string().nullable().optional(),
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const client = await prisma.client.findFirst({
    where: { id: params.id, userId },
    include: {
      sales: { include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' } },
      priceList: true,
      portalUser: { select: { id: true, email: true, name: true } },
    },
  })
  if (!client) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(client)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const existing = await prisma.client.findFirst({ where: { id: params.id, userId } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data

  if (data.priceListId) {
    const ok = await prisma.priceList.findFirst({ where: { id: data.priceListId, userId } })
    if (!ok) return NextResponse.json({ error: 'price list not found' }, { status: 400 })
  }

  const client = await prisma.client.update({
    where: { id: params.id },
    data: { ...data, email: data.email === '' ? null : data.email },
  })
  return NextResponse.json(client)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const existing = await prisma.client.findFirst({ where: { id: params.id, userId } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await prisma.client.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
