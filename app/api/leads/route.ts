import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const leads = await prisma.websiteLead.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  const unread = await prisma.websiteLead.count({ where: { userId, readAt: null } })
  return NextResponse.json({ leads, unread })
}
