import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  type: z.enum(['zelle', 'binance', 'bank_transfer_bs', 'bank_transfer_usd', 'cash_usd', 'cash_bs', 'other']).optional(),
  label: z.string().min(1).optional(),
  accountName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  documentId: z.string().optional().nullable(),
  currency: z.enum(['USD', 'VES']).optional(),
  instructions: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const existing = await prisma.paymentMethod.findFirst({ where: { id: params.id, userId } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const updated = await prisma.paymentMethod.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const existing = await prisma.paymentMethod.findFirst({ where: { id: params.id, userId } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await prisma.paymentMethod.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
