import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseCSV, slugify } from '@/lib/csv'

interface ImportRow {
  nombre?: string
  slug?: string
  categoria_padre?: string
  descripcion?: string
  color?: string
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  let csv = ''
  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const body = (await req.json()) as { csv?: string }
    csv = body.csv || ''
  } else {
    csv = await req.text()
  }
  if (!csv.trim()) return NextResponse.json({ error: 'CSV vacío' }, { status: 400 })

  const rows = parseCSV(csv) as unknown as ImportRow[]
  if (rows.length === 0) return NextResponse.json({ error: 'Sin filas' }, { status: 400 })

  // Pasada 1: crear/actualizar categorías raíz (sin padre)
  // Pasada 2: crear/actualizar las que tienen padre, resolviendo por slug
  const stats = { created: 0, updated: 0, skipped: 0, errors: [] as Array<{ row: number; error: string }> }

  const allBySlug = new Map<string, { id: string }>()
  const existing = await prisma.category.findMany({ where: { userId }, select: { id: true, slug: true } })
  for (const e of existing) allBySlug.set(e.slug, { id: e.id })

  const upserts: Array<{ row: ImportRow; rowIdx: number; slug: string; parentSlug?: string }> = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (!r.nombre || !r.nombre.trim()) { stats.skipped++; continue }
    const slug = (r.slug?.trim() || slugify(r.nombre))
    upserts.push({ row: r, rowIdx: i + 2, slug, parentSlug: r.categoria_padre?.trim() || undefined })
  }

  // Sort: padres primero (los que NO tienen parentSlug)
  upserts.sort((a, b) => Number(!!a.parentSlug) - Number(!!b.parentSlug))

  for (const u of upserts) {
    try {
      const parentId = u.parentSlug ? (allBySlug.get(u.parentSlug)?.id ?? null) : null
      if (u.parentSlug && !parentId) {
        stats.errors.push({ row: u.rowIdx, error: `Padre no encontrado: ${u.parentSlug}` })
        continue
      }
      const data = {
        userId,
        name: (u.row.nombre || '').trim(),
        slug: u.slug,
        description: u.row.descripcion?.trim() || null,
        color: u.row.color?.trim() || null,
        parentId,
      }
      const existed = allBySlug.has(u.slug)
      const saved = await prisma.category.upsert({
        where: { userId_slug: { userId, slug: u.slug } },
        update: { name: data.name, description: data.description, color: data.color, parentId: data.parentId },
        create: data,
      })
      allBySlug.set(u.slug, { id: saved.id })
      if (existed) stats.updated++
      else stats.created++
    } catch (e: unknown) {
      stats.errors.push({ row: u.rowIdx, error: e instanceof Error ? e.message : 'error' })
    }
  }

  return NextResponse.json(stats)
}
