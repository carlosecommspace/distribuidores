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
 */
export async function requireSellerSession(): Promise<{
  sellerId: string
  ownerId: string
  userId: string
} | null> {
  const session = await auth()
  if (!session?.user) return null
  const su = session.user as { id?: string; role?: string; sellerId?: string }
  if (su.role !== 'seller' || !su.sellerId) return null

  // Doble check: que el seller no este suspendido (en la db) por si el estado
  // cambio despues del login
  const seller = await prisma.seller.findUnique({
    where: { id: su.sellerId },
    select: { id: true, ownerId: true, userId: true, isActive: true },
  })
  if (!seller || !seller.isActive) return null

  return {
    sellerId: seller.id,
    ownerId: seller.ownerId,
    userId: seller.userId,
  }
}
