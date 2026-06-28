import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const schema = z.object({
  password: z.string().min(6).max(120),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const client = await prisma.client.findFirst({
    where: { id: params.id, userId },
    include: { portalUser: true },
  })
  if (!client) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!client.portalUser) {
    return NextResponse.json({ error: 'Este cliente aún no tiene acceso al portal' }, { status: 400 })
  }

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const hash = await bcrypt.hash(parsed.data.password, 10)
  await prisma.user.update({ where: { id: client.portalUser.id }, data: { password: hash } })
  return NextResponse.json({ ok: true })
}
