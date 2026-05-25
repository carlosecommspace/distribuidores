import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { exchangeCodeForToken } from '@/lib/ml-api'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.redirect(new URL('/login', req.url))
  const userId = (session.user as { id: string }).id

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  if (error || !code) {
    return NextResponse.redirect(new URL('/mercadolibre?error=' + (error || 'no_code'), req.url))
  }

  try {
    const tok = await exchangeCodeForToken(code)
    await prisma.mLConnection.upsert({
      where: { userId },
      update: {
        accessToken: tok.access_token,
        refreshToken: tok.refresh_token,
        tokenExpiry: new Date(Date.now() + tok.expires_in * 1000),
        isActive: true,
      },
      create: {
        userId,
        mlUserId: String(tok.user_id),
        accessToken: tok.access_token,
        refreshToken: tok.refresh_token,
        tokenExpiry: new Date(Date.now() + tok.expires_in * 1000),
        connectedAt: new Date(),
      },
    })
    return NextResponse.redirect(new URL('/mercadolibre?connected=1', req.url))
  } catch {
    return NextResponse.redirect(new URL('/mercadolibre?error=oauth_failed', req.url))
  }
}
