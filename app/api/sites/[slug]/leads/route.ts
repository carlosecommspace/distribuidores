import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { notify } from '@/lib/notifications'

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().max(40).optional().nullable(),
  message: z.string().min(1).max(2000),
})

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const site = await prisma.merchantSite.findUnique({
    where: { slug: params.slug },
    select: { id: true, userId: true, isPublished: true, businessName: true },
  })
  if (!site || !site.isPublished) return NextResponse.json({ error: 'Sitio no disponible' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, email, phone, message } = parsed.data

  const lead = await prisma.websiteLead.create({
    data: {
      siteId: site.id,
      userId: site.userId,
      name,
      email: email || null,
      phone: phone || null,
      message,
    },
    select: { id: true },
  })

  await notify({
    userId: site.userId,
    type: 'website_lead',
    severity: 'info',
    title: `Nuevo mensaje desde tu sitio web`,
    body: `${name}${email ? ` · ${email}` : ''}${phone ? ` · ${phone}` : ''}`,
    link: `/leads`,
    resourceType: 'website_lead',
    resourceId: lead.id,
    dedup: false,
  }).catch((e) => console.error('[leads] notify failed', e))

  return NextResponse.json({ ok: true }, { status: 201 })
}
