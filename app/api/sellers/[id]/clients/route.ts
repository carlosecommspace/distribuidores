import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSellerOwned } from '@/lib/sellers'
import { z } from 'zod'

const schema = z.object({
  clientIds: z.array(z.string()).max(500),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const su = session.user as { id: string; role?: string }
  if (su.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const seller = await getSellerOwned(params.id, su.id)
  if (!seller) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Verificar que todos los clientes pertenecen al tenant
  const clients = await prisma.client.findMany({
    where: { id: { in: parsed.data.clientIds }, userId: su.id },
    select: { id: true },
  })
  const validIds = new Set(clients.map((c) => c.id))
  const toCreate = parsed.data.clientIds.filter((id) => validIds.has(id))

  // Bulk upsert usando createMany + skipDuplicates para no duplicar asignaciones
  if (toCreate.length > 0) {
    await prisma.sellerClient.createMany({
      data: toCreate.map((clientId) => ({ sellerId: params.id, clientId })),
      skipDuplicates: true,
    })
  }

  return NextResponse.json({ ok: true, assigned: toCreate.length })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const su = session.user as { id: string; role?: string }
  if (su.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const seller = await getSellerOwned(params.id, su.id)
  if (!seller) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const url = new URL(req.url)
  const clientId = url.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  await prisma.sellerClient.deleteMany({
    where: { sellerId: params.id, clientId },
  })

  return NextResponse.json({ ok: true })
}
