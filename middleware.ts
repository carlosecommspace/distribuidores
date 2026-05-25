import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuth = !!req.auth

  const publicPaths = ['/login', '/api/auth', '/catalogo', '/api/ml/webhook', '/api/whatsapp/webhook']
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  if (!isAuth && !isPublic) {
    const url = new URL('/login', req.nextUrl.origin)
    return NextResponse.redirect(url)
  }
  if (isAuth && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
}
