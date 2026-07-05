import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { HEX_RE, SLUG_RE, TEMPLATES, RESERVED_SLUGS, validateSlug } from '@/lib/merchant-site'

const schema = z.object({
  slug: z.string().transform((s) => s.toLowerCase().trim()),
  isPublished: z.boolean().optional(),
  template: z.enum(TEMPLATES).optional(),
  colorPrimary: z.string().regex(HEX_RE),
  colorAccent: z.string().regex(HEX_RE),
  colorNeutral: z.string().regex(HEX_RE),
  businessName: z.string().min(1).max(120),
  tagline: z.string().max(200).optional().nullable(),
  mission: z.string().max(2000).optional().nullable(),
  vision: z.string().max(2000).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  contactEmail: z.string().email().optional().nullable().or(z.literal('')),
  contactPhone: z.string().max(40).optional().nullable(),
  contactAddress: z.string().max(300).optional().nullable(),
  logoFileId: z.string().optional().nullable(),
  imageFileIds: z.array(z.string()).max(7).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const site = await prisma.merchantSite.findUnique({ where: { userId } })
  return NextResponse.json({ site, rootDomain: process.env.APP_ROOT_DOMAIN || null })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data

  const slugCheck = validateSlug(data.slug)
  if (!slugCheck.ok) return NextResponse.json({ error: slugCheck.error }, { status: 400 })

  // Slug único (no puede colisionar con otro tenant)
  const other = await prisma.merchantSite.findUnique({ where: { slug: data.slug } })
  if (other && other.userId !== userId) {
    return NextResponse.json({ error: 'Ese subdominio ya está en uso.' }, { status: 409 })
  }

  const images = (data.imageFileIds || []).slice(0, 7)
  const contactEmail = data.contactEmail ? data.contactEmail : null

  const site = await prisma.merchantSite.upsert({
    where: { userId },
    create: {
      userId,
      slug: data.slug,
      isPublished: data.isPublished ?? false,
      template: data.template || 'modern',
      colorPrimary: data.colorPrimary,
      colorAccent: data.colorAccent,
      colorNeutral: data.colorNeutral,
      businessName: data.businessName,
      tagline: data.tagline || null,
      mission: data.mission || null,
      vision: data.vision || null,
      description: data.description || null,
      contactEmail,
      contactPhone: data.contactPhone || null,
      contactAddress: data.contactAddress || null,
      logoFileId: data.logoFileId || null,
      imageFileIds: images,
    },
    update: {
      slug: data.slug,
      isPublished: data.isPublished,
      template: data.template,
      colorPrimary: data.colorPrimary,
      colorAccent: data.colorAccent,
      colorNeutral: data.colorNeutral,
      businessName: data.businessName,
      tagline: data.tagline || null,
      mission: data.mission || null,
      vision: data.vision || null,
      description: data.description || null,
      contactEmail,
      contactPhone: data.contactPhone || null,
      contactAddress: data.contactAddress || null,
      logoFileId: data.logoFileId || null,
      imageFileIds: images,
    },
  })

  return NextResponse.json({ site })
}
