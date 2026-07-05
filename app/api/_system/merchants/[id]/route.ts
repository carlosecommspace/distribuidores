import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(120).optional(),
  company: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
})

async function requireSuperadmin() {
  const session = await auth()
  const su = session?.user as { role?: string } | undefined
  if (!su || su.role !== 'superadmin') return null
  return su
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const su = await requireSuperadmin()
  if (!su) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const merchant = await prisma.user.findFirst({
    where: { id: params.id, role: 'admin' },
    select: {
      id: true, email: true, name: true, company: true, phone: true,
      isActive: true, createdAt: true, updatedAt: true,
      _count: {
        select: {
          products: true, clients: true, sales: true,
          sellersOwned: true, requests: true, categories: true,
        },
      },
      merchantSite: { select: { slug: true, isPublished: true, businessName: true } },
    },
  })
  if (!merchant) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({ merchant })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const su = await requireSuperadmin()
  if (!su) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const merchant = await prisma.user.findFirst({ where: { id: params.id, role: 'admin' } })
  if (!merchant) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      isActive: parsed.data.isActive,
      name: parsed.data.name,
      company: parsed.data.company === undefined ? undefined : (parsed.data.company || null),
      phone: parsed.data.phone === undefined ? undefined : (parsed.data.phone || null),
    },
    select: {
      id: true, email: true, name: true, company: true, phone: true,
      isActive: true, createdAt: true, updatedAt: true,
    },
  })

  return NextResponse.json({ merchant: updated })
}
