import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSellerOwned } from '@/lib/sellers'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const su = session.user as { id: string; role?: string }
  if (su.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const seller = await getSellerOwned(params.id, su.id)
  if (!seller) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const [assignedClients, requests, sales] = await Promise.all([
    prisma.sellerClient.findMany({
      where: { sellerId: params.id },
      include: {
        client: {
          select: {
            id: true, name: true, company: true, phone: true, email: true,
            totalPurchases: true, lastPurchase: true,
            priceList: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.productRequest.count({ where: { sellerId: params.id } }),
    prisma.sale.aggregate({
      where: { sellerId: params.id },
      _count: true,
      _sum: { totalUSD: true },
    }),
  ])

  return NextResponse.json({
    seller,
    assignedClients: assignedClients.map((a) => a.client),
    stats: {
      requests,
      salesCount: sales._count,
      salesTotalUSD: sales._sum.totalUSD || 0,
    },
  })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const su = session.user as { id: string; role?: string }
  if (su.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const seller = await getSellerOwned(params.id, su.id)
  if (!seller) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await prisma.seller.update({
    where: { id: params.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone === undefined ? undefined : (parsed.data.phone || null),
      notes: parsed.data.notes === undefined ? undefined : (parsed.data.notes || null),
      isActive: parsed.data.isActive,
    },
    include: { user: { select: { email: true } } },
  })

  // Si tambien cambio el name, sincronizamos con User.name para consistencia en el login
  if (parsed.data.name) {
    await prisma.user.update({ where: { id: seller.userId }, data: { name: parsed.data.name } })
  }

  return NextResponse.json({ seller: updated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const su = session.user as { id: string; role?: string }
  if (su.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const seller = await getSellerOwned(params.id, su.id)
  if (!seller) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Borrar el Seller cascade borra sus asignaciones. Al Seller esta linkeado
  // via User (cascade). Como User.role=seller no es usado por otras cosas,
  // borrar el User es seguro. ProductRequest.sellerId queda en SetNull.
  await prisma.$transaction([
    prisma.seller.delete({ where: { id: params.id } }),
    prisma.user.delete({ where: { id: seller.userId } }).catch(() => {}) as never,
  ])

  return NextResponse.json({ ok: true })
}
