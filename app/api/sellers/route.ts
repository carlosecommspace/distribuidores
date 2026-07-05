import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateSellerPassword, hashPassword } from '@/lib/sellers'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  phone: z.string().max(40).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const su = session.user as { id: string; role?: string }
  if (su.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const sellers = await prisma.seller.findMany({
    where: { ownerId: su.id },
    include: {
      user: { select: { email: true } },
      _count: { select: { clientAssignments: true, requests: true, sales: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ sellers })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const su = session.user as { id: string; role?: string }
  if (su.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, email, phone, notes } = parsed.data

  // Email global unique en User — chequear antes de crear
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 })
  }

  const plainPassword = generateSellerPassword()
  const hashed = await hashPassword(plainPassword)

  const seller = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name,
        password: hashed,
        role: 'seller',
      },
      select: { id: true },
    })
    return tx.seller.create({
      data: {
        userId: user.id,
        ownerId: su.id,
        name,
        phone: phone || null,
        notes: notes || null,
      },
      include: { user: { select: { email: true } } },
    })
  })

  // Devolvemos el password en claro SOLO en la respuesta de creacion.
  // Es la unica vez que sera visible.
  return NextResponse.json({ seller, initialPassword: plainPassword }, { status: 201 })
}
