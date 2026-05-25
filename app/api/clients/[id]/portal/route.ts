import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(120),
  name: z.string().optional(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const client = await prisma.client.findFirst({ where: { id: params.id, userId }, include: { portalUser: true } })
  if (!client) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { email, password, name } = parsed.data
  const normalizedEmail = email.toLowerCase().trim()
  const hash = await bcrypt.hash(password, 10)

  if (client.portalUser) {
    if (client.portalUser.email !== normalizedEmail) {
      const taken = await prisma.user.findUnique({ where: { email: normalizedEmail } })
      if (taken && taken.id !== client.portalUser.id) {
        return NextResponse.json({ error: 'Ese email ya está registrado' }, { status: 409 })
      }
    }
    await prisma.user.update({
      where: { id: client.portalUser.id },
      data: { email: normalizedEmail, password: hash, name: name || client.name, role: 'client' },
    })
  } else {
    const taken = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (taken) return NextResponse.json({ error: 'Ese email ya está registrado' }, { status: 409 })
    await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hash,
        name: name || client.name,
        role: 'client',
        clientId: client.id,
      },
    })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const client = await prisma.client.findFirst({ where: { id: params.id, userId }, include: { portalUser: true } })
  if (!client) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!client.portalUser) return NextResponse.json({ ok: true })
  await prisma.user.delete({ where: { id: client.portalUser.id } })
  return NextResponse.json({ ok: true })
}
