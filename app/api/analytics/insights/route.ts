import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface ClaudeResp {
  content: Array<{ type: string; text?: string }>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function callClaude(system: string, user: string, attempts = 3): Promise<ClaudeResp> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60_000)
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'accept-encoding': 'identity',
          accept: 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          system,
          messages: [{ role: 'user', content: user }],
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        const err = new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`) as Error & { status?: number }
        err.status = res.status
        if ((res.status === 429 || res.status >= 500) && i < attempts - 1) {
          await sleep(500 * Math.pow(2, i))
          continue
        }
        throw err
      }
      return (await res.json()) as ClaudeResp
    } catch (e) {
      lastErr = e
      if (i === attempts - 1) throw e
      await sleep(500 * Math.pow(2, i))
    }
  }
  throw lastErr
}

function daysBack(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

interface AggregatedData {
  period: string
  currency: string
  periodDays: number
  totals: {
    revenueUSD: number
    transactions: number
    avgTicketUSD: number
    uniqueClients: number
  }
  vsPrevPeriod: {
    revenueChangePct: number | null
    transactionsChangePct: number | null
  }
  channels: Array<{ name: string; revenueUSD: number; transactions: number }>
  paymentMethods: Array<{ name: string; revenueUSD: number }>
  topProducts: Array<{
    name: string
    sku: string
    unitsSold: number
    revenueUSD: number
    marginPct: number | null
    stock: number
  }>
  lowMarginTopSellers: Array<{ name: string; marginPct: number; unitsSold: number }>
  topClients: Array<{
    name: string
    company: string | null
    orders: number
    totalUSD: number
    lastPurchaseDaysAgo: number
  }>
  atRiskClients: Array<{
    name: string
    company: string | null
    priorOrders: number
    totalUSD: number
    lastPurchaseDaysAgo: number
  }>
  lowStock: Array<{ name: string; sku: string; stock: number; stockMin: number; lastMonthSales: number }>
  stale: Array<{ name: string; sku: string; stock: number; costUSD: number; capitalLocked: number }>
  inventory: {
    totalValueUSD: number
    activeProductCount: number
    outOfStockCount: number
  }
  waLeadsCount: number
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'IA no configurada en el servidor.' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const fromParam = body?.from as string | undefined
  const toParam = body?.to as string | undefined

  const now = new Date()
  let period: string
  let periodDays: number
  let from: Date
  let to: Date | null = null

  if (fromParam) {
    const parsedFrom = new Date(fromParam)
    if (isNaN(parsedFrom.getTime())) {
      return NextResponse.json({ error: 'from inválido' }, { status: 400 })
    }
    from = parsedFrom
    if (toParam) {
      const parsedTo = new Date(toParam)
      if (!isNaN(parsedTo.getTime())) {
        to = parsedTo
        to.setHours(23, 59, 59, 999)
      }
    }
    const end = to || now
    periodDays = Math.max(1, Math.round((end.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)))
    period = 'custom'
  } else {
    period = (body?.period as string) || '30d'
    periodDays = period === 'today' ? 1
      : period === '7d' ? 7
      : period === '90d' ? 90
      : period === 'ytd' ? Math.max(1, Math.round((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (24 * 60 * 60 * 1000)))
      : 30
    from = daysBack(periodDays)
  }
  const prevFrom = new Date(from.getTime() - periodDays * 24 * 60 * 60 * 1000)

  // Ventas del periodo actual + previo (para comparar) + inventario + clientes
  const [sales, prevSales, products, clients, waLeadsCount] = await Promise.all([
    prisma.sale.findMany({
      where: {
        userId,
        createdAt: to ? { gte: from, lte: to } : { gte: from },
      },
      include: { items: { include: { product: true } }, client: true },
    }),
    prisma.sale.findMany({
      where: { userId, createdAt: { gte: prevFrom, lt: from } },
      select: { totalUSD: true },
    }),
    prisma.product.findMany({
      where: { userId, isActive: true },
      select: {
        id: true, sku: true, name: true, stock: true, stockMin: true,
        costUSD: true, priceUSD: true, category: true, updatedAt: true,
      },
    }),
    prisma.client.findMany({
      where: { userId },
      select: {
        id: true, name: true, company: true, totalPurchases: true, lastPurchase: true, type: true,
      },
    }),
    prisma.websiteLead.count({
      where: {
        userId,
        createdAt: to ? { gte: from, lte: to } : { gte: from },
      },
    }).catch(() => 0),
  ])

  // Totales
  const revenueUSD = sales.reduce((s, x) => s + x.totalUSD, 0)
  const transactions = sales.length
  const uniqueClients = new Set(sales.filter((s) => s.clientId).map((s) => s.clientId)).size
  const avgTicketUSD = transactions ? revenueUSD / transactions : 0

  const prevRevenueUSD = prevSales.reduce((s, x) => s + x.totalUSD, 0)
  const prevTransactions = prevSales.length
  const revenueChangePct = prevRevenueUSD > 0
    ? ((revenueUSD - prevRevenueUSD) / prevRevenueUSD) * 100
    : null
  const transactionsChangePct = prevTransactions > 0
    ? ((transactions - prevTransactions) / prevTransactions) * 100
    : null

  // Canales y pagos
  const channelMap: Record<string, { revenueUSD: number; transactions: number }> = {}
  for (const s of sales) {
    if (!channelMap[s.channel]) channelMap[s.channel] = { revenueUSD: 0, transactions: 0 }
    channelMap[s.channel].revenueUSD += s.totalUSD
    channelMap[s.channel].transactions += 1
  }
  const paymentMap: Record<string, number> = {}
  for (const s of sales) paymentMap[s.paymentMethod] = (paymentMap[s.paymentMethod] || 0) + s.totalUSD

  // Productos: unidades, ingresos, margen
  const productStatsMap: Record<string, {
    name: string
    sku: string
    unitsSold: number
    revenueUSD: number
    costTotal: number
    stock: number
  }> = {}
  for (const s of sales) {
    for (const it of s.items) {
      const k = it.productId
      if (!productStatsMap[k]) {
        productStatsMap[k] = {
          name: it.product.name,
          sku: it.product.sku,
          unitsSold: 0,
          revenueUSD: 0,
          costTotal: 0,
          stock: it.product.stock,
        }
      }
      productStatsMap[k].unitsSold += it.quantity
      productStatsMap[k].revenueUSD += it.subtotalUSD
      productStatsMap[k].costTotal += (it.product.costUSD || 0) * it.quantity
    }
  }
  const productStats = Object.values(productStatsMap).map((p) => {
    const marginPct = p.revenueUSD > 0 ? ((p.revenueUSD - p.costTotal) / p.revenueUSD) * 100 : null
    return { ...p, marginPct }
  })
  const topProducts = [...productStats].sort((a, b) => b.revenueUSD - a.revenueUSD).slice(0, 8).map((p) => ({
    name: p.name, sku: p.sku, unitsSold: p.unitsSold,
    revenueUSD: Math.round(p.revenueUSD * 100) / 100,
    marginPct: p.marginPct !== null ? Math.round(p.marginPct * 10) / 10 : null,
    stock: p.stock,
  }))
  // Top sellers con margen bajo (<20%) — señal de que se está vendiendo pero no ganando
  const lowMarginTopSellers = productStats
    .filter((p) => p.marginPct !== null && p.marginPct < 20 && p.revenueUSD > revenueUSD * 0.03)
    .sort((a, b) => b.revenueUSD - a.revenueUSD)
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      marginPct: Math.round((p.marginPct as number) * 10) / 10,
      unitsSold: p.unitsSold,
    }))

  // Top clientes
  const clientStatsMap: Record<string, {
    name: string
    company: string | null
    orders: number
    totalUSD: number
    lastPurchase: Date | null
  }> = {}
  for (const s of sales) {
    if (!s.clientId || !s.client) continue
    const k = s.clientId
    if (!clientStatsMap[k]) {
      clientStatsMap[k] = { name: s.client.name, company: s.client.company, orders: 0, totalUSD: 0, lastPurchase: null }
    }
    clientStatsMap[k].orders += 1
    clientStatsMap[k].totalUSD += s.totalUSD
    if (!clientStatsMap[k].lastPurchase || s.createdAt > clientStatsMap[k].lastPurchase) {
      clientStatsMap[k].lastPurchase = s.createdAt
    }
  }
  const topClients = Object.values(clientStatsMap)
    .sort((a, b) => b.totalUSD - a.totalUSD)
    .slice(0, 5)
    .map((c) => ({
      name: c.name,
      company: c.company,
      orders: c.orders,
      totalUSD: Math.round(c.totalUSD * 100) / 100,
      lastPurchaseDaysAgo: c.lastPurchase
        ? Math.floor((now.getTime() - c.lastPurchase.getTime()) / 86400000)
        : 999,
    }))

  // At-risk: 2+ compras historicas pero sin comprar en 60+ dias
  const atRiskClients = clients
    .filter((c) => {
      if (!c.lastPurchase || c.totalPurchases < 2) return false
      const days = Math.floor((now.getTime() - new Date(c.lastPurchase).getTime()) / 86400000)
      return days >= 60 && days <= 365
    })
    .sort((a, b) => b.totalPurchases - a.totalPurchases)
    .slice(0, 5)
    .map((c) => ({
      name: c.name,
      company: c.company,
      priorOrders: Math.round(c.totalPurchases), // aproximado, es total gastado; el modelo lo entiende
      totalUSD: Math.round(c.totalPurchases * 100) / 100,
      lastPurchaseDaysAgo: c.lastPurchase
        ? Math.floor((now.getTime() - new Date(c.lastPurchase).getTime()) / 86400000)
        : 999,
    }))

  // Inventario
  const lowStock = products
    .filter((p) => p.stock <= p.stockMin)
    .slice(0, 10)
    .map((p) => {
      const sold = productStatsMap[p.id]?.unitsSold || 0
      return { name: p.name, sku: p.sku, stock: p.stock, stockMin: p.stockMin, lastMonthSales: sold }
    })
  const stale = products
    .filter((p) => p.stock > 0 && !productStatsMap[p.id])
    .slice(0, 10)
    .map((p) => ({
      name: p.name, sku: p.sku, stock: p.stock,
      costUSD: p.costUSD,
      capitalLocked: Math.round(p.costUSD * p.stock * 100) / 100,
    }))
  const inventoryValue = products.reduce((s, p) => s + p.costUSD * p.stock, 0)
  const outOfStockCount = products.filter((p) => p.stock === 0).length

  const data: AggregatedData = {
    period,
    currency: 'USD',
    periodDays,
    totals: {
      revenueUSD: Math.round(revenueUSD * 100) / 100,
      transactions,
      avgTicketUSD: Math.round(avgTicketUSD * 100) / 100,
      uniqueClients,
    },
    vsPrevPeriod: {
      revenueChangePct: revenueChangePct !== null ? Math.round(revenueChangePct * 10) / 10 : null,
      transactionsChangePct: transactionsChangePct !== null ? Math.round(transactionsChangePct * 10) / 10 : null,
    },
    channels: Object.entries(channelMap).map(([name, v]) => ({
      name,
      revenueUSD: Math.round(v.revenueUSD * 100) / 100,
      transactions: v.transactions,
    })),
    paymentMethods: Object.entries(paymentMap).map(([name, v]) => ({
      name,
      revenueUSD: Math.round(v * 100) / 100,
    })),
    topProducts,
    lowMarginTopSellers,
    topClients,
    atRiskClients,
    lowStock,
    stale,
    inventory: {
      totalValueUSD: Math.round(inventoryValue * 100) / 100,
      activeProductCount: products.length,
      outOfStockCount,
    },
    waLeadsCount,
  }

  const system = `Eres un consultor de negocios experto en distribuidoras venezolanas. Analizas datos operacionales y devuelves insights ACCIONABLES: cosas que el dueño puede hacer esta semana para mejorar su negocio. Escribes en español venezolano neutro, directo, sin adjetivos vacíos, sin decir "cabe destacar" ni "en resumen".

