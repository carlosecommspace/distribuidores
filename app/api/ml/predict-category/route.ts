import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getValidAccessToken, predictMLCategory } from '@/lib/ml-api'
import { z } from 'zod'

const schema = z.object({
  productIds: z.array(z.string()).max(50),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const token = await getValidAccessToken(userId)
  if (!token) return NextResponse.json({ error: 'ML no conectado' }, { status: 400 })

  const { prisma } = await import('@/lib/prisma')
  const products = await prisma.product.findMany({
    where: { id: { in: parsed.data.productIds }, userId },
    select: { id: true, name: true, mlCategoryId: true },
  })

  // Concurrency 5
  const results: Record<string, { categoryId: string | null; categoryName: string; predictionScore: number }> = {}
  const chunks: typeof products[] = []
  const CONCURRENCY = 5
  for (let i = 0; i < products.length; i += CONCURRENCY) {
    chunks.push(products.slice(i, i + CONCURRENCY))
  }
  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (p) => {
      // Si ya tiene categoria configurada, respetarla y no consumir requests
      if (p.mlCategoryId) {
        results[p.id] = { categoryId: p.mlCategoryId, categoryName: '', predictionScore: 1 }
        return
      }
      const pred = await predictMLCategory(token, p.name)
      results[p.id] = pred
        ? { categoryId: pred.categoryId, categoryName: pred.categoryName, predictionScore: pred.predictionScore }
        : { categoryId: null, categoryName: '', predictionScore: 0 }
    }))
  }

  return NextResponse.json({ predictions: results })
}
