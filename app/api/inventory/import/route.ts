import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseCSV } from '@/lib/csv'

interface ImportRow {
  sku?: string
  nombre?: string
  descripcion?: string
  categoria_slug?: string
  marca?: string
  unidad?: string
  costo_usd?: string
  precio_usd?: string
  stock?: string
  stock_min?: string
  stock_max?: string
  activo?: string
}

function num(value: string | undefined, fallback = 0): number {
  if (value === undefined || value === '') return fallback
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

function intNum(value: string | undefined, fallback = 0): number {
  return Math.floor(num(value, fallback))
}

function boolish(value: string | undefined, fallback = true): boolean {
  if (value === undefined || value === '') return fallback
  const v = value.toLowerCase().trim()
  return ['si', 'sí', 'yes', 'true', '1', 'activo'].includes(v)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  let csv = ''
  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const body = (await req.json()) as { csv?: string }
    csv = body.csv || ''
  } else {
    csv = await req.text()
  }
  if (!csv.trim()) return NextResponse.json({ error: 'CSV vacío' }, { status: 400 })

  const rows = parseCSV(csv) as unknown as ImportRow[]
  if (rows.length === 0) return NextResponse.json({ error: 'Sin filas' }, { status: 400 })

  const settings = await prisma.settings.findUnique({ where: { userId } })
  const rate = settings?.primaryCurrency === 'EUR'
    ? settings?.eurExchangeRate || 0
    : settings?.exchangeRate || 0

  // Pre-cargar categorías por slug para resolver FK
  const categories = await prisma.category.findMany({ where: { userId }, select: { id: true, slug: true, name: true } })
  const catBySlug = new Map(categories.map((c) => [c.slug, c]))

  const stats = { created: 0, updated: 0, skipped: 0, errors: [] as Array<{ row: number; error: string }> }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowIdx = i + 2 // contando header
    const sku = (r.sku || '').trim()
    const name = (r.nombre || '').trim()

    if (!sku) { stats.skipped++; continue }
    if (!name) {
      stats.errors.push({ row: rowIdx, error: `Nombre vacío para SKU ${sku}` })
      continue
    }

    const priceUSD = num(r.precio_usd)
    if (priceUSD <= 0) {
      stats.errors.push({ row: rowIdx, error: `Precio USD inválido para SKU ${sku}` })
      continue
    }
    const costUSD = num(r.costo_usd)
    const margin = costUSD > 0 ? ((priceUSD - costUSD) / costUSD) * 100 : 0

    let categoryId: string | null = null
    let categoryName: string | null = (r.categoria_slug || '').trim() || null
    if (r.categoria_slug) {
      const cat = catBySlug.get(r.categoria_slug.trim())
      if (!cat) {
        stats.errors.push({ row: rowIdx, error: `Categoría no encontrada: ${r.categoria_slug}` })
        continue
      }
      categoryId = cat.id
      categoryName = cat.name
    }

    const data = {
      name,
      description: (r.descripcion || '').trim() || null,
      category: categoryName,
      categoryId,
      brand: (r.marca || '').trim() || null,
      unit: (r.unidad || 'unidad').trim() || 'unidad',
      costUSD,
      priceUSD,
      priceBs: priceUSD * rate,
      marginPercent: margin,
      stock: intNum(r.stock),
      stockMin: intNum(r.stock_min, 5),
      stockMax: r.stock_max && r.stock_max.trim() !== '' ? intNum(r.stock_max) : null,
      isActive: boolish(r.activo, true),
    }

    try {
      const existing = await prisma.product.findUnique({ where: { userId_sku: { userId, sku } } })
      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data })
        stats.updated++
      } else {
        await prisma.product.create({ data: { ...data, userId, sku } })
        stats.created++
      }
    } catch (e: unknown) {
      stats.errors.push({ row: rowIdx, error: e instanceof Error ? e.message : 'error' })
    }
  }

  return NextResponse.json(stats)
}
