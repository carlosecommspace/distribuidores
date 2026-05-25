import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const { replies } = (await req.json()) as { replies: Array<{ trigger: string; reply: string }> }

  await prisma.quickReply.deleteMany({ where: { userId } })
  if (replies?.length) {
    await prisma.quickReply.createMany({
      data: replies.map((r) => ({ userId, trigger: r.trigger, reply: r.reply })),
    })
  }
  return NextResponse.json({ ok: true })
}
