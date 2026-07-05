import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const contacts = await prisma.whatsAppContact.findMany({
    where: { userId, archived: false },
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
    select: {
      id: true, phoneNumber: true, name: true,
      unreadCount: true, lastMessageAt: true,
      lastMessagePreview: true, lastDirection: true,
      aiEnabled: true,
      client: { select: { id: true, name: true, company: true } },
    },
  })
  return NextResponse.json(contacts)
}
