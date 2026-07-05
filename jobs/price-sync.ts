import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { fetchBCVRate } from '../lib/bcv'
import { getValidAccessToken, updateMLItemPrice, updateMLItemStock } from '../lib/ml-api'

async function runOnce() {
  const [usdRate, eurRate] = await Promise.all([
    fetchBCVRate('USD'),
    fetchBCVRate('EUR'),
  ])

  if (usdRate.rate > 0) {
    await prisma.exchangeRateLog.create({
      data: { rate: usdRate.rate, source: usdRate.source, currency: 'USD' },
    })
  }
  if (eurRate.rate > 0) {
    await prisma.exchangeRateLog.create({
      data: { rate: eurRate.rate, source: eurRate.source, currency: 'EUR' },
    })
  }

  const settingsList = await prisma.settings.findMany({
    where: { OR: [{ autoUpdateRate: true }, { autoUpdateEurRate: true }] },
  })

  for (const s of settingsList) {
    try {
      const updates: Record<string, unknown> = {}
      if (s.autoUpdateRate && usdRate.rate > 0) {
        updates.exchangeRate = usdRate.rate
        updates.lastRateUpdate = new Date()
      }
      if (s.autoUpdateEurRate && eurRate.rate > 0) {
        updates.eurExchangeRate = eurRate.rate
        updates.lastEurRateUpdate = new Date()
      }
      if (Object.keys(updates).length === 0) continue

      const updated = await prisma.settings.update({ where: { userId: s.userId }, data: updates })
      const activeRate =
        updated.primaryCurrency === 'EUR' ? updated.eurExchangeRate : updated.exchangeRate
      if (activeRate > 0) {
        await prisma.$executeRaw`UPDATE "Product" SET "priceBs" = "priceUSD" * ${activeRate} WHERE "userId" = ${s.userId}`
      }

      if (!s.mlAutoSync) continue
      const token = await getValidAccessToken(s.userId)
      if (!token) continue
      const products = await prisma.product.findMany({
        where: { userId: s.userId, mlSyncEnabled: true, mlItemId: { not: null }, isActive: true },
      })
      for (const p of products) {
        if (!p.mlItemId) continue
        try {
          await updateMLItemPrice(token, p.mlItemId, p.priceUSD)
          await updateMLItemStock(token, p.mlItemId, p.stock)
          await prisma.product.update({ where: { id: p.id }, data: { mlLastSync: new Date() } })
        } catch (err) {
          console.error('[cron] product sync failed', p.id, err)
        }
      }
    } catch (err) {
      console.error('[cron] user run failed', s.userId, err)
    }
  }
  console.log('[cron] price-sync done · USD', usdRate.rate, '· EUR', eurRate.rate)
}

/**
 * Purga mensajes WhatsApp fuera de la ventana de retención de cada tenant.
 * settings.waRetentionDays === 0 → modo privado, borra TODOS al día siguiente.
 * settings.waRetentionDays === -1 o null → sin límite.
 */
async function purgeWhatsAppMessages() {
  const tenants = await prisma.settings.findMany({
    where: { waRetentionDays: { gt: 0 } },
    select: { userId: true, waRetentionDays: true },
  })
  for (const t of tenants) {
    const cutoff = new Date(Date.now() - t.waRetentionDays * 24 * 60 * 60 * 1000)
    const r = await prisma.whatsAppMessage.deleteMany({
      where: { userId: t.userId, createdAt: { lt: cutoff } },
    }).catch((e) => { console.error('[cron] purge wa msgs failed', t.userId, e); return { count: 0 } })
    if (r.count > 0) console.log('[cron] purged', r.count, 'wa messages for', t.userId)
  }
}

if (process.env.CRON_RUN_ONCE) {
  runOnce().then(() => purgeWhatsAppMessages()).then(() => process.exit(0))
} else {
  cron.schedule('0 * * * *', () => {
    runOnce().catch((e) => console.error(e))
  })
  // Purga diaria a las 03:00 UTC
  cron.schedule('0 3 * * *', () => {
    purgeWhatsAppMessages().catch((e) => console.error(e))
  })
  console.log('[cron] price-sync hourly, wa-purge daily')
}
