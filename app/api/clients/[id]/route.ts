import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const client = await prisma.client.findFirst({
    where: { id: params.id, userId },
    include: { sales: { include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' } } },
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
  const body = await req.json()
  const client = await prisma.client.update({ where: { id: params.id }, data: body })
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
