import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB default
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])

// Límites específicos por propósito
const PURPOSE_LIMITS: Record<string, { maxBytes: number; mime: Set<string> }> = {
  product_image: {
    maxBytes: 250 * 1024, // 250 KB
    mime: new Set(['image/jpeg', 'image/png', 'image/webp']),
  },
  site_logo: {
    maxBytes: 500 * 1024, // 500 KB
    mime: new Set(['image/png', 'image/webp', 'image/svg+xml']),
  },
  site_image: {
    maxBytes: 1024 * 1024, // 1 MB
    mime: new Set(['image/jpeg', 'image/png', 'image/webp']),
  },
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const su = session.user as { id: string; role?: string; clientId?: string }

  // Determinar el tenant (userId dueño). Si es admin: él mismo. Si es cliente: el userId del admin dueño.
  let tenantUserId = su.id
  if (su.role === 'client' && su.clientId) {
    const client = await prisma.client.findUnique({ where: { id: su.clientId }, select: { userId: true } })
    if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    tenantUserId = client.userId
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Envío inválido' }, { status: 400 })
  }

  const file = formData.get('file')
  const purpose = String(formData.get('purpose') || 'payment_proof')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 })
  }

  const limits = PURPOSE_LIMITS[purpose]
  const maxBytes = limits?.maxBytes ?? MAX_BYTES
  const allowedMime = limits?.mime ?? ALLOWED_MIME
  const limitLabel = maxBytes >= 1024 * 1024
    ? `${(maxBytes / 1024 / 1024).toFixed(0)} MB`
    : `${(maxBytes / 1024).toFixed(0)} KB`

  if (file.size > maxBytes) {
    return NextResponse.json({
      error: `Máximo ${limitLabel} (recibido ${(file.size / 1024).toFixed(0)} KB)`,
    }, { status: 400 })
  }
  if (!allowedMime.has(file.type)) {
    const list = Array.from(allowedMime).map((m) => m.split('/')[1].toUpperCase()).join(', ')
    return NextResponse.json({ error: `Tipo no permitido: ${file.type}. Usa ${list}.` }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const record = await prisma.fileUpload.create({
    data: {
      userId: tenantUserId,
      uploaderId: su.id,
      purpose,
      filename: file.name || 'upload',
      mimeType: file.type,
      size: file.size,
      data: buf,
    },
    select: { id: true, filename: true, mimeType: true, size: true },
  })

  return NextResponse.json({
    id: record.id,
    url: `/api/uploads/${record.id}`,
    filename: record.filename,
    mimeType: record.mimeType,
    size: record.size,
  }, { status: 201 })
}
