import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { waClient } from '@/lib/wa-client'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const record = await prisma.whatsAppSession.findUnique({
    where: { userId },
    select: {
      status: true, phoneNumber: true, displayName: true,
      qrCode: true, qrGeneratedAt: true,
      connectedAt: true, disconnectedAt: true,
      lastActivity: true, lastError: true, provider: true,
    },
  })

  return NextResponse.json({
    workerConfigured: waClient.isConfigured(),
    session: record || {
      status: 'disconnected', phoneNumber: null, displayName: null,
      qrCode: null, connectedAt: null, lastError: null, provider: 'baileys',
    },
  })
}

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  if (!waClient.isConfigured()) {
    return NextResponse.json({
      error: 'Worker de WhatsApp no configurado. Setea WA_WORKER_URL en el servidor.',
    }, { status: 503 })
  }

  await prisma.whatsAppSession.upsert({
    where: { userId },
    update: { status: 'connecting', qrCode: null },
    create: { userId, status: 'connecting' },
  })

  const result = await waClient.connect(userId)
  if (!result) {
    return NextResponse.json({ error: 'Worker no responde' }, { status: 503 })
  }
  return NextResponse.json({ ok: true, status: 'connecting' })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  if (waClient.isConfigured()) {
    await waClient.disconnect(userId)
  }
  await prisma.whatsAppSession.update({
    where: { userId },
    data: { status: 'disconnected', qrCode: null, authState: null, disconnectedAt: new Date() },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
