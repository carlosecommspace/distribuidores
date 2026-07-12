import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ReportKind = 'sellers' | 'clients' | 'sales' | 'requests' | 'inventory'

function parseRange(searchParams: URLSearchParams): { from: Date; to: Date } {
  const now = new Date()
  const to = searchParams.get('to')
  const from = searchParams.get('from')

  let toDate = now
  if (to) {
    const parsed = new Date(to)
    if (!isNaN(parsed.getTime())) {
      parsed.setHours(23, 59, 59, 999)
      toDate = parsed
    }
  }

  let fromDate = new Date(now)
  fromDate.setDate(now.getDate() - 30)
  fromDate.setHours(0, 0, 0, 0)
  if (from) {
    const parsed = new Date(from)
    if (!isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0)
      fromDate = parsed
    }
  }

  return { from: fromDate, to: toDate }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const { kind } = await params
  const validKinds: ReportKind[] = ['sellers', 'clients', 'sales', 'requests', 'inventory']
  if (!validKinds.includes(kind as ReportKind)) {
    return NextResponse.json({ error: 'kind inválido' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const { from, to } = parseRange(searchParams)

  const [user, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, company: true, phone: true },
    }),
    prisma.settings.findUnique({ where: { userId } }),
  ])

  const meta = {
    company: user?.company || user?.name || '—',
    email: user?.email || '',
    phone: user?.phone || '',
    from: from.toISOString(),
    to: to.toISOString(),
    generatedAt: new Date().toISOString(),
    rate: settings?.exchangeRate || 0,
  }

  if (kind === 'sellers') {
    const sellers = await prisma.seller.findMany({
      where: { ownerId: userId },
      include: {
        _count: { select: { clientsCreated: true, clientAssignments: true } },
        user: { select: { email: true } },
      },
      orderBy: { name: 'asc' },
    })
    const sellerIds = sellers.map((s) => s.id)
    const perSeller = await prisma.sale.groupBy({
      by: ['sellerId'],
      where: {
        userId,
        createdAt: { gte: from, lte: to },
        sellerId: { in: sellerIds },
      },
      _sum: { totalUSD: true },
      _count: { _all: true },
    })
    const salesMap = new Map(
      perSeller.map((r) => [r.sellerId, { total: r._sum.totalUSD || 0, count: r._count._all }]),
    )
    return NextResponse.json({
      kind,
      meta,
      title: 'Reporte de vendedores',
      rows: sellers.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.user?.email || null,
        phone: s.phone,
        isActive: s.isActive,
        clientsAssigned: s._count.clientAssignments,
        clientsCreated: s._count.clientsCreated,
        salesInPeriod: salesMap.get(s.id)?.count ?? 0,
        revenueInPeriodUSD: salesMap.get(s.id)?.total ?? 0,
      })),
    })
  }

  if (kind === 'clients') {
    const clients = await prisma.client.findMany({
      where: { userId },
      include: {
        priceList: { select: { name: true } },
      },
      orderBy: [{ totalPurchases: 'desc' }, { name: 'asc' }],
    })
    const clientIds = clients.map((c) => c.id)
    const perClient = await prisma.sale.groupBy({
      by: ['clientId'],
      where: {
        userId,
        createdAt: { gte: from, lte: to },
        clientId: { in: clientIds },
      },
      _sum: { totalUSD: true },
      _count: { _all: true },
    })
    const salesMap = new Map(
      perClient.map((r) => [r.clientId, { total: r._sum.totalUSD || 0, count: r._count._all }]),
    )
    return NextResponse.json({
      kind,
      meta,
      title: 'Reporte de clientes',
      rows: clients.map((c) => ({
        id: c.id,
        name: c.name,
        company: c.company,
        rif: c.rif,
        phone: c.phone,
        email: c.email,
        city: c.city,
        priceList: c.priceList?.name || null,
        totalPurchases: c.totalPurchases,
        lastPurchase: c.lastPurchase,
        salesInPeriod: salesMap.get(c.id)?.count ?? 0,
        revenueInPeriodUSD: salesMap.get(c.id)?.total ?? 0,
      })),
    })
  }

  if (kind === 'sales') {
    const sales = await prisma.sale.findMany({
      where: { userId, createdAt: { gte: from, lte: to } },
      include: {
        client: { select: { name: true, company: true } },
        seller: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const totalUSD = sales.reduce((s, x) => s + x.totalUSD, 0)
    const totalBs = sales.reduce((s, x) => s + x.totalBs, 0)
    return NextResponse.json({
      kind,
      meta: { ...meta, totalUSD, totalBs },
      title: 'Reporte de ventas',
      rows: sales.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        client: s.client?.name || null,
        clientCompany: s.client?.company || null,
        seller: s.seller?.name || null,
        channel: s.channel,
        paymentMethod: s.paymentMethod,
        paymentStatus: s.paymentStatus,
        itemsCount: s.items.length,
        unitsCount: s.items.reduce((a, i) => a + i.quantity, 0),
        totalUSD: s.totalUSD,
        totalBs: s.totalBs,
      })),
    })
  }

  if (kind === 'requests') {
    const requests = await prisma.productRequest.findMany({
      where: { userId, createdAt: { gte: from, lte: to } },
      include: {
        client: { select: { name: true, company: true } },
        seller: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const totalUSD = requests.reduce((s, x) => s + x.totalUSD, 0)
    const paidUSD = requests.reduce((s, x) => s + x.paidUSD, 0)
    return NextResponse.json({
      kind,
      meta: { ...meta, totalUSD, paidUSD },
      title: 'Reporte de pedidos',
      rows: requests.map((r) => ({
        id: r.id,
        code: r.code,
        createdAt: r.createdAt,
        status: r.status,
        client: r.client?.name || null,
        clientCompany: r.client?.company || null,
        seller: r.seller?.name || null,
        itemsCount: r._count.items,
        totalUSD: r.totalUSD,
        paidUSD: r.paidUSD,
        discountUSD: r.discountUSD,
      })),
    })
  }

  // inventory
  const products = await prisma.product.findMany({
    where: { userId, isActive: true },
    include: { categoryRel: { select: { name: true } } },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })
  const inventoryValue = products.reduce((s, p) => s + p.costUSD * p.stock, 0)
  const potentialRevenue = products.reduce((s, p) => s + p.priceUSD * p.stock, 0)
  return NextResponse.json({
    kind,
    meta: { ...meta, inventoryValue, potentialRevenue },
    title: 'Reporte de inventario',
    rows: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category || p.categoryRel?.name || null,
      unit: p.unit,
      stock: p.stock,
      stockMin: p.stockMin,
      costUSD: p.costUSD,
      priceUSD: p.priceUSD,
      valueUSD: p.costUSD * p.stock,
      lowStock: p.stock <= p.stockMin,
    })),
  })
}
