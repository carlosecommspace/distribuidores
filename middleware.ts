import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Subdominios que NO son sitios de merchant (los reservamos para infra propia)
const RESERVED_SUBDOMAINS = new Set(['www', 'admin', 'app', 'api', 'portal'])

/**
 * Detecta si el host es un subdominio de APP_ROOT_DOMAIN.
 * Devuelve el slug si aplica, null si es el dominio raíz o un reservado.
 * Localhost / dominios sin punto son tratados como raíz.
 */
function detectMerchantSlug(host: string | null, rootDomain: string): string | null {
  if (!host || !rootDomain) return null
  const h = host.split(':')[0].toLowerCase()
  const r = rootDomain.toLowerCase()
  if (h === r) return null
  if (!h.endsWith(`.${r}`)) return null
  const sub = h.slice(0, h.length - r.length - 1)
  // Solo subdominios de un nivel (foo.distribos.com, no a.b.distribos.com)
  if (sub.includes('.')) return null
  if (RESERVED_SUBDOMAINS.has(sub)) return null
  return sub
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const host = req.headers.get('host')
  const rootDomain = process.env.APP_ROOT_DOMAIN || ''

  // -------------------------------------------------------------------------
  // 1) Sitio del merchant: {slug}.APP_ROOT_DOMAIN → reescribe a /sites/{slug}
  // -------------------------------------------------------------------------
  const merchantSlug = detectMerchantSlug(host, rootDomain)
  if (merchantSlug) {
    // No re-reescribas si ya estamos sirviendo internamente algo del sitio
    if (pathname.startsWith('/_next') || pathname.startsWith('/api/site-assets') || pathname.startsWith('/api/sites/')) {
      return NextResponse.next()
    }
    const url = req.nextUrl.clone()
    // Todos los paths del subdominio se sirven bajo /sites/{slug}
    url.pathname = `/sites/${merchantSlug}${pathname === '/' ? '' : pathname}`
    return NextResponse.rewrite(url)
  }

  // -------------------------------------------------------------------------
  // 2) App principal (auth, admin, portal)
  // -------------------------------------------------------------------------
  const session = req.auth
  const isAuth = !!session
  const role = (session?.user as { role?: string } | undefined)?.role || 'admin'

  const publicPaths = [
    '/login',
    '/vendedor', // login publico del vendedor (link que el merchant comparte)
    '/superadminloginpage', // login del superadmin global
    '/api/auth',
    '/catalogo',
    '/api/ml/webhook',
    '/api/whatsapp/webhook',
    '/sites/', // rutas del sitio publico (por si alguien las visita directo)
    '/api/sites/', // POST leads publico
    '/api/site-assets/', // assets publicos del sitio (logo/imagenes)
  ]
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  if (!isAuth && !isPublic) {
    // Sin sesion en rutas del superadmin -> login del superadmin
    if (pathname === '/superadmin' || pathname.startsWith('/superadmin/') || pathname.startsWith('/api/superadmin')) {
      return NextResponse.redirect(new URL('/superadminloginpage', req.nextUrl.origin))
    }
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  }

  // Ya autenticado en pagina de login: mandarlo a su portal
  if (isAuth && (pathname === '/login' || pathname === '/vendedor' || pathname === '/superadminloginpage')) {
    const dest =
      role === 'client' ? '/portal' :
      role === 'seller' ? '/seller' :
      role === 'superadmin' ? '/superadmin' :
      '/'
    return NextResponse.redirect(new URL(dest, req.nextUrl.origin))
  }

  // Helper: matchea /prefix exacto o /prefix/... — evita que /sellers matchee
  // con /seller (bug historico donde el admin no podia entrar a /sellers).
  const startsWithExact = (p: string, prefix: string) => p === prefix || p.startsWith(`${prefix}/`)

  // Client (portal): solo /portal + endpoints necesarios
  if (isAuth && role === 'client') {
    const allowed =
      startsWithExact(pathname, '/portal') ||
      startsWithExact(pathname, '/api/portal') ||
      startsWithExact(pathname, '/api/auth') ||
      startsWithExact(pathname, '/api/uploads') ||
      startsWithExact(pathname, '/print/portal')
    if (!allowed && !isPublic) {
      return NextResponse.redirect(new URL('/portal', req.nextUrl.origin))
    }
  }

  // Seller (portal del vendedor): solo /seller (singular) + endpoints necesarios.
  // Ojo: /seller NO matchea /sellers (esa es la pagina del admin merchant).
  if (isAuth && role === 'seller') {
    const allowed =
      startsWithExact(pathname, '/seller') ||
      startsWithExact(pathname, '/api/seller') ||
      startsWithExact(pathname, '/api/auth') ||
      startsWithExact(pathname, '/api/uploads') ||
      startsWithExact(pathname, '/api/products/search')
    if (!allowed && !isPublic) {
      return NextResponse.redirect(new URL('/seller', req.nextUrl.origin))
    }
  }

  // Superadmin: solo /superadmin + endpoints necesarios
  if (isAuth && role === 'superadmin') {
    const allowed =
      startsWithExact(pathname, '/superadmin') ||
      startsWithExact(pathname, '/api/superadmin') ||
      startsWithExact(pathname, '/api/auth')
    if (!allowed && !isPublic) {
      return NextResponse.redirect(new URL('/superadmin', req.nextUrl.origin))
    }
  }

  // Admin: bloqueado el portal de cliente, del vendedor y del superadmin
  if (isAuth && role !== 'client' && (startsWithExact(pathname, '/portal') || startsWithExact(pathname, '/print/portal'))) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }
  if (isAuth && role !== 'seller' && startsWithExact(pathname, '/seller')) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }
  if (isAuth && role !== 'superadmin' && (startsWithExact(pathname, '/superadmin') || startsWithExact(pathname, '/api/superadmin'))) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
}
