import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth
  const isAuth = !!session
  const role = (session?.user as { role?: string } | undefined)?.role || 'admin'

  const publicPaths = ['/login', '/api/auth', '/catalogo', '/api/ml/webhook', '/api/whatsapp/webhook']
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  if (!isAuth && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  }

  if (isAuth && pathname === '/login') {
    const dest = role === 'client' ? '/portal' : '/'
    return NextResponse.redirect(new URL(dest, req.nextUrl.origin))
  }

  if (isAuth && role === 'client') {
    const allowed = pathname.startsWith('/portal') || pathname.startsWith('/api/portal') || pathname.startsWith('/api/auth')
    if (!allowed && !isPublic) {
      return NextResponse.redirect(new URL('/portal', req.nextUrl.origin))
    }
  }

  if (isAuth && role !== 'client' && pathname.startsWith('/portal')) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
}
