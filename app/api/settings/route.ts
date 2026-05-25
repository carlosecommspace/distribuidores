import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const [settings, user, rateLogs] = await Promise.all([
    prisma.settings.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.exchangeRateLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
  ])
  return NextResponse.json({ settings, user, rateLogs })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const body = await req.json()

  const { user: userPatch, settings: settingsPatch } = body as {
    user?: { name?: string; company?: string; phone?: string }
    settings?: Partial<{
      exchangeRate: number
      autoUpdateRate: boolean
      defaultMargin: number
      waPhoneNumber: string
      mlAutoAnswer: boolean
      mlAutoSync: boolean
      mlSyncInterval: number
      notifLowStock: boolean
      notifNewQuestion: boolean
      notifNewSale: boolean
    }>
  }

  if (userPatch) {
    await prisma.user.update({ where: { id: userId }, data: userPatch })
  }
  if (settingsPatch) {
    await prisma.settings.upsert({
      where: { userId },
      update: settingsPatch,
      create: { userId, ...settingsPatch },
    })
  }
  return NextResponse.json({ ok: true })
}
