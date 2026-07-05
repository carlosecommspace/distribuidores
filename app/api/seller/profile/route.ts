import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSellerSession } from '@/lib/seller-session'
import { hashPassword } from '@/lib/sellers'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
})

export async function GET() {
  const ctx = await requireSellerSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [seller, user, priceLists, priceListsCount] = await Promise.all([
    prisma.seller.findUnique({
      where: { id: ctx.sellerId },
      select: { id: true, name: true, phone: true, notes: true, isActive: true, createdAt: true },
    }),
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true } }),
    prisma.priceList.findMany({
      where: { userId: ctx.ownerId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    // Total clientes que gestiona
    prisma.sellerClient.count({ where: { sellerId: ctx.sellerId } }),
  ])
  return NextResponse.json({
    seller,
    email: user?.email,
    priceLists,
    clientsCount: priceListsCount,
  })
}

export async function PATCH(req: Request) {
  const ctx = await requireSellerSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = passwordSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { password: true } })
  if (!user?.password) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!ok) return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 400 })

  const hashed = await hashPassword(parsed.data.newPassword)
  await prisma.user.update({ where: { id: ctx.userId }, data: { password: hashed } })

  return NextResponse.json({ ok: true })
}
