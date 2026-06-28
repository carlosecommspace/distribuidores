import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const category = await prisma.category.findFirst({
    where: { id: params.id, userId },
    include: { parent: true, children: true, _count: { select: { products: true } } },
  })
  if (!category) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(category)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const existing = await prisma.category.findFirst({ where: { id: params.id, userId } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json() as {
    name?: string
    slug?: string
    description?: string | null
    parentId?: string | null
    color?: string | null
    icon?: string | null
    sortOrder?: number
    isActive?: boolean
  }

  if (body.parentId && body.parentId === params.id) {
    return NextResponse.json({ error: 'Una categoría no puede ser su propio padre' }, { status: 400 })
  }

  // Si el nombre cambia, también propagamos al campo Product.category (denormalizado)
  const updated = await prisma.category.update({ where: { id: params.id }, data: body })
  if (body.name && body.name !== existing.name) {
    await prisma.product.updateMany({
      where: { userId, categoryId: params.id },
      data: { category: body.name },
    })
  }
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const existing = await prisma.category.findFirst({
    where: { id: params.id, userId },
    include: { _count: { select: { products: true, children: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // SetNull en productos y children por la relación; Prisma lo maneja por onDelete
  await prisma.category.delete({ where: { id: params.id } })
  return NextResponse.json({
    ok: true,
    detachedProducts: existing._count.products,
    detachedChildren: existing._count.children,
  })
}
