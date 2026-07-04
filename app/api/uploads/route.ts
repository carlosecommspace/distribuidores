import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])

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
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `Máximo 5 MB (recibido ${(file.size / 1024 / 1024).toFixed(1)} MB)` }, { status: 400 })
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Tipo no permitido: ${file.type}. Usa JPG, PNG, WEBP, GIF o PDF.` }, { status: 400 })
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
