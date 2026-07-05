import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken, publishMLItemFull, predictMLCategory } from '@/lib/ml-api'
import { z } from 'zod'

const itemSchema = z.object({
  productId: z.string(),
  categoryId: z.string().optional(),
  listingType: z.string().optional(),
})

const schema = z.object({
  items: z.array(itemSchema).min(1).max(50),
})

const CONCURRENCY = 5

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const token = await getValidAccessToken(userId)
  if (!token) return NextResponse.json({ error: 'ML no conectado' }, { status: 400 })

  const products = await prisma.product.findMany({
    where: { id: { in: parsed.data.items.map((i) => i.productId) }, userId, isActive: true },
    select: {
      id: true, sku: true, name: true, description: true, priceUSD: true, stock: true,
      images: true, mlItemId: true, mlCategoryId: true, mlListingType: true,
    },
  })
  const productMap = new Map(products.map((p) => [p.id, p]))
  const overridesMap = new Map(parsed.data.items.map((i) => [i.productId, i]))

  const publicBase = (process.env.APP_PUBLIC_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '')

  interface Result {
    productId: string
    productName: string
    ok: boolean
    mlItemId?: string
    permalink?: string
    error?: string
    skipped?: 'already_published' | 'not_found' | 'no_stock' | 'no_category'
  }
  const results: Result[] = []

  const runOne = async (productId: string): Promise<Result> => {
    const p = productMap.get(productId)
    if (!p) return { productId, productName: '?', ok: false, skipped: 'not_found', error: 'Producto no encontrado' }
    if (p.mlItemId) return { productId, productName: p.name, ok: false, skipped: 'already_published', error: 'Ya publicado en ML', mlItemId: p.mlItemId }
    if (p.stock <= 0) return { productId, productName: p.name, ok: false, skipped: 'no_stock', error: 'Sin stock' }

    const override = overridesMap.get(productId)
    let categoryId = override?.categoryId || p.mlCategoryId || ''

    // Fallback: si el frontend no pasa categoria y no hay guardada, intentar predecir
    if (!categoryId) {
      const pred = await predictMLCategory(token, p.name)
      if (pred?.categoryId) categoryId = pred.categoryId
    }
    if (!categoryId) {
      return { productId, productName: p.name, ok: false, skipped: 'no_category', error: 'No se pudo determinar la categoría de ML' }
    }

    const listingType = override?.listingType || p.mlListingType || 'gold_special'

    // Convertir URLs de imagenes: las que apuntan a /api/uploads/xxx (auth-protegidas)
    // ML no las puede descargar. Preferimos absolute URLs publicas.
    // Como fallback usamos /api/site-assets/{id} que sirve producto_image publicamente si el sitio esta publicado.
    const pictures = (p.images || []).slice(0, 12).map((u) => {
      if (u.startsWith('http')) return u
      // Convertir /api/uploads/{id} -> /api/site-assets/{id}
      const m = u.match(/\/api\/uploads\/([a-zA-Z0-9_-]+)/)
      const path = m ? `/api/site-assets/${m[1]}` : u
      return publicBase ? `${publicBase}${path}` : path
    }).filter((u) => u.startsWith('http'))

    const res = await publishMLItemFull(token, {
      title: p.name,
      categoryId,
      priceUSD: p.priceUSD,
      stock: p.stock,
      listingType,
      description: p.description || undefined,
      pictures,
    })

    if (!res.ok) {
      return {
        productId,
        productName: p.name,
        ok: false,
        error: res.error || 'error publicando',
      }
    }

    // Persistir en el Product
    await prisma.product.update({
      where: { id: p.id },
      data: {
        mlItemId: res.mlItemId,
        mlStatus: res.status,
        mlCategoryId: categoryId,
        mlSyncEnabled: true,
        mlLastSync: new Date(),
      },
    })

    return {
      productId,
      productName: p.name,
      ok: true,
      mlItemId: res.mlItemId,
      permalink: res.permalink,
    }
  }

  // Publicar con concurrency limit
  const ids = parsed.data.items.map((i) => i.productId)
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY)
    const chunkResults = await Promise.all(chunk.map(runOne))
    results.push(...chunkResults)
  }

  return NextResponse.json({
    published: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  })
}
