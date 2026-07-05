import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { waClient } from '@/lib/wa-client'

const schema = z.object({
  contactId: z.string(),
  content: z.string().min(1),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const contact = await prisma.whatsAppContact.findFirst({
    where: { id: parsed.data.contactId, userId },
  })
  if (!contact) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

  if (!waClient.isConfigured()) {
    return NextResponse.json({ error: 'Worker no configurado' }, { status: 503 })
  }

  // Registrar el mensaje primero como 'queued' para respuesta rápida
  const message = await prisma.whatsAppMessage.create({
    data: {
      userId,
      contactId: contact.id,
      direction: 'out',
      content: parsed.data.content,
      status: 'queued',
    },
  })

  const result = await waClient.send(userId, contact.phoneNumber, parsed.data.content)

  if (result) {
    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: 'sent',
        externalId: result.externalId || null,
      },
    })
    await prisma.whatsAppContact.update({
      where: { id: contact.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: parsed.data.content.slice(0, 100),
        lastDirection: 'out',
      },
    })
    return NextResponse.json({ ok: true })
  } else {
    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: { status: 'failed', errorMessage: 'Worker no respondió' },
    })
    return NextResponse.json({ error: 'Envío falló' }, { status: 502 })
  }
}
