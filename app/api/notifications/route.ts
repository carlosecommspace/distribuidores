import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') || 'all' // all, unread
  const take = Math.min(Number(searchParams.get('take') || '50'), 200)

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(filter === 'unread' ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ])

  return NextResponse.json({ items, unreadCount })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const body = await req.json().catch(() => ({} as { id?: string; allRead?: boolean }))
  const { id, allRead } = body as { id?: string; allRead?: boolean }

  if (allRead) {
    const r = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    })
    return NextResponse.json({ ok: true, count: r.count })
  }

  if (id) {
    const existing = await prisma.notification.findFirst({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
    await prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'id o allRead requerido' }, { status: 400 })
}
