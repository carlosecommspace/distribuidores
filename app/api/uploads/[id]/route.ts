import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const su = session.user as { id: string; role?: string; clientId?: string }

  const file = await prisma.fileUpload.findUnique({
    where: { id: params.id },
    select: { userId: true, filename: true, mimeType: true, data: true },
  })
  if (!file) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Autorización:
  // - Admin: sólo si el file pertenece a su tenant (userId)
  // - Cliente: sólo si el file pertenece al tenant de su admin
  let allowed = false
  if (su.role === 'client' && su.clientId) {
    const client = await prisma.client.findUnique({ where: { id: su.clientId }, select: { userId: true } })
    allowed = client?.userId === file.userId
  } else {
    allowed = su.id === file.userId
  }
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Buffer<ArrayBufferLike> a Uint8Array explícito para satisfacer BodyInit
  const body = new Uint8Array(file.data)
  return new Response(body, {
    headers: {
      'content-type': file.mimeType,
      'cache-control': 'private, max-age=3600',
      'content-disposition': `inline; filename="${encodeURIComponent(file.filename)}"`,
    },
  })
}
