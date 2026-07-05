import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  aiEnabled: z.boolean().optional(),
  archived: z.boolean().optional(),
  clientId: z.string().nullable().optional(),
  markRead: z.boolean().optional(),
})

export async function GET(_req: Request, { params }: { params: { contactId: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const contact = await prisma.whatsAppContact.findFirst({
    where: { id: params.contactId, userId },
    include: {
      client: { select: { id: true, name: true, company: true } },
      messages: { orderBy: { createdAt: 'asc' }, take: 200 },
    },
  })
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(contact)
}

export async function PATCH(req: Request, { params }: { params: { contactId: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const existing = await prisma.whatsAppContact.findFirst({
    where: { id: params.contactId, userId },
  })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data

  if (data.clientId) {
    const ok = await prisma.client.findFirst({ where: { id: data.clientId, userId } })
    if (!ok) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 400 })
  }

  const updated = await prisma.whatsAppContact.update({
    where: { id: existing.id },
    data: {
      ...(data.aiEnabled !== undefined ? { aiEnabled: data.aiEnabled } : {}),
      ...(data.archived !== undefined ? { archived: data.archived } : {}),
      ...(data.clientId !== undefined ? { clientId: data.clientId || null } : {}),
      ...(data.markRead ? { unreadCount: 0 } : {}),
    },
  })
  return NextResponse.json(updated)
}
