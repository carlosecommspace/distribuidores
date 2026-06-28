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
    prisma.exchangeRateLog.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
  ])
  return NextResponse.json({ settings, user, rateLogs })
}

type SettingsPatch = Partial<{
  exchangeRate: number
  autoUpdateRate: boolean
  eurExchangeRate: number
  autoUpdateEurRate: boolean
  primaryCurrency: 'USD' | 'EUR'
  defaultMargin: number
  waPhoneNumber: string
  mlAutoAnswer: boolean
  mlAutoSync: boolean
  mlSyncInterval: number
  notifLowStock: boolean
  notifNewQuestion: boolean
  notifNewSale: boolean
}>

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const body = await req.json()

  const { user: userPatch, settings: settingsPatch } = body as {
    user?: { name?: string; company?: string; phone?: string }
    settings?: SettingsPatch
  }

  if (userPatch) {
    await prisma.user.update({ where: { id: userId }, data: userPatch })
  }

  let updated: Awaited<ReturnType<typeof prisma.settings.upsert>> | null = null
  if (settingsPatch) {
    updated = await prisma.settings.upsert({
      where: { userId },
      update: settingsPatch,
      create: { userId, ...settingsPatch },
    })
  }

  // Si tocaron tasa USD/EUR o cambio de moneda principal, recalcula priceBs con la tasa principal vigente
  if (updated && (
    settingsPatch?.exchangeRate !== undefined ||
    settingsPatch?.eurExchangeRate !== undefined ||
    settingsPatch?.primaryCurrency !== undefined
  )) {
    const activeRate = updated.primaryCurrency === 'EUR' ? updated.eurExchangeRate : updated.exchangeRate
    if (activeRate > 0) {
      await prisma.$executeRaw`UPDATE "Product" SET "priceBs" = "priceUSD" * ${activeRate} WHERE "userId" = ${userId}`
    }
  }

  return NextResponse.json({ ok: true })
}
