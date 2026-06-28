import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  unit: z.string().default('unidad'),
  images: z.array(z.string()).default([]),
  costUSD: z.coerce.number().min(0).default(0),
  priceUSD: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0).default(0),
  stockMin: z.coerce.number().int().min(0).default(5),
  stockMax: z.coerce.number().int().min(0).optional().nullable(),
  mlSyncEnabled: z.boolean().default(false),
  mlCategoryId: z.string().optional().nullable(),
  mlListingType: z.string().default('gold_special'),
  isActive: z.boolean().default(true),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || undefined
  const category = searchParams.get('category') || undefined
  const categoryId = searchParams.get('categoryId') || undefined

  const products = await prisma.product.findMany({
    where: {
      userId,
      ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] }),
      ...(categoryId && { categoryId }),
      ...(!categoryId && category && { category }),
    },
    include: { categoryRel: { select: { id: true, name: true, color: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(products)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const body = await req.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const settings = await prisma.settings.findUnique({ where: { userId } })
  const rate = settings?.primaryCurrency === 'EUR'
    ? settings?.eurExchangeRate || 0
    : settings?.exchangeRate || 0
  const data = parsed.data
  const margin = data.costUSD > 0 ? ((data.priceUSD - data.costUSD) / data.costUSD) * 100 : 0

  // Si vino categoryId, denormaliza el nombre a Product.category
  let categoryName: string | null = data.category ?? null
  if (data.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: data.categoryId, userId } })
    if (!cat) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 400 })
    categoryName = cat.name
  }

  try {
    const product = await prisma.product.create({
      data: {
        ...data,
        category: categoryName,
        categoryId: data.categoryId || null,
        userId,
        priceBs: data.priceUSD * rate,
        marginPercent: margin,
      },
    })
    return NextResponse.json(product, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error'
    if (msg.includes('Unique')) return NextResponse.json({ error: 'SKU duplicado' }, { status: 409 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
