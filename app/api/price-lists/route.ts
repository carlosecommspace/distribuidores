import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).max(80),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const lists = await prisma.priceList.findMany({
    where: { userId },
    include: { _count: { select: { items: true, clients: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(lists)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  try {
    const list = await prisma.priceList.create({
      data: { ...parsed.data, notes: parsed.data.notes || null, userId },
    })
    return NextResponse.json(list)
  } catch (e: unknown) {
    const code = (e as { code?: string }).code
    if (code === 'P2002') return NextResponse.json({ error: 'Ya existe una lista con ese nombre' }, { status: 409 })
    return NextResponse.json({ error: 'error' }, { status: 500 })
  }
}
