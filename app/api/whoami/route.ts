import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Endpoint de diagnostico: devuelve exactamente que ve NextAuth para la
 * request actual, incluyendo lo que hay en el JWT y cual es el estado del
 * User + Seller en la DB.
 *
 * Util para debugear "no puedo entrar al portal del vendedor" desde el
 * browser: abrir /api/whoami y ver el JSON.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({
      authenticated: false,
      message: 'No hay sesion. Log in primero.',
    })
  }

  const su = session.user as {
    id?: string
    email?: string
    role?: string
    clientId?: string
    sellerId?: string
    sellerOwnerId?: string
  }

  const dbState: Record<string, unknown> = { userIdInSession: su.id }

  if (su.id) {
    const user = await prisma.user.findUnique({
      where: { id: su.id },
      select: {
        id: true, email: true, role: true, isActive: true,
        createdAt: true, updatedAt: true,
        sellerProfile: {
          select: { id: true, name: true, ownerId: true, isActive: true, createdAt: true },
        },
      },
    })
    dbState.user = user
    if (user?.sellerProfile) {
      dbState.expectedSellerPortalUrl = '/seller'
      dbState.sellerProfileMatchesSession = user.sellerProfile.id === su.sellerId
    }
  }

  return NextResponse.json({
    authenticated: true,
    session: {
      user: {
        id: su.id,
        email: su.email,
        role: su.role,
        clientId: su.clientId ?? null,
        sellerId: su.sellerId ?? null,
        sellerOwnerId: su.sellerOwnerId ?? null,
      },
    },
    dbState,
    diagnostics: {
      hasSellerIdInJwt: !!su.sellerId,
      roleIsSeller: su.role === 'seller',
      wouldEnterSellerPortal: su.role === 'seller' || (dbState.user as { sellerProfile?: unknown })?.sellerProfile,
    },
  })
}
