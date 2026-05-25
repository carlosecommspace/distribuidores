import { NextResponse } from 'next/server'
import { fetchBCVRate } from '@/lib/bcv'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  const data = await fetchBCVRate()
  if (data.rate > 0) {
    await prisma.exchangeRateLog.create({ data: { rate: data.rate, source: data.source } })
  }
  return NextResponse.json(data)
}

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const data = await fetchBCVRate()
  if (data.rate <= 0) return NextResponse.json({ error: 'rate unavailable' }, { status: 502 })

  await prisma.exchangeRateLog.create({ data: { rate: data.rate, source: data.source } })

  await prisma.settings.upsert({
    where: { userId },
    update: { exchangeRate: data.rate, lastRateUpdate: new Date() },
    create: { userId, exchangeRate: data.rate, lastRateUpdate: new Date() },
  })

  await prisma.$executeRaw`UPDATE "Product" SET "priceBs" = "priceUSD" * ${data.rate} WHERE "userId" = ${userId}`

  return NextResponse.json(data)
}
