import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const body = await req.json().catch(() => ({})) as { markRead?: boolean; markUnread?: boolean }
  const lead = await prisma.websiteLead.findUnique({ where: { id: params.id } })
  if (!lead || lead.userId !== userId) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const readAt = body.markUnread ? null : body.markRead ? new Date() : lead.readAt
  const updated = await prisma.websiteLead.update({
    where: { id: params.id },
    data: { readAt },
  })
  return NextResponse.json({ lead: updated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const lead = await prisma.websiteLead.findUnique({ where: { id: params.id } })
  if (!lead || lead.userId !== userId) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await prisma.websiteLead.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
