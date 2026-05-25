import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const clientSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  type: z.enum(['retail', 'wholesale', 'distributor']).default('retail'),
  notes: z.string().optional().nullable(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || undefined

  const clients = await prisma.client.findMany({
    where: {
      userId,
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { company: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(clients)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const body = await req.json()
  const parsed = clientSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data
  const client = await prisma.client.create({
    data: { ...data, email: data.email || null, userId },
  })
  return NextResponse.json(client, { status: 201 })
}
