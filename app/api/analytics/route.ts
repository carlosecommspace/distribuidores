import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || '30d'

  const now = new Date()
  const from = new Date()
  if (period === 'today') from.setHours(0, 0, 0, 0)
  else if (period === '7d') from.setDate(now.getDate() - 7)
  else if (period === '30d') from.setDate(now.getDate() - 30)
  else if (period === '90d') from.setDate(now.getDate() - 90)
  else from.setDate(now.getDate() - 30)

  const sales = await prisma.sale.findMany({
    where: { userId, createdAt: { gte: from } },
    include: { items: { include: { product: true } }, client: true },
  })

  const totalUSD = sales.reduce((s, x) => s + x.totalUSD, 0)
  const totalBs = sales.reduce((s, x) => s + x.totalBs, 0)
  const transactions = sales.length
  const avgTicket = transactions ? totalUSD / transactions : 0

  // por día
  const daily: Record<string, { date: string; usd: number; count: number }> = {}
  for (const s of sales) {
    const d = s.createdAt.toISOString().slice(0, 10)
    if (!daily[d]) daily[d] = { date: d, usd: 0, count: 0 }
    daily[d].usd += s.totalUSD
    daily[d].count += 1
  }

  // por canal
  const byChannel: Record<string, number> = {}
  for (const s of sales) byChannel[s.channel] = (byChannel[s.channel] || 0) + s.totalUSD

  // por metodo de pago
  const byPayment: Record<string, number> = {}
  for (const s of sales) byPayment[s.paymentMethod] = (byPayment[s.paymentMethod] || 0) + s.totalUSD

  // top productos
  const productMap: Record<string, { name: string; units: number; revenue: number }> = {}
  for (const s of sales) {
    for (const it of s.items) {
      const k = it.productId
      if (!productMap[k]) productMap[k] = { name: it.product.name, units: 0, revenue: 0 }
      productMap[k].units += it.quantity
      productMap[k].revenue += it.subtotalUSD
    }
  }
  const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // top clientes
  const clientMap: Record<string, { name: string; orders: number; total: number; lastPurchase: Date | null }> = {}
  for (const s of sales) {
    if (!s.clientId || !s.client) continue
    const k = s.clientId
    if (!clientMap[k]) clientMap[k] = { name: s.client.name, orders: 0, total: 0, lastPurchase: null }
    clientMap[k].orders += 1
    clientMap[k].total += s.totalUSD
    if (!clientMap[k].lastPurchase || s.createdAt > clientMap[k].lastPurchase) {
      clientMap[k].lastPurchase = s.createdAt
    }
  }
  const topClients = Object.values(clientMap).sort((a, b) => b.total - a.total).slice(0, 10)

  // inventario
  const products = await prisma.product.findMany({ where: { userId, isActive: true } })
  const lowStock = products.filter((p) => p.stock <= p.stockMin)
  const stale = products.filter((p) => {
    return !sales.some((s) => s.items.some((i) => i.productId === p.id))
  })
  const inventoryValue = products.reduce((s, p) => s + p.costUSD * p.stock, 0)

  return NextResponse.json({
    period,
    totalUSD,
    totalBs,
    transactions,
    avgTicket,
    daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
    byChannel: Object.entries(byChannel).map(([name, value]) => ({ name, value })),
    byPayment: Object.entries(byPayment).map(([name, value]) => ({ name, value })),
    topProducts,
    topClients,
    lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, stockMin: p.stockMin })),
    stale: stale.slice(0, 20).map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock })),
    inventoryValue,
  })
}
