import { auth } from './auth'
import { prisma } from './prisma'

/**
 * Resuelve la sesion del vendedor y devuelve el contexto que necesitan las APIs:
 * sellerId (para tag en pedidos) y ownerId (tenant del que forma parte).
 *
 * Devuelve null si:
 *   - No hay sesion
 *   - No es seller
 *   - El seller esta suspendido (isActive=false)
 *
 * Con fallback por userId si el JWT no trae sellerId (sesion emitida antes de
 * que la aplicacion agregara el campo, o cualquier otro caso raro).
 */
export async function requireSellerSession(): Promise<{
  sellerId: string
  ownerId: string
  userId: string
} | null> {
  const session = await auth()
  if (!session?.user) return null
  const su = session.user as { id?: string; role?: string; sellerId?: string }
  if (su.role !== 'seller' || !su.id) return null

  // Preferimos sellerId de la sesion, pero como fallback buscamos por userId
  const seller = su.sellerId
    ? await prisma.seller.findUnique({
        where: { id: su.sellerId },
        select: { id: true, ownerId: true, userId: true, isActive: true },
      })
    : await prisma.seller.findFirst({
        where: { userId: su.id },
        select: { id: true, ownerId: true, userId: true, isActive: true },
      })
  if (!seller || !seller.isActive) return null

  return {
    sellerId: seller.id,
    ownerId: seller.ownerId,
    userId: seller.userId,
  }
}
