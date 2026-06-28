import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { slugify } from '@/lib/csv'

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const categories = await prisma.category.findMany({
    where: { userId },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      _count: { select: { products: true, children: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const body = await req.json()
  const parsed = categorySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = parsed.data
  const slug = data.slug?.trim() || slugify(data.name)

  try {
    const category = await prisma.category.create({
      data: {
        userId,
        name: data.name,
        slug,
        description: data.description ?? null,
        parentId: data.parentId || null,
        color: data.color ?? null,
        icon: data.icon ?? null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
    })
    return NextResponse.json(category, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error'
    if (msg.includes('Unique')) return NextResponse.json({ error: 'Ya existe una categoría con ese slug' }, { status: 409 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
