import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken, updateMLItemPrice, updateMLItemStock } from '@/lib/ml-api'

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const token = await getValidAccessToken(userId)
  if (!token) return NextResponse.json({ error: 'ML no conectado' }, { status: 400 })

  const products = await prisma.product.findMany({
    where: { userId, mlSyncEnabled: true, mlItemId: { not: null }, isActive: true },
  })

  let synced = 0
  const errors: Array<{ id: string; error: string }> = []
  for (const p of products) {
    if (!p.mlItemId) continue
    try {
      await updateMLItemPrice(token, p.mlItemId, p.priceUSD)
      await updateMLItemStock(token, p.mlItemId, p.stock)
      await prisma.product.update({ where: { id: p.id }, data: { mlLastSync: new Date() } })
      synced += 1
    } catch (e: unknown) {
      errors.push({ id: p.id, error: e instanceof Error ? e.message : 'error' })
    }
  }

  await prisma.mLConnection.update({ where: { userId }, data: { lastSync: new Date() } })

  return NextResponse.json({ synced, errors, total: products.length })
}
