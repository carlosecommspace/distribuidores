import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const list = await prisma.priceList.findFirst({
    where: { id: params.id, userId },
    include: {
      items: { include: { product: true }, orderBy: { product: { name: 'asc' } } },
      clients: { select: { id: true, name: true, company: true } },
    },
  })
  if (!list) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(list)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const existing = await prisma.priceList.findFirst({ where: { id: params.id, userId } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  try {
    const list = await prisma.priceList.update({ where: { id: params.id }, data: parsed.data })
    return NextResponse.json(list)
  } catch (e: unknown) {
    const code = (e as { code?: string }).code
    if (code === 'P2002') return NextResponse.json({ error: 'Ya existe una lista con ese nombre' }, { status: 409 })
    return NextResponse.json({ error: 'error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const existing = await prisma.priceList.findFirst({ where: { id: params.id, userId } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await prisma.priceList.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
