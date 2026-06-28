import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClientSession } from '@/lib/portal'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const profileSchema = z.object({
  name: z.string().min(1).optional(),
  // Cambio de contraseña: requiere currentPassword + newPassword
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).max(120).optional(),
})

export async function GET() {
  const ctx = await requireClientSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { id: true, email: true, name: true, createdAt: true },
  })
  return NextResponse.json({ user, client: { name: ctx.client.name, company: ctx.client.company } })
}

export async function PATCH(req: Request) {
  const ctx = await requireClientSession()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const parsed = profileSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { name, currentPassword, newPassword } = parsed.data

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name

  if (newPassword !== undefined || currentPassword !== undefined) {
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Debes ingresar la contraseña actual y la nueva' }, { status: 400 })
    }
    const user = await prisma.user.findUnique({ where: { id: ctx.userId } })
    if (!user?.password) return NextResponse.json({ error: 'usuario sin contraseña' }, { status: 400 })
    const ok = await bcrypt.compare(currentPassword, user.password)
    if (!ok) return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 400 })
    updates.password = await bcrypt.hash(newPassword, 10)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, changed: false })
  }

  await prisma.user.update({ where: { id: ctx.userId }, data: updates })
  return NextResponse.json({ ok: true })
}
