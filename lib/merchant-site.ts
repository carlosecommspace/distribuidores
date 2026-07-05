import { prisma } from './prisma'

export const TEMPLATES = ['modern', 'warm', 'minimal'] as const
export type Template = (typeof TEMPLATES)[number]

export const HEX_RE = /^#[0-9a-fA-F]{6}$/
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/

// Slugs que jamas se le asignaran a un merchant (chocarian con infra)
export const RESERVED_SLUGS = new Set([
  'www', 'app', 'admin', 'api', 'portal', 'mail', 'assets', 'static', 'cdn',
  'blog', 'help', 'support', 'status', 'docs', 'auth', 'login', 'signup',
  'distribos', 'distrib',
])

export function validateSlug(slug: string): { ok: true } | { ok: false; error: string } {
  if (!SLUG_RE.test(slug)) {
    return { ok: false, error: 'El subdominio solo puede tener letras minúsculas, números y guiones (3–32 caracteres, no puede empezar ni terminar con guión).' }
  }
  if (slug.length < 3) return { ok: false, error: 'El subdominio debe tener al menos 3 caracteres.' }
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: 'Este subdominio está reservado.' }
  return { ok: true }
}

export function validateHex(color: string): boolean {
  return HEX_RE.test(color)
}

export async function getSiteBySlug(slug: string) {
  return prisma.merchantSite.findUnique({ where: { slug } })
}

export function siteUrl(slug: string): string {
  const root = process.env.APP_ROOT_DOMAIN
  if (!root) {
    const base = process.env.APP_PUBLIC_URL || process.env.NEXTAUTH_URL || ''
    if (!base) return `/sites/${slug}`
    return `${base.replace(/\/$/, '')}/sites/${slug}`
  }
  return `https://${slug}.${root}`
}

/**
 * Devuelve el prefijo de path para links internos del sitio del merchant.
 * En subdominio ("mitienda.distribos.com") no necesitamos prefijo → devuelve "".
 * En path-based ("app.com/sites/mitienda") devuelve "/sites/{slug}".
 * Se usa como: <a href={`${siteBasePath(slug, host)}/catalogo`}>
 */
export function siteBasePath(slug: string, host: string | null | undefined): string {
  const root = process.env.APP_ROOT_DOMAIN
  if (!root || !host) return `/sites/${slug}`
  const h = host.split(':')[0].toLowerCase()
  if (h === `${slug}.${root.toLowerCase()}`) return ''
  return `/sites/${slug}`
}