REGLAS ESTRICTAS:
- NUNCA inventes cifras. Si un dato no está en el input, no lo menciones.
- Cada insight debe estar ANCLADO en un dato específico del input (menciona nombres de productos, clientes, porcentajes exactos).
- Prioriza insights de alto impacto sobre insights obvios.
- Si algo no tiene datos suficientes para un insight sólido (ej: no hay ventas en el periodo), no lo fuerces — devuelve menos insights pero buenos.
- Máximo 8 insights. Menos si no hay contenido suficiente.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma:
{
  "summary": "1-2 oraciones ejecutivas del estado del negocio en el periodo.",
  "insights": [
    {
      "type": "opportunity" | "warning" | "action" | "positive",
      "title": "título corto (max 60 chars)",
      "detail": "1-2 oraciones con los números específicos que soportan esto",
      "action": "un siguiente paso concreto (opcional)"
    }
  ]
}

Tipos:
- opportunity: oportunidades de crecimiento o mejora (ej: producto que se está agotando, cliente que puede pedirle mas)
- warning: riesgos o problemas urgentes (ej: capital bloqueado en stale, margen negativo)
- action: acción operativa específica (ej: llamar a un cliente en riesgo, reponer un top seller)
- positive: reconocer algo que va bien (usar con moderación, máximo 1-2)

