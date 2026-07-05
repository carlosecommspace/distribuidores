import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET publico: sirve un FileUpload si:
 *   1. Esta referenciado como logo o imagen de un MerchantSite publicado, o
 *   2. Es un product_image de un tenant que tiene su MerchantSite publicado
 *      (para que las imagenes del catalogo se vean en el sitio publico).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const fileId = params.id

  const file = await prisma.fileUpload.findUnique({
    where: { id: fileId },
    select: { userId: true, mimeType: true, data: true, filename: true, purpose: true },
  })
  if (!file) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Regla 1: referenciado como logo o imagen del sitio
  const referencedFromSite = await prisma.merchantSite.findFirst({
    where: {
      isPublished: true,
      OR: [{ logoFileId: fileId }, { imageFileIds: { has: fileId } }],
    },
    select: { id: true },
  })

  let authorized = !!referencedFromSite

  // Regla 2: product_image de un tenant con sitio publicado
  if (!authorized && file.purpose === 'product_image') {
    const tenantSite = await prisma.merchantSite.findFirst({
      where: { userId: file.userId, isPublished: true },
      select: { id: true },
    })
    authorized = !!tenantSite
  }

  if (!authorized) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = new Uint8Array(file.data)
  return new Response(body, {
    headers: {
      'content-type': file.mimeType,
      'cache-control': 'public, max-age=86400, immutable',
      'content-disposition': `inline; filename="${encodeURIComponent(file.filename)}"`,
    },
  })
}
