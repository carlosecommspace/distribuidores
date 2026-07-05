import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateSellerPassword, hashPassword, getSellerOwned } from '@/lib/sellers'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const su = session.user as { id: string; role?: string }
  if (su.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const seller = await getSellerOwned(params.id, su.id)
  if (!seller) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const plain = generateSellerPassword()
  const hashed = await hashPassword(plain)
  await prisma.user.update({ where: { id: seller.userId }, data: { password: hashed } })

  return NextResponse.json({ ok: true, newPassword: plain })
}
