import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { fetchBCVRate } from '../lib/bcv'
import { getValidAccessToken, updateMLItemPrice, updateMLItemStock } from '../lib/ml-api'

async function runOnce() {
  const rate = await fetchBCVRate()
  if (rate.rate <= 0) {
    console.log('[cron] BCV rate unavailable')
    return
  }
  await prisma.exchangeRateLog.create({ data: { rate: rate.rate, source: rate.source } })
  const settingsList = await prisma.settings.findMany({ where: { autoUpdateRate: true } })

  for (const s of settingsList) {
    try {
      await prisma.settings.update({
        where: { userId: s.userId },
        data: { exchangeRate: rate.rate, lastRateUpdate: new Date() },
      })
      await prisma.$executeRaw`UPDATE "Product" SET "priceBs" = "priceUSD" * ${rate.rate} WHERE "userId" = ${s.userId}`

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
  console.log('[cron] price-sync done', rate.rate)
}

if (process.env.CRON_RUN_ONCE) {
  runOnce().then(() => process.exit(0))
} else {
  cron.schedule('0 * * * *', () => {
    runOnce().catch((e) => console.error(e))
  })
  console.log('[cron] price-sync scheduled hourly')
}
