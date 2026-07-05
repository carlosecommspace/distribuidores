import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSellerSession } from '@/lib/seller-session'
import { z } from 'zod'

const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  company: z.string().max(200).optional().nullable(),
  rif: z.string().max(50).optional().nullable(),
  contactPerson: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().max(500).optional().nullable(),
  billingAddress: z.string().max(500).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  type: z.string().max(30).optional(),
  notes: z.string().max(2000).optional().nullable(),
  priceListId: z.string().optional().nullable(),
})

export async function GET() {
  const ctx = await requireSellerSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Clientes asignados al vendedor (via SellerClient)
  const assignments = await prisma.sellerClient.findMany({
    where: { sellerId: ctx.sellerId },
    include: {
      client: {
        select: {
          id: true, name: true, company: true, rif: true, phone: true, email: true,
          city: true, type: true, totalPurchases: true, lastPurchase: true,
          priceList: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ clients: assignments.map((a) => a.client) })
}

export async function POST(req: Request) {
  const ctx = await requireSellerSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createClientSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data

  // Validar priceList (debe pertenecer al mismo tenant)
  if (d.priceListId) {
    const pl = await prisma.priceList.findUnique({ where: { id: d.priceListId }, select: { userId: true } })
    if (!pl || pl.userId !== ctx.ownerId) {
      return NextResponse.json({ error: 'Lista de precios inválida' }, { status: 400 })
    }
  }

  const client = await prisma.client.create({
    data: {
      userId: ctx.ownerId,
      name: d.name,
      company: d.company || null,
      rif: d.rif || null,
      contactPerson: d.contactPerson || null,
      phone: d.phone || null,
      email: d.email ? d.email : null,
      address: d.address || null,
      billingAddress: d.billingAddress || null,
      city: d.city || null,
      type: d.type || 'retail',
      notes: d.notes || null,
      priceListId: d.priceListId || null,
      createdBySellerId: ctx.sellerId,
    },
  })

  // Auto-asignar al vendedor que lo creo
  await prisma.sellerClient.create({
    data: { sellerId: ctx.sellerId, clientId: client.id },
  })

  return NextResponse.json({ client }, { status: 201 })
}
