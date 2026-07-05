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
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  }

  if (isAuth && pathname === '/login') {
    const dest = role === 'client' ? '/portal' : role === 'seller' ? '/seller' : '/'
    return NextResponse.redirect(new URL(dest, req.nextUrl.origin))
  }

  // Client (portal): solo /portal + endpoints necesarios
  if (isAuth && role === 'client') {
    const allowed =
      pathname.startsWith('/portal') ||
      pathname.startsWith('/api/portal') ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/uploads') ||
      pathname.startsWith('/print/portal')
    if (!allowed && !isPublic) {
      return NextResponse.redirect(new URL('/portal', req.nextUrl.origin))
    }
  }

  // Seller (portal del vendedor): solo /seller + endpoints necesarios
  if (isAuth && role === 'seller') {
    const allowed =
      pathname.startsWith('/seller') ||
      pathname.startsWith('/api/seller') ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/uploads') ||
      pathname.startsWith('/api/products/search') // reutilizable en el picker de productos
    if (!allowed && !isPublic) {
      return NextResponse.redirect(new URL('/seller', req.nextUrl.origin))
    }
  }

  // Admin: bloqueado el portal de cliente y de seller (evita colisiones)
  if (isAuth && role !== 'client' && (pathname.startsWith('/portal') || pathname.startsWith('/print/portal'))) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }
  if (isAuth && role !== 'seller' && pathname.startsWith('/seller')) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
}
