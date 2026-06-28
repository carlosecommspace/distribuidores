import { NextResponse } from 'next/server'
import { fetchBCVRate, type Currency } from '@/lib/bcv'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

function parseCurrency(value: string | null): Currency {
  return value === 'EUR' ? 'EUR' : 'USD'
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const currency = parseCurrency(searchParams.get('currency'))
  const data = await fetchBCVRate(currency)
  if (data.rate > 0) {
    await prisma.exchangeRateLog.create({
      data: { rate: data.rate, source: data.source, currency },
    })
  }
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  let currency: Currency = 'USD'
  try {
    const body = await req.json().catch(() => ({} as { currency?: string }))
    currency = parseCurrency((body as { currency?: string }).currency ?? null)
  } catch {}

  const data = await fetchBCVRate(currency)
  if (data.rate <= 0) return NextResponse.json({ error: 'rate unavailable' }, { status: 502 })

  await prisma.exchangeRateLog.create({
    data: { rate: data.rate, source: data.source, currency },
  })

  const settings = await prisma.settings.upsert({
    where: { userId },
    update:
      currency === 'EUR'
        ? { eurExchangeRate: data.rate, lastEurRateUpdate: new Date() }
        : { exchangeRate: data.rate, lastRateUpdate: new Date() },
    create:
      currency === 'EUR'
        ? { userId, eurExchangeRate: data.rate, lastEurRateUpdate: new Date() }
        : { userId, exchangeRate: data.rate, lastRateUpdate: new Date() },
  })

  // Recalcular priceBs SOLO si la moneda actualizada es la principal
  if (settings.primaryCurrency === currency) {
    await prisma.$executeRaw`UPDATE "Product" SET "priceBs" = "priceUSD" * ${data.rate} WHERE "userId" = ${userId}`
  }

  return NextResponse.json(data)
}