Responde SOLO con el JSON, sin backticks ni prefijos.`

  const user = `Analiza estos datos operacionales de los últimos ${periodDays} días y genera insights accionables.

DATOS:
${JSON.stringify(data, null, 2)}

CONTEXTO ADICIONAL:
- Un cliente "at-risk" es alguien que compraba regular y lleva 60+ días sin comprar.
- "lastMonthSales" en lowStock es cuántas unidades se vendieron en el periodo.
- "stale.capitalLocked" es capital muerto en productos sin movimiento.
- "lowMarginTopSellers" son productos que venden bien pero dejan poca ganancia (< 20% margen).
- Si "vsPrevPeriod" tiene valores, úsalos para hablar de tendencias.

Devuelve el JSON.`

  try {
    const resp = await callClaude(system, user)
    const text = resp.content.find((b) => b.type === 'text' && b.text)?.text?.trim() || ''
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    let out
    try {
      out = JSON.parse(cleaned)
    } catch {
      console.error('[insights] invalid JSON from claude:', cleaned.slice(0, 400))
      return NextResponse.json({ error: 'La IA devolvió una respuesta inválida. Intenta de nuevo.' }, { status: 502 })
    }
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      period,
      summary: out.summary || '',
      insights: Array.isArray(out.insights) ? out.insights.slice(0, 8) : [],
      meta: {
        salesInPeriod: transactions,
        revenueInPeriodUSD: data.totals.revenueUSD,
      },
    })
  } catch (e) {
    const err = e as { status?: number; message?: string }
    console.error('[insights] Claude error', err.status, err.message)
    return NextResponse.json({ error: 'No se pudo generar los insights. Intenta de nuevo.' }, { status: 502 })
  }
}
