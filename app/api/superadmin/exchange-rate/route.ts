import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchBCVRate } from '@/lib/bcv'
import { z } from 'zod'

async function requireSuperadmin() {
  const session = await auth()
  const su = session?.user as { role?: string; id?: string } | undefined
  if (!su || su.role !== 'superadmin') return null
  return su
}

/**
 * Devuelve el rate global vigente + los últimos logs. Público solo para
 * superadmin (los merchants consumen a traves del cron que los propaga a
 * Settings, no leen este endpoint).
 */
export async function GET() {
  const su = await requireSuperadmin()
  if (!su) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const [global, logs] = await Promise.all([
    prisma.globalExchangeRate.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    }),
    prisma.exchangeRateLog.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
  ])

  return NextResponse.json({ global, logs })
}

const patchSchema = z.object({
  action: z.enum(['manual', 'refresh']),
  currency: z.enum(['USD', 'EUR']).optional(),
  usdRate: z.number().positive().optional(),
  eurRate: z.number().positive().optional(),
})

/**
 * Actualiza la tasa global. Dos modos:
 *  - action: 'manual' → setea los valores usdRate y/o eurRate provistos.
 *  - action: 'refresh' → consulta BCV y guarda la tasa devuelta.
 * En ambos casos propaga a Settings de todos los merchants (para que los
 * consumers existentes que leen Settings.exchangeRate sigan funcionando).
 */
export async function POST(req: Request) {
  const su = await requireSuperadmin()
  if (!su) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 })
  const { action, currency, usdRate: usdIn, eurRate: eurIn } = parsed.data

  let usdRate: number | null = null
  let eurRate: number | null = null
  let source = 'manual'

  if (action === 'refresh') {
    const targetCurrency = currency || 'USD'
    const data = await fetchBCVRate(targetCurrency)
    if (data.rate <= 0) return NextResponse.json({ error: 'rate unavailable' }, { status: 502 })
    source = data.source
    if (targetCurrency === 'USD') usdRate = data.rate
    else eurRate = data.rate
    await prisma.exchangeRateLog.create({
      data: { rate: data.rate, source: data.source, currency: targetCurrency },
    })
  } else {
    if (usdIn !== undefined) usdRate = usdIn
    if (eurIn !== undefined) eurRate = eurIn
    if (usdRate === null && eurRate === null) {
      return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
    }
    if (usdRate !== null) {
      await prisma.exchangeRateLog.create({
        data: { rate: usdRate, source: 'manual', currency: 'USD' },
      })
    }
    if (eurRate !== null) {
      await prisma.exchangeRateLog.create({
        data: { rate: eurRate, source: 'manual', currency: 'EUR' },
      })
    }
  }

  const now = new Date()
  const updates: Record<string, unknown> = { source, updatedById: su.id ?? null }
  if (usdRate !== null) {
    updates.usdRate = usdRate
    updates.usdUpdatedAt = now
  }
  if (eurRate !== null) {
    updates.eurRate = eurRate
    updates.eurUpdatedAt = now
  }

  const globalRate = await prisma.globalExchangeRate.upsert({
    where: { id: 'singleton' },
    update: updates,
    create: { id: 'singleton', ...updates },
  })

  await propagateToMerchants({ usdRate, eurRate })

  return NextResponse.json({ ok: true, global: globalRate })
}

/**
 * Propaga la tasa a Settings de todos los merchants y recalcula
 * Product.priceBs de los que tienen la moneda cambiada como principal.
 */
async function propagateToMerchants({
  usdRate,
  eurRate,
}: {
  usdRate: number | null
  eurRate: number | null
}) {
  const now = new Date()
  if (usdRate !== null) {
    await prisma.settings.updateMany({
      data: { exchangeRate: usdRate, lastRateUpdate: now },
    })
    await prisma.$executeRaw`UPDATE "Product" p
       SET "priceBs" = "priceUSD" * ${usdRate}
       FROM "Settings" s
       WHERE p."userId" = s."userId" AND s."primaryCurrency" = 'USD'`
  }
  if (eurRate !== null) {
    await prisma.settings.updateMany({
      data: { eurExchangeRate: eurRate, lastEurRateUpdate: now },
    })
    await prisma.$executeRaw`UPDATE "Product" p
       SET "priceBs" = "priceUSD" * ${eurRate}
       FROM "Settings" s
       WHERE p."userId" = s."userId" AND s."primaryCurrency" = 'EUR'`
  }
}
