import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { generateSellerPassword } from '@/lib/sellers'

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  company: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
})

async function requireSuperadmin() {
  const session = await auth()
  const su = session?.user as { role?: string; id?: string } | undefined
  if (!su || su.role !== 'superadmin') return null
  return su
}

export async function GET() {
  const su = await requireSuperadmin()
  if (!su) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const merchants = await prisma.user.findMany({
    where: { role: 'admin' },
    select: {
      id: true, email: true, name: true, company: true, phone: true,
      isActive: true, createdAt: true, updatedAt: true,
      _count: {
        select: {
          products: true,
          clients: true,
          sales: true,
          sellersOwned: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ merchants })
}

export async function POST(req: Request) {
  const su = await requireSuperadmin()
  if (!su) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, email, company, phone } = parsed.data

  // Email global unique
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 })
  }

  const plainPassword = generateSellerPassword() // 10 chars alfanumericos legibles
  const hashed = await bcrypt.hash(plainPassword, 10)

  const user = await prisma.user.create({
    data: {
      email,
      name,
      company: company || null,
      phone: phone || null,
      password: hashed,
      role: 'admin',
      isActive: true,
    },
    select: { id: true, email: true, name: true, company: true, createdAt: true },
  })

  return NextResponse.json({ merchant: user, initialPassword: plainPassword }, { status: 201 })
}
